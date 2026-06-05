export type InvoiceStatus = "draft" | "sent" | "paid";

export type CurrencyCode = "CHF" | "EUR" | "GBP" | "USD";

export type InvoiceFontStyle = "modern" | "elegant" | "handwritten";

export type InvoiceDesign = {
  fontStyle: InvoiceFontStyle;
  textScale: number;
};

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

export type InvoiceParty = {
  name: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  taxId?: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: CurrencyCode;
  from: InvoiceParty;
  billTo: InvoiceParty;
  items: InvoiceItem[];
  discountAmount: number;
  taxRate: number;
  notes: string;
  paymentTerms: string;
  bankDetails: string;
  design?: InvoiceDesign;
};

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
};

export type StoredInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  status: InvoiceStatus;
  total: number;
  currency: CurrencyCode;
  updatedAt: string;
  payload: Invoice;
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  CHF: "CHF",
  EUR: "EUR",
  GBP: "GBP",
  USD: "USD",
};

export const DEFAULT_INVOICE_DESIGN: InvoiceDesign = {
  fontStyle: "elegant",
  textScale: 100,
};

export const invoiceTemplates = [
  {
    id: "private-session",
    name: "Private session",
    items: [
      {
        description: "Private yoga, breathwork and movement therapy session",
        quantity: 1,
        rate: 150,
      },
    ],
    notes: "Thank you",
  },
  {
    id: "mentoring",
    name: "Mentoring package",
    items: [
      {
        description: "Mentoring and life coaching package",
        quantity: 1,
        rate: 450,
      },
    ],
    notes: "Sessions are scheduled by mutual agreement.",
  },
  {
    id: "retreat",
    name: "Retreat booking",
    items: [
      {
        description: "Yoga and meditation retreat booking",
        quantity: 1,
        rate: 750,
      },
    ],
    notes: "Retreat balance is due by the date shown on this invoice.",
  },
] as const;

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createInvoiceNumber(sequence: number) {
  const year = new Date().getFullYear();
  return `SD-${year}-${String(sequence).padStart(3, "0")}`;
}

export function createBlankInvoice(sequence = 1): Invoice {
  return {
    id: createId(),
    invoiceNumber: createInvoiceNumber(sequence),
    issueDate: todayIso(),
    dueDate: addDaysIso(14),
    status: "draft",
    currency: "CHF",
    from: {
      name: "Susi Davies",
      email: "hello@susidavies.com",
      phone: "+41 79 854 97 52",
      address: "Switzerland",
      website: "susidavies.com",
      taxId: "",
    },
    billTo: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
    items: [
      {
        id: createId(),
        description: "Private yoga, breathwork and movement therapy session",
        quantity: 1,
        rate: 150,
      },
    ],
    discountAmount: 0,
    taxRate: 0,
    notes: "Thank you",
    paymentTerms: "You need to pay in next 14 days.",
    bankDetails: "Bank transfer details",
    design: DEFAULT_INVOICE_DESIGN,
  };
}

export function createItem(description = "", rate = 0): InvoiceItem {
  return {
    id: createId(),
    description,
    quantity: 1,
    rate,
  };
}

export function calculateTotals(invoice: Invoice): InvoiceTotals {
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + normalizeNumber(item.quantity) * normalizeNumber(item.rate),
    0,
  );
  const discount = Math.min(normalizeNumber(invoice.discountAmount), subtotal);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = taxable * (normalizeNumber(invoice.taxRate) / 100);
  const total = taxable + tax;

  return {
    subtotal,
    discount,
    taxable,
    tax,
    total,
  };
}

export function formatMoney(value: number, currency: CurrencyCode) {
  return `${CURRENCY_SYMBOLS[currency]} ${normalizeNumber(value).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function normalizeNumber(value: number | string | null | undefined) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function getInvoiceDesign(invoice: Invoice): InvoiceDesign {
  const textScale = normalizeNumber(invoice.design?.textScale);

  return {
    fontStyle: invoice.design?.fontStyle || DEFAULT_INVOICE_DESIGN.fontStyle,
    textScale: Math.min(Math.max(textScale || DEFAULT_INVOICE_DESIGN.textScale, 90), 120),
  };
}

export function invoiceToStored(invoice: Invoice): StoredInvoice {
  const totals = calculateTotals(invoice);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.billTo.name || "Unnamed client",
    status: invoice.status,
    total: totals.total,
    currency: invoice.currency,
    updatedAt: new Date().toISOString(),
    payload: invoice,
  };
}
