-- Investimentos: cada aplicação com valor aplicado, valor atual e proventos; e metas de investimento por tipo de ativo.
create table investments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  type text not null check (type in ('tesouro','cdb','acoes','fundos','outros')),
  institution text not null default '' check (length(institution) <= 80),
  invested_cents bigint not null check (invested_cents > 0),
  current_cents bigint check (current_cents >= 0),
  income_cents bigint not null default 0 check (income_cents >= 0),
  rate numeric(7,2),
  bought_on date not null,
  maturity_on date,
  notes text not null default '' check (length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on investments (workspace_id);
create trigger investments_updated_at before update on investments for each row execute function set_updated_at();

alter table investments enable row level security;
create policy investments_select on investments for select using (is_member(workspace_id));
create policy investments_write on investments for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));

create table investment_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  target_cents bigint not null check (target_cents > 0),
  -- null = todos os tipos
  asset_type text check (asset_type in ('tesouro','cdb','acoes','fundos','outros')),
  deadline date,
  description text not null default '' check (length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on investment_goals (workspace_id);
create trigger investment_goals_updated_at before update on investment_goals for each row execute function set_updated_at();

alter table investment_goals enable row level security;
create policy investment_goals_select on investment_goals for select using (is_member(workspace_id));
create policy investment_goals_write on investment_goals for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
