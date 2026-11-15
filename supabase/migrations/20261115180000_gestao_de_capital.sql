-- Gestão de Capital do Painel Empresarial: movimentos das categorias de destinação do faturamento.
-- As categorias (nome, %, ícone, cor) ficam em workspaces.details.capitalCategories.
create table if not exists capital_moves (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  category_id text not null check (length(category_id) <= 64),
  category_name text not null default '' check (length(category_name) <= 80),
  kind text not null check (kind in ('distribuicao', 'uso', 'aporte')),
  amount_cents bigint not null check (amount_cents >= 0),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  moved_on date not null,
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists capital_moves_ws_idx on capital_moves (workspace_id, month);
create trigger capital_moves_updated_at before update on capital_moves for each row execute function set_updated_at();
alter table capital_moves enable row level security;
create policy capital_moves_select on capital_moves for select using (is_member(workspace_id));
create policy capital_moves_write on capital_moves for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
