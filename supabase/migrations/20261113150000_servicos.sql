-- Serviços da empresa (aba Serviços do Painel Empresarial).
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  category text not null default '' check (length(category) <= 60),
  description text not null default '' check (length(description) <= 2000),
  price_cents bigint not null default 0 check (price_cents >= 0),
  hours numeric(8,2) not null default 1 check (hours > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists services_workspace_idx on services (workspace_id);
create trigger services_updated_at before update on services for each row execute function set_updated_at();
alter table services enable row level security;
create policy services_select on services for select using (is_member(workspace_id));
create policy services_write on services for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
