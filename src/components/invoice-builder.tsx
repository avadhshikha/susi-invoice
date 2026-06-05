"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  Download,
  FilePlus2,
  PackagePlus,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  calculateTotals,
  createBlankInvoice,
  createId,
  createItem,
  formatMoney,
  getInvoiceDesign,
  invoiceTemplates,
  invoiceToStored,
  normalizeNumber,
  type CurrencyCode,
  type Invoice,
  type InvoiceFontStyle,
  type InvoiceItem,
  type InvoiceParty,
  type InvoiceStatus,
  type StoredInvoice,
} from "@/lib/invoice";

const STORAGE_KEY = "susi-davies-invoices";
const PIN_KEY = "susi-davies-invoice-pin";
const SETUP_KEY = "susi-davies-business-setup";
const SERVICE_KEY = "susi-davies-product-services";

type SyncState = "checking" | "local" | "locked" | "synced";

type BusinessSetup = {
  currency: CurrencyCode;
  taxRate: number;
  paymentTerms: string;
  bankDetails: string;
  notes: string;
};

type ProductService = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
};

type ApiInvoicesResponse = {
  invoices?: StoredInvoice[];
  message?: string;
};

type ApiSaveResponse = {
  invoice?: StoredInvoice;
  message?: string;
};

const DEFAULT_SETUP: BusinessSetup = {
  currency: "CHF",
  taxRate: 0,
  paymentTerms: "You need to pay in next 14 days.",
  bankDetails: "Bank transfer details",
  notes: "Thank you",
};

const DEFAULT_SERVICES: ProductService[] = invoiceTemplates.map((template) => ({
  id: template.id,
  name: template.name,
  description: template.items[0]?.description || template.name,
  quantity: template.items[0]?.quantity || 1,
  rate: template.items[0]?.rate || 0,
}));

const EMPTY_SERVICE: ProductService = {
  id: "",
  name: "",
  description: "",
  quantity: 1,
  rate: 0,
};

function updatePartyField(
  party: InvoiceParty,
  field: keyof InvoiceParty,
  value: string,
) {
  return {
    ...party,
    [field]: value,
  };
}

function loadLocalInvoices(): StoredInvoice[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredInvoice[]) : [];
  } catch {
    return [];
  }
}

