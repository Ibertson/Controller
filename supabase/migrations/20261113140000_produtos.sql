-- Produtos da empresa: catálogo com custo, preço de venda e estoque.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  category text not null default '' check (length(category) <= 60),
  description text not null default '' check (length(description) <= 1000),
  sku text not null default '' check (length(sku) <= 40),
  unit text not null default 'un' check (length(unit) <= 10),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  price_cents bigint not null default 0 check (price_cents >= 0),
  stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  -- foto já reduzida no navegador
  photo text check (photo is null or (photo like 'data:image/%' and length(photo) <= 300000)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_workspace_idx on products (workspace_id);
create trigger products_updated_at before update on products for each row execute function set_updated_at();

alter table products enable row level security;
create policy products_select on products for select using (is_member(workspace_id));
create policy products_write on products for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
