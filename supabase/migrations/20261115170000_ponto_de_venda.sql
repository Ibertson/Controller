-- Ponto de Venda do Painel Empresarial: cada venda de balcão com itens, pagamento e a receita lançada.
create table if not exists pos_sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  number int not null check (number > 0),
  sold_on date not null,
  -- [{productId, name, qty, unitCents}]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and pg_column_size(items) <= 200000),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  payment_method text not null check (payment_method in ('pix', 'dinheiro', 'debito', 'credito')),
  received_cents bigint check (received_cents is null or received_cents >= 0),
  client_id uuid references clients(id) on delete set null,
  client_name text not null default '' check (length(client_name) <= 120),
  account_id uuid references accounts(id) on delete set null,
  transaction_id uuid,
  status text not null default 'concluida' check (status in ('concluida', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);
create index if not exists pos_sales_ws_day on pos_sales (workspace_id, sold_on);
create trigger pos_sales_updated_at before update on pos_sales for each row execute function set_updated_at();
alter table pos_sales enable row level security;
create policy pos_sales_select on pos_sales for select using (is_member(workspace_id));
create policy pos_sales_write on pos_sales for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
