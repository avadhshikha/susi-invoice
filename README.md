# Susi Davies Invoice Studio

A fast branded invoice builder for Susi Davies. It uses Next.js, React, native browser print-to-PDF, and optional Supabase storage through server-side API routes.

The invoice preview uses `public/brand/invoice-background-contact.png` as a fixed `1085 x 1450 px` canvas. All invoice text is layered on top from editable form fields.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If that port is busy, run `npm run dev -- -p 3001`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INVOICE_APP_PIN=choose-a-private-pin
```

The service role key is server-only. Do not expose it as a `NEXT_PUBLIC_` variable.

## Vercel

Push this repo to GitHub, import it into Vercel, then add the same three environment variables in Vercel Project Settings.

## PDF

Use the `Print / PDF` button and choose `Save as PDF` in the browser print dialog.

## Client workflow

- Use `Setup` once to save default currency, tax rate, payment terms, bank details, and notes.
- Use `New service` to save reusable products/services and add them to the current invoice.
- Use `Saved product or service` above the line items to quickly add an existing service to any invoice.
