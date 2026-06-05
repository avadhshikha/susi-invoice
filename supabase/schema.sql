create table if not exists public.invoices (
  id uuid primary key,
  invoice_number text not null,
  client_name text,
  status text default 'draft' not null,
  total numeric(12, 2) default 0 not null,
  currency text default 'CHF' not null,
  payload jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists invoices_updated_at_idx
  on public.invoices (updated_at desc);

create index if not exists invoices_invoice_number_idx
  on public.invoices (invoice_number);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists invoices_set_updated_at on public.invoices;

create trigger invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

alter table public.invoices enable row level security;