function saveLocalInvoices(invoices: StoredInvoice[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

function loadBusinessSetup(): BusinessSetup {
  try {
    const raw = window.localStorage.getItem(SETUP_KEY);
    if (!raw) {
      return DEFAULT_SETUP;
    }

    const savedSetup = JSON.parse(raw) as BusinessSetup;
    return {
      ...DEFAULT_SETUP,
      ...savedSetup,
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

function saveBusinessSetup(setup: BusinessSetup) {
  window.localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
}

function loadProductServices(): ProductService[] {
  try {
    const raw = window.localStorage.getItem(SERVICE_KEY);
    return raw ? (JSON.parse(raw) as ProductService[]) : DEFAULT_SERVICES;
  } catch {
    return DEFAULT_SERVICES;
  }
}

function saveProductServices(services: ProductService[]) {
  window.localStorage.setItem(SERVICE_KEY, JSON.stringify(services));
}

function applySetupToInvoice(invoice: Invoice, setup: BusinessSetup): Invoice {
  return {
    ...invoice,
    currency: setup.currency,
    taxRate: setup.taxRate,
    paymentTerms: setup.paymentTerms,
    bankDetails: setup.bankDetails,
    notes: setup.notes,
  };
}

function upsertStoredInvoice(invoices: StoredInvoice[], invoice: StoredInvoice) {
  return [invoice, ...invoices.filter((item) => item.id !== invoice.id)].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

async function fetchInvoices(pin: string) {
  const response = await fetch("/api/invoices", {
    headers: pin ? { "x-invoice-pin": pin } : {},
  });
  const body = (await response.json()) as ApiInvoicesResponse;

  if (!response.ok) {
    throw new Error(body.message || "Unable to load invoices.");
  }

  return body.invoices || [];
}

async function saveInvoiceToServer(invoice: Invoice, pin: string) {
  const response = await fetch("/api/invoices", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(pin ? { "x-invoice-pin": pin } : {}),
    },
    body: JSON.stringify(invoice),
  });
  const body = (await response.json()) as ApiSaveResponse;

  if (!response.ok) {
    throw new Error(body.message || "Unable to save invoice.");
  }

  return body.invoice;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[rgba(102,192,240,0.25)] ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[rgba(102,192,240,0.25)] ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[rgba(102,192,240,0.25)] ${props.className || ""}`}
    />
  );
}

function IconButton({
  label,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles = {
    primary:
      "border-[var(--brand-dark)] bg-[var(--brand-dark)] text-white hover:bg-[#1e82a7]",
    secondary:
      "border-slate-200 bg-white text-slate-800 hover:border-[var(--brand-blue)] hover:text-[var(--brand-dark)]",
    ghost:
      "border-transparent bg-transparent text-slate-700 hover:bg-white hover:text-[var(--brand-dark)]",
  };

  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}

export function InvoiceBuilder() {
  const [setup, setSetup] = useState<BusinessSetup>(DEFAULT_SETUP);
  const [invoice, setInvoice] = useState<Invoice>(() =>
    applySetupToInvoice(createBlankInvoice(), DEFAULT_SETUP),
  );
  const [productServices, setProductServices] =
    useState<ProductService[]>(DEFAULT_SERVICES);
  const [savedInvoices, setSavedInvoices] = useState<StoredInvoice[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("private-session");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceDraft, setServiceDraft] =
    useState<ProductService>(EMPTY_SERVICE);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [query, setQuery] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("checking");
  const [syncMessage, setSyncMessage] = useState("Checking sync");
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(() => calculateTotals(invoice), [invoice]);

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return savedInvoices;
    }

    return savedInvoices.filter((item) =>
      `${item.invoiceNumber} ${item.clientName} ${item.status}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, savedInvoices]);

  const replaceSavedInvoices = useCallback((nextInvoices: StoredInvoice[]) => {
    setSavedInvoices(nextInvoices);
    saveLocalInvoices(nextInvoices);
  }, []);

  const refreshInvoices = useCallback(
    async (activePin: string) => {
      try {
        const serverInvoices = await fetchInvoices(activePin);
        setSavedInvoices(serverInvoices);
        saveLocalInvoices(serverInvoices);
        setSyncState("synced");
        setSyncMessage("Supabase synced");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Local storage active";
        const localInvoices = loadLocalInvoices();
        setSavedInvoices(localInvoices);

        if (message.includes("PIN")) {
          setSyncState("locked");
          setSyncMessage("Enter PIN to sync");
        } else {
          setSyncState("local");
          setSyncMessage("Local storage active");
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      const savedPin = window.localStorage.getItem(PIN_KEY) || "";
      const savedSetup = loadBusinessSetup();
      const savedServices = loadProductServices();
      setSetup(savedSetup);
      setProductServices(savedServices);
      setInvoice((current) => applySetupToInvoice(current, savedSetup));
      setPin(savedPin);
      void refreshInvoices(savedPin);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshInvoices]);

  useEffect(() => {
    if (pin) {
      window.localStorage.setItem(PIN_KEY, pin);
    }
  }, [pin]);

  const patchInvoice = (patch: Partial<Invoice>) => {
    setInvoice((current) => ({
      ...current,
      ...patch,
    }));
  };

  const patchParty = (
    party: "from" | "billTo",
    field: keyof InvoiceParty,
    value: string,
  ) => {
    setInvoice((current) => ({
      ...current,
      [party]: updatePartyField(current[party], field, value),
    }));
  };

  const updateItem = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number,
  ) => {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "quantity" || field === "rate"
                  ? normalizeNumber(value)
                  : value,
            }
          : item,
      ),
    }));
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = invoiceTemplates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    setInvoice((current) => ({
      ...current,
      items: template.items.map((item) => ({
        id: createId(),
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
      })),
      notes: template.notes,
    }));
  };

  const saveSetupDefaults = () => {
    saveBusinessSetup(setup);
    setInvoice((current) => applySetupToInvoice(current, setup));
    setIsSetupOpen(false);
  };

  const addItem = () => {
    setInvoice((current) => ({
      ...current,
      items: [...current.items, createItem()],
    }));
  };

  const addProductServiceToInvoice = (service: ProductService) => {
    setInvoice((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId(),
          description: service.description || service.name,
          quantity: service.quantity,
          rate: service.rate,
        },
      ],
    }));
  };

  const addSelectedProductService = () => {
    const service = productServices.find((item) => item.id === selectedServiceId);

    if (service) {
      addProductServiceToInvoice(service);
    }
  };

  const saveProductService = () => {
    const name = serviceDraft.name.trim();
    const description = serviceDraft.description.trim() || name;

    if (!name || !description) {
      return;
    }

    const service: ProductService = {
      id: createId(),
      name,
      description,
      quantity: serviceDraft.quantity || 1,
      rate: serviceDraft.rate || 0,
    };
    const nextServices = [service, ...productServices];

    setProductServices(nextServices);
    saveProductServices(nextServices);
    addProductServiceToInvoice(service);
    setSelectedServiceId(service.id);
    setServiceDraft(EMPTY_SERVICE);
    setIsServiceOpen(false);
  };

  const removeProductService = (id: string) => {
    const nextServices = productServices.filter((service) => service.id !== id);
    setProductServices(nextServices);
    saveProductServices(nextServices);

    if (selectedServiceId === id) {
      setSelectedServiceId("");
    }
  };

  const removeItem = (id: string) => {
    setInvoice((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((item) => item.id !== id),
    }));
  };

  const startNewInvoice = () => {
    const nextInvoice = applySetupToInvoice(
      createBlankInvoice(savedInvoices.length + 1),
      setup,
    );
    setInvoice(nextInvoice);
    setSelectedTemplate("private-session");
  };

  const duplicateInvoice = () => {
    setInvoice((current) => ({
      ...current,
      id: createId(),
      invoiceNumber: `${current.invoiceNumber}-COPY`,
      status: "draft",
    }));
  };

  const saveInvoice = async () => {
    setIsSaving(true);
    const localPayload = invoiceToStored({
      ...invoice,
      id: invoice.id || createId(),
    });

    try {
      const serverInvoice = await saveInvoiceToServer(localPayload.payload, pin);
      const stored = serverInvoice || localPayload;
      const nextInvoices = upsertStoredInvoice(savedInvoices, stored);
      replaceSavedInvoices(nextInvoices);
      setSyncState("synced");
      setSyncMessage("Saved to Supabase");
    } catch (error) {
      const nextInvoices = upsertStoredInvoice(savedInvoices, localPayload);
      replaceSavedInvoices(nextInvoices);
      const message = error instanceof Error ? error.message : "Saved locally";
      setSyncState(message.includes("PIN") ? "locked" : "local");
      setSyncMessage(message.includes("PIN") ? "Saved locally, PIN needed" : "Saved locally");
    } finally {
      setIsSaving(false);
    }
  };

  const loadInvoice = (stored: StoredInvoice) => {
    setInvoice(stored.payload);
    setSelectedTemplate("");
  };

  const printInvoice = () => {
    window.print();
  };

  const statusStyles: Record<SyncState, string> = {
    checking: "bg-slate-100 text-slate-700",
    local: "bg-amber-100 text-amber-900",
    locked: "bg-sky-100 text-sky-900",
    synced: "bg-emerald-100 text-emerald-900",
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-slate-950">
      <header className="no-print border-b border-white/40 bg-[var(--brand-dark)] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-[52px] w-[182px] overflow-hidden rounded-sm bg-[var(--brand-dark)]">
              <Image
                src="/brand/susi-davies-logo.webp"
                alt="Susi Davies"
                width={300}
                height={86}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-sm text-sky-100">Invoice studio</p>
              <h1 className="text-2xl font-semibold">Susi Davies</h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <span
              className={`inline-flex h-9 items-center whitespace-nowrap rounded-md px-3 text-sm font-semibold ${statusStyles[syncState]}`}
            >
              {syncMessage}
            </span>
            <TextInput
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              onBlur={() => void refreshInvoices(pin)}
              placeholder="Sync PIN"
              aria-label="Sync PIN"
              className="border-white/20 bg-white/10 text-white placeholder:text-sky-100 focus:bg-white focus:text-slate-950 sm:w-[150px] sm:min-w-[150px]"
            />
            <ActionButton variant="secondary" onClick={() => setIsSetupOpen(true)}>
              <Settings2 size={17} aria-hidden />
              Setup
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => setIsServiceOpen(true)}>
              <PackagePlus size={17} aria-hidden />
              New service
            </ActionButton>
            <ActionButton variant="secondary" onClick={startNewInvoice}>
              <FilePlus2 size={17} aria-hidden />
              New
            </ActionButton>
            <ActionButton variant="secondary" onClick={duplicateInvoice}>
              <Copy size={17} aria-hidden />
              Duplicate
            </ActionButton>
            <ActionButton variant="primary" onClick={saveInvoice} disabled={isSaving}>
              <Save size={17} aria-hidden />
              {isSaving ? "Saving" : "Save"}
            </ActionButton>
            <ActionButton variant="primary" onClick={printInvoice}>
              <Download size={17} aria-hidden />
              Print / PDF
            </ActionButton>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,460px)_minmax(760px,1fr)_320px]">
        <aside className="no-print space-y-5">
          <section className="tool-panel">
            <div className="section-title">
              <span>Template</span>
              <CalendarDays size={18} aria-hidden />
            </div>
            <Field label="Prebuilt template">
              <Select
                value={selectedTemplate}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                <option value="">Custom invoice</option>
                {invoiceTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="tool-panel">
            <div className="section-title">
              <span>Invoice details</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice number">
                <TextInput
                  value={invoice.invoiceNumber}
                  onChange={(event) =>
                    patchInvoice({ invoiceNumber: event.target.value })
                  }
                />
              </Field>
              <Field label="Status">
                <Select
                  value={invoice.status}
                  onChange={(event) =>
                    patchInvoice({ status: event.target.value as InvoiceStatus })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </Select>
              </Field>
              <Field label="Issue date">
                <TextInput
                  type="date"
                  value={invoice.issueDate}
                  onChange={(event) => patchInvoice({ issueDate: event.target.value })}
                />
              </Field>
              <Field label="Due date">
                <TextInput
                  type="date"
                  value={invoice.dueDate}
                  onChange={(event) => patchInvoice({ dueDate: event.target.value })}
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={invoice.currency}
                  onChange={(event) =>
                    patchInvoice({ currency: event.target.value as CurrencyCode })
                  }
                >
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                </Select>
              </Field>
              <Field label="Tax rate">
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoice.taxRate}
                  onChange={(event) =>
                    patchInvoice({ taxRate: normalizeNumber(event.target.value) })
                  }
                />
              </Field>
            </div>
          </section>

          <section className="tool-panel">
            <div className="section-title">
              <span>Invoice style</span>
            </div>
            <div className="grid gap-3">
              <Field label="Font style">
                <Select
                  value={getInvoiceDesign(invoice).fontStyle}
                  onChange={(event) =>
                    patchInvoice({
                      design: {
                        ...getInvoiceDesign(invoice),
                        fontStyle: event.target.value as InvoiceFontStyle,
                      },
                    })
                  }
                >
                  <option value="modern">Clean modern</option>
                  <option value="elegant">Elegant serif</option>
                  <option value="handwritten">Handwritten accent</option>
                </Select>
              </Field>
              <Field label={`Text size ${getInvoiceDesign(invoice).textScale}%`}>
                <input
                  type="range"
                  min="90"
                  max="120"
                  step="5"
                  value={getInvoiceDesign(invoice).textScale}
                  onChange={(event) =>
                    patchInvoice({
                      design: {
                        ...getInvoiceDesign(invoice),
                        textScale: normalizeNumber(event.target.value),
                      },
                    })
                  }
                  className="h-10 w-full accent-[var(--brand-dark)]"
                />
              </Field>
            </div>
          </section>

          <section className="tool-panel">
            <div className="section-title">
              <span>Bill to</span>
            </div>
            <div className="grid gap-3">
              <Field label="Client name">
                <TextInput
                  value={invoice.billTo.name}
                  onChange={(event) => patchParty("billTo", "name", event.target.value)}
                />
              </Field>
              <Field label="Client email">
                <TextInput
                  type="email"
                  value={invoice.billTo.email}
                  onChange={(event) => patchParty("billTo", "email", event.target.value)}
                />
              </Field>
              <Field label="Client phone">
                <TextInput
                  value={invoice.billTo.phone}
                  onChange={(event) => patchParty("billTo", "phone", event.target.value)}
                />
              </Field>
              <Field label="Client address">
                <TextArea
                  value={invoice.billTo.address}
                  onChange={(event) =>
                    patchParty("billTo", "address", event.target.value)
                  }
                />
              </Field>
            </div>
          </section>

          <section className="tool-panel">
            <div className="section-title">
              <span>Payment details</span>
            </div>
            <div className="grid gap-3">
              <Field label="Payment terms">
                <TextInput
                  value={invoice.paymentTerms}
                  onChange={(event) =>
                    patchInvoice({ paymentTerms: event.target.value })
                  }
                />
              </Field>
              <Field label="Bank details">
                <TextArea
                  value={invoice.bankDetails}
                  onChange={(event) => patchInvoice({ bankDetails: event.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="tool-panel">
            <div className="section-title">
              <span>Notes</span>
            </div>
            <div className="grid gap-3">
              <Field label="Notes">
                <TextArea
                  value={invoice.notes}
                  onChange={(event) => patchInvoice({ notes: event.target.value })}
                />
              </Field>
            </div>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="no-print mb-4 grid gap-3 rounded-md border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur lg:grid-cols-[1fr_120px_120px]">
            <div className="grid gap-3 lg:col-span-3 xl:grid-cols-[1fr_auto] xl:items-end">
              <Field label="Saved product or service">
                <Select
                  value={selectedServiceId}
                  onChange={(event) => setSelectedServiceId(event.target.value)}
                >
                  <option value="">Choose a saved product/service</option>
                  {productServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatMoney(service.rate, invoice.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
              <ActionButton
                variant="secondary"
                onClick={addSelectedProductService}
                disabled={!selectedServiceId}
              >
                <Plus size={17} aria-hidden />
                Add saved
              </ActionButton>
            </div>
            <div className="text-sm font-semibold text-slate-700 lg:col-span-1">
              Line items
            </div>
            <div className="hidden text-sm font-semibold text-slate-700 lg:block">
              Quantity
            </div>
            <div className="hidden text-sm font-semibold text-slate-700 lg:block">
              Rate
            </div>
            {invoice.items.map((item) => (
              <div
                key={item.id}
                className="grid min-w-0 gap-2 rounded-md border border-slate-200 bg-white p-2 lg:col-span-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_44px]"
              >
                <TextInput
                  value={item.description}
                  onChange={(event) =>
                    updateItem(item.id, "description", event.target.value)
                  }
                  aria-label="Item description"
                  placeholder="Description"
                />
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.id, "quantity", event.target.value)
                  }
                  aria-label="Quantity"
                />
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={(event) => updateItem(item.id, "rate", event.target.value)}
                  aria-label="Rate"
                />
                <IconButton
                  label="Remove item"
                  onClick={() => removeItem(item.id)}
                  disabled={invoice.items.length === 1}
                >
                  <Trash2 size={17} aria-hidden />
                </IconButton>
              </div>
            ))}
            <div className="flex flex-col gap-3 lg:col-span-3 lg:flex-row lg:items-center lg:justify-between">
              <ActionButton variant="secondary" onClick={addItem} className="w-full lg:w-auto">
                <Plus size={17} aria-hidden />
                Add item
              </ActionButton>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Discount">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoice.discountAmount}
                    onChange={(event) =>
                      patchInvoice({
                        discountAmount: normalizeNumber(event.target.value),
                      })
                    }
                  />
                </Field>
                <div className="rounded-md bg-[var(--brand-soft)] px-4 py-2 text-right">
                  <div className="text-xs font-semibold text-slate-600">Total</div>
                  <div className="text-xl font-semibold text-[var(--brand-dark)]">
                    {formatMoney(totals.total, invoice.currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <InvoicePreview invoice={invoice} totals={totals} />
        </section>

        <aside className="no-print space-y-4 xl:col-span-2 2xl:col-span-1">
          <section className="tool-panel">
            <div className="section-title">
              <span>Saved invoices</span>
              <span className="text-sm text-slate-500">{savedInvoices.length}</span>
            </div>
            <label className="relative block">
              <Search
                size={17}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search saved invoices"
                className="pl-9"
              />
            </label>
            <div className="mt-4 grid max-h-[calc(100vh-230px)] gap-2 overflow-auto pr-1">
              {filteredInvoices.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No invoices saved yet.
                </div>
              ) : (
                filteredInvoices.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadInvoice(item)}
                    className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--brand-blue)] hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-950">
                        {item.invoiceNumber}
                      </span>
                      <span className="rounded-sm bg-[var(--brand-soft)] px-2 py-1 text-xs font-semibold text-[var(--brand-dark)]">
                        {item.status}
                      </span>
                    </div>
                    <span className="text-sm text-slate-600">{item.clientName}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatMoney(item.total, item.currency)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      {isSetupOpen ? (
        <SetupDialog
          setup={setup}
          onChange={setSetup}
          onClose={() => setIsSetupOpen(false)}
          onSave={saveSetupDefaults}
        />
      ) : null}

      {isServiceOpen ? (
        <ServiceDialog
          draft={serviceDraft}
          services={productServices}
          currency={invoice.currency}
          onDraftChange={setServiceDraft}
          onAddExisting={addProductServiceToInvoice}
          onRemoveExisting={removeProductService}
          onClose={() => setIsServiceOpen(false)}
          onSave={saveProductService}
        />
      ) : null}
    </main>
  );
}

function SetupDialog({
  setup,
  onChange,
  onClose,
  onSave,
}: {
  setup: BusinessSetup;
  onChange: React.Dispatch<React.SetStateAction<BusinessSetup>>;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <section className="modal-panel max-h-[90vh] w-full max-w-3xl overflow-auto">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-dark)]">
              One-time setup
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">
              Invoice defaults
            </h2>
          </div>
          <IconButton label="Close setup" onClick={onClose}>
            <X size={18} aria-hidden />
          </IconButton>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Currency">
            <Select
              value={setup.currency}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  currency: event.target.value as CurrencyCode,
                }))
              }
            >
              <option value="CHF">CHF</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
          <Field label="Default tax rate">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={setup.taxRate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  taxRate: normalizeNumber(event.target.value),
                }))
              }
            />
          </Field>
          <div className="md:col-span-2">
            <div className="section-title mb-2">
              <span>Payment details</span>
            </div>
          </div>
          <Field label="Default payment terms" className="md:col-span-2">
            <TextInput
              value={setup.paymentTerms}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  paymentTerms: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Default bank details" className="md:col-span-2">
            <TextArea
              value={setup.bankDetails}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  bankDetails: event.target.value,
                }))
              }
            />
          </Field>
          <div className="md:col-span-2">
            <div className="section-title mb-2">
              <span>Notes</span>
            </div>
          </div>
          <Field label="Default notes" className="md:col-span-2">
            <TextArea
              value={setup.notes}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton variant="primary" onClick={onSave}>
            <Check size={17} aria-hidden />
            Save setup
          </ActionButton>
        </div>
      </section>
    </div>
  );
}

