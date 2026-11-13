-- Agenda / Atividades do Painel Empresarial: quadro A Fazer → Em Progresso → Aguardando Pagamento → Concluído.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_name text not null check (length(client_name) between 1 and 120),
  service_id uuid references services(id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  value_cents bigint not null default 0 check (value_cents >= 0),
  due_on date not null,
  notes text not null default '' check (length(notes) <= 2000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'waiting', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activities_workspace_idx on activities (workspace_id, due_on);
create trigger activities_updated_at before update on activities for each row execute function set_updated_at();
alter table activities enable row level security;
create policy activities_select on activities for select using (is_member(workspace_id));
create policy activities_write on activities for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
