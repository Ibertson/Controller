-- Link Bio: uma página pública por espaço (empresa), com endereço único.
create table if not exists bio_pages (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  published boolean not null default false,
  -- textos, cores, logo e capa já reduzidas no navegador
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 600000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists bio_pages_updated_at on bio_pages;
create trigger bio_pages_updated_at before update on bio_pages for each row execute function set_updated_at();

alter table bio_pages enable row level security;
-- Dono edita a página do próprio espaço.
create policy bio_pages_own on bio_pages for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));
-- Qualquer pessoa com o link vê a página ativada.
create policy bio_pages_public on bio_pages for select to anon, authenticated using (published);
grant select on bio_pages to anon;
grant select, insert, update, delete on bio_pages to authenticated;
