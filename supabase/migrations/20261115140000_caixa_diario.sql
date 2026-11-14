-- Caixa Diário do Painel Empresarial: um caixa por dia, com valor de abertura, reforços, sangrias e a conferência no fechamento.
create table if not exists cash_registers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  day date not null,
  opening_cents bigint not null default 0 check (opening_cents >= 0),
  -- [{id, kind: reforco|sangria|venda, amountCents, reason, at}]
  movements jsonb not null default '[]'::jsonb check (jsonb_typeof(movements) = 'array'),
  status text not null default 'open' check (status in ('open', 'closed')),
  counted_cents bigint check (counted_cents is null or counted_cents >= 0),
  closed_at timestamptz,
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, day)
);
create trigger cash_registers_updated_at before update on cash_registers for each row execute function set_updated_at();
alter table cash_registers enable row level security;
create policy cash_registers_select on cash_registers for select using (is_member(workspace_id));
create policy cash_registers_write on cash_registers for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
