-- Lembretes de casa, carro, moto e reforma, com data, repetição e pessoa a avisar.
create table reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  type text not null default 'casa' check (type in ('casa','reforma','manutencao','carro','moto','outro')),
  due_on date not null,
  -- 0 = não repete; senão, ao concluir, a data anda esse número de dias
  repeat_days smallint not null default 0 check (repeat_days in (0, 30, 90, 180, 365)),
  -- null = conta principal
  person_id uuid references people(id) on delete set null,
  -- número para o botão "Enviar no WhatsApp" (só dígitos, com DDI), opcional
  whatsapp text check (whatsapp ~ '^[0-9]{10,15}$'),
  notes text not null default '' check (length(notes) <= 500),
  done_at timestamptz,
  last_done_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on reminders (workspace_id);
create trigger reminders_updated_at before update on reminders for each row execute function set_updated_at();

alter table reminders enable row level security;
create policy reminders_select on reminders for select using (is_member(workspace_id));
create policy reminders_write on reminders for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));
