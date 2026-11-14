-- Despesas / Compras do Painel Empresarial: tipo (despesa, compra, folha), fornecedor e funcionário de cada lançamento de despesa.
-- O valor, a data, a conta, a categoria e se foi pago continuam no próprio lançamento (transactions).
create table if not exists expense_details (
  transaction_id uuid primary key references transactions(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null default 'despesa' check (type in ('despesa', 'compra', 'folha')),
  supplier text not null default '' check (length(supplier) <= 120),
  employee text not null default '' check (length(employee) <= 120),
  group_id uuid,
  installment int check (installment is null or installment >= 1),
  installments int check (installments is null or installments between 1 and 48),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expense_details_workspace_idx on expense_details (workspace_id);
create trigger expense_details_updated_at before update on expense_details for each row execute function set_updated_at();
alter table expense_details enable row level security;
create policy expense_details_select on expense_details for select using (is_member(workspace_id));
create policy expense_details_write on expense_details for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
