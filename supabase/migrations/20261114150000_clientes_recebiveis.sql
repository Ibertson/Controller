-- Clientes & Recebíveis do Painel Empresarial: clientes da empresa e contas a receber (parcelas), com lixeira.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  phone text not null default '' check (length(phone) <= 30),
  kind text not null default 'eventual' check (kind in ('eventual', 'recorrente')),
  notes text not null default '' check (length(notes) <= 2000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_workspace_idx on clients (workspace_id);
create trigger clients_updated_at before update on clients for each row execute function set_updated_at();
alter table clients enable row level security;
create policy clients_select on clients for select using (is_member(workspace_id));
create policy clients_write on clients for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  group_id uuid not null,
  description text not null check (length(description) between 1 and 200),
  amount_cents bigint not null check (amount_cents > 0),
  due_on date not null,
  client_id uuid references clients(id) on delete set null,
  installment int not null default 1 check (installment >= 1),
  installments int not null default 1 check (installments between 1 and 48 and installment <= installments),
  received_on date,
  transaction_id uuid references transactions(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receivables_workspace_idx on receivables (workspace_id, due_on);
create trigger receivables_updated_at before update on receivables for each row execute function set_updated_at();
alter table receivables enable row level security;
create policy receivables_select on receivables for select using (is_member(workspace_id));
create policy receivables_write on receivables for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
