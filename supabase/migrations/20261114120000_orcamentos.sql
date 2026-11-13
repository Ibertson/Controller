-- Orçamentos da empresa, com link público para o cliente ver, aprovar ou recusar.
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  number int not null check (number > 0),
  kind text not null default 'personalizado' check (kind in ('produtos', 'servico', 'personalizado')),
  category text not null default '' check (length(category) <= 60),
  title text not null default '' check (length(title) <= 160),
  client_name text not null check (length(client_name) between 1 and 120),
  client_phone text not null default '' check (length(client_phone) <= 30),
  client_email text not null default '' check (length(client_email) <= 160),
  issued_on date not null default current_date,
  valid_until date not null,
  status text not null default 'enviado' check (status in ('enviado', 'visualizado', 'aprovado', 'andamento', 'concluido', 'recusado')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and pg_column_size(items) <= 200000),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  notes text not null default '' check (length(notes) <= 4000),
  token uuid not null unique default gen_random_uuid(),
  viewed_at timestamptz,
  company jsonb not null default '{}' check (jsonb_typeof(company) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);
create index if not exists quotes_workspace_idx on quotes (workspace_id);
create trigger quotes_updated_at before update on quotes for each row execute function set_updated_at();
alter table quotes enable row level security;
create policy quotes_select on quotes for select using (is_member(workspace_id));
create policy quotes_write on quotes for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));

-- Link do cliente: devolve o orçamento pelo código e marca como visualizado (a visita de quem é da empresa não conta).
create or replace function public_quote(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r quotes;
begin
  select * into r from quotes where token = p_token;
  if not found then return null; end if;
  if not is_member(r.workspace_id) then
    update quotes set viewed_at = coalesce(viewed_at, now()),
      status = case when status = 'enviado' then 'visualizado' else status end
    where id = r.id returning * into r;
  end if;
  return to_jsonb(r) - 'workspace_id';
end $$;

-- Resposta do cliente pelo link: só enquanto o orçamento aguarda resposta e está na validade.
create or replace function respond_quote(p_token uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r quotes;
begin
  update quotes set status = case when p_accept then 'aprovado' else 'recusado' end, viewed_at = coalesce(viewed_at, now())
  where token = p_token and status in ('enviado', 'visualizado') and valid_until >= current_date
  returning * into r;
  if not found then select * into r from quotes where token = p_token; end if;
  if r.id is null then return null; end if;
  return to_jsonb(r) - 'workspace_id';
end $$;

revoke all on function public_quote(uuid) from public;
revoke all on function respond_quote(uuid, boolean) from public;
grant execute on function public_quote(uuid) to anon, authenticated;
grant execute on function respond_quote(uuid, boolean) to anon, authenticated;