function ServiceDialog({
  draft,
  services,
  currency,
  onDraftChange,
  onAddExisting,
  onRemoveExisting,
  onClose,
  onSave,
}: {
  draft: ProductService;
  services: ProductService[];
  currency: CurrencyCode;
  onDraftChange: React.Dispatch<React.SetStateAction<ProductService>>;
  onAddExisting: (service: ProductService) => void;
  onRemoveExisting: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <section className="modal-panel max-h-[90vh] w-full max-w-3xl overflow-auto">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-dark)]">
              Product or service
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">
              Add reusable item
            </h2>
          </div>
          <IconButton label="Close service setup" onClick={onClose}>
            <X size={18} aria-hidden />
          </IconButton>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_120px_120px]">
          <Field label="Name">
            <TextInput
              value={draft.name}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Private session"
            />
          </Field>
          <Field label="Quantity">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={draft.quantity}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  quantity: normalizeNumber(event.target.value),
                }))
              }
            />
          </Field>
          <Field label="Rate">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={draft.rate}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  rate: normalizeNumber(event.target.value),
                }))
              }
            />
          </Field>
          <Field label="Invoice description" className="md:col-span-3">
            <TextArea
              value={draft.description}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Description that appears on the invoice"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={onSave}
            disabled={!draft.name.trim()}
          >
            <PackagePlus size={17} aria-hidden />
            Save and add
          </ActionButton>
        </div>

        <div className="mt-7 border-t border-slate-200 pt-5">
          <div className="section-title">
            <span>Saved products/services</span>
            <span className="text-sm text-slate-500">{services.length}</span>
          </div>
          <div className="grid gap-2">
            {services.map((service) => (
              <div
                key={service.id}
                className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <div className="font-semibold text-slate-950">{service.name}</div>
                  <div className="text-sm text-slate-600">
                    {service.description} · {formatMoney(service.rate, currency)}
                  </div>
                </div>
                <ActionButton
                  variant="secondary"
                  onClick={() => onAddExisting(service)}
                >
                  <Plus size={17} aria-hidden />
                  Add
                </ActionButton>
                <IconButton
                  label={`Remove ${service.name}`}
                  onClick={() => onRemoveExisting(service.id)}
                >
                  <Trash2 size={17} aria-hidden />
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function InvoicePreview({
  invoice,
  totals,
}: {
  invoice: Invoice;
  totals: ReturnType<typeof calculateTotals>;
}) {
  const design = getInvoiceDesign(invoice);
  const clientLines = [
    invoice.billTo.name,
    invoice.billTo.address,
    invoice.billTo.phone,
    invoice.billTo.email,
  ].filter(isPresent);
  const hasPayment = isPresent(invoice.paymentTerms) || isPresent(invoice.bankDetails);
  const hasNotes = isPresent(invoice.notes);

  return (
    <div className="invoice-preview-shell">
      <div className="invoice-preview-stage">
        <article
          className={`invoice-page invoice-font-${design.fontStyle}`}
          style={
            {
              "--invoice-text-scale": design.textScale / 100,
            } as React.CSSProperties
          }
          aria-label="Invoice preview"
        >
        <section className="invoice-title-block">
          <h2>Invoice</h2>
          <dl>
            <div>
              <dt>Number</dt>
              <dd>{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{formatInvoiceDate(invoice.issueDate)}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatInvoiceDate(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{invoice.status}</dd>
            </div>
          </dl>
        </section>

        {clientLines.length > 0 ? (
          <section className="invoice-client-block">
            <h3>Bill to</h3>
            <p>
              <strong>{clientLines[0]}</strong>
              {clientLines.length > 1 ? `\n${clientLines.slice(1).join("\n")}` : ""}
            </p>
          </section>
        ) : null}

        {hasPayment ? (
          <section className="invoice-payment-block">
            <h3>Payment</h3>
            <p>
              {isPresent(invoice.paymentTerms) ? (
                <strong>{invoice.paymentTerms.trim()}</strong>
              ) : null}
              {isPresent(invoice.bankDetails)
                ? `${isPresent(invoice.paymentTerms) ? "\n" : ""}${invoice.bankDetails.trim()}`
                : ""}
            </p>
          </section>
        ) : null}

        <section className="invoice-items-block">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description || "Invoice item"}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.rate, invoice.currency)}</td>
                  <td>{formatMoney(item.quantity * item.rate, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="invoice-totals-block">
          <TotalRow label="Subtotal" value={formatMoney(totals.subtotal, invoice.currency)} />
          {totals.discount > 0 ? (
            <TotalRow
              label="Discount"
              value={`-${formatMoney(totals.discount, invoice.currency)}`}
            />
          ) : null}
          {invoice.taxRate > 0 || totals.tax > 0 ? (
            <TotalRow
              label={`Tax (${invoice.taxRate}%)`}
              value={formatMoney(totals.tax, invoice.currency)}
            />
          ) : null}
          <div className="invoice-grand-total">
            <span>Total</span>
            <span>{formatMoney(totals.total, invoice.currency)}</span>
          </div>
        </section>

        {hasNotes ? (
          <section className="invoice-notes-block">
            <h3>Notes</h3>
            <p>{invoice.notes.trim()}</p>
          </section>
        ) : null}
        </article>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-slate-700">
      <span>{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function formatInvoiceDate(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isPresent(value: string | null | undefined) {
  return Boolean(value?.trim());
}
