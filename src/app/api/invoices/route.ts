import { NextRequest, NextResponse } from "next/server";
import {
  calculateTotals,
  type CurrencyCode,
  type Invoice,
  type InvoiceStatus,
  type StoredInvoice,
} from "@/lib/invoice";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  client_name: string | null;
  status: InvoiceStatus | null;
  total: number | null;
  currency: CurrencyCode | null;
  updated_at: string | null;
  payload: Invoice;
};

function authorizationError(request: NextRequest) {
  const expectedPin = process.env.INVOICE_APP_PIN;

  if (process.env.NODE_ENV === "production" && !expectedPin) {
    return NextResponse.json(
      { message: "INVOICE_APP_PIN is required in production." },
      { status: 500 },
    );
  }

  if (expectedPin && request.headers.get("x-invoice-pin") !== expectedPin) {
    return NextResponse.json({ message: "PIN required." }, { status: 401 });
  }

  return null;
}

function mapRow(row: InvoiceRow): StoredInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientName: row.client_name || row.payload.billTo.name || "Unnamed client",
    status: row.status || row.payload.status,
    total: Number(row.total || 0),
    currency: row.currency || row.payload.currency,
    updatedAt: row.updated_at || new Date().toISOString(),
    payload: row.payload,
  };
}

export async function GET(request: NextRequest) {
  const authError = authorizationError(request);
  if (authError) {
    return authError;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_name, status, total, currency, updated_at, payload")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invoices: (data as InvoiceRow[]).map(mapRow),
  });
}

export async function POST(request: NextRequest) {
  const authError = authorizationError(request);
  if (authError) {
    return authError;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const invoice = (await request.json()) as Invoice;
  const totals = calculateTotals(invoice);

  const { data, error } = await supabase
    .from("invoices")
    .upsert(
      {
        id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        client_name: invoice.billTo.name || "Unnamed client",
        status: invoice.status,
        total: totals.total,
        currency: invoice.currency,
        payload: invoice,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, invoice_number, client_name, status, total, currency, updated_at, payload")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invoice: mapRow(data as InvoiceRow),
  });
}
