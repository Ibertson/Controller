-- Pró-Labore do Painel Empresarial: retiradas do dono, com o faturamento do mês e os lançamentos que cada uma gerou.
-- A despesa fica na empresa; a receita (opcional) fica no espaço pessoal do dono.
create table if not exists pro_labore (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount_cents bigint not null check (amount_cents > 0),
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  expense_tx_id uuid references transactions(id) on delete set null,
  personal_tx_id uuid references transactions(id) on delete set null,
  personal_account_name text not null default '' check (length(personal_account_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pro_labore_workspace_idx on pro_labore (workspace_id, month);
create trigger pro_labore_updated_at before update on pro_labore for each row execute function set_updated_at();
alter table pro_labore enable row level security;
create policy pro_labore_select on pro_labore for select using (is_member(workspace_id));
create policy pro_labore_write on pro_labore for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
