-- Pedidos do Painel Empresarial: cliente, datas, itens do catálogo, desconto e situação.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  number int not null check (number > 0),
  client_id uuid references clients(id) on delete set null,
  client_name text not null default '' check (length(client_name) <= 120),
  ordered_on date not null,
  delivery_on date,
  notes text not null default '' check (length(notes) <= 2000),
  -- [{id, productId, serviceId, name, description, qty, unitCents}]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and pg_column_size(items) <= 200000),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  status text not null default 'novo' check (status in ('novo', 'preparo', 'pronto', 'entregue', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);
create trigger orders_updated_at before update on orders for each row execute function set_updated_at();
alter table orders enable row level security;
create policy orders_select on orders for select using (is_member(workspace_id));
create policy orders_write on orders for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
