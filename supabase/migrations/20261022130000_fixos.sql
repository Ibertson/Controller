-- Gastos fixos e receitas fixas: valor que se repete todo mês num dia.
-- Ao lançar o mês, vira um lançamento comum com recurring_id apontando para cá.
create table recurring (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  description text not null check (length(description) between 1 and 80),
  amount_cents bigint not null check (amount_cents > 0),
  day smallint not null check (day between 1 and 31),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  start_month date not null check (extract(day from start_month) = 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on recurring (workspace_id);
create trigger recurring_updated_at before update on recurring for each row execute function set_updated_at();

alter table recurring enable row level security;
create policy recurring_select on recurring for select using (is_member(workspace_id));
create policy recurring_write on recurring for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));

alter table transactions add column recurring_id uuid references recurring(id) on delete set null;
create index on transactions (recurring_id);
