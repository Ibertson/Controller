-- Fase 1: núcleo pessoal. Postgres no Supabase (auth.users vem do Supabase Auth).
-- Dinheiro em centavos (bigint) + moeda. Datas de lançamento são `date` (dia civil, sem fuso);
-- carimbos de tempo são timestamptz em UTC.

create extension if not exists pgcrypto;

-- updated_at automático ---------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Espaços (perfil pessoal agora; PJ na Fase 3) e membros (casal/família, metas compartilhadas)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'personal' check (kind in ('personal','business')),
  name text not null,
  currency char(3) not null default 'BRL',
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on workspaces (owner_id);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members (user_id);

-- Funções usadas pelas políticas RLS (security definer evita recursão nas políticas)
create or replace function is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m where m.workspace_id = ws and m.user_id = auth.uid())
$$;
create or replace function can_edit(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid() and m.role in ('owner','editor'))
$$;

-- Dono vira membro 'owner' automaticamente
create or replace function add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_members (workspace_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger workspaces_owner_member after insert on workspaces
  for each row execute function add_owner_member();

-- Pessoas (quem gastou/recebeu; não precisam ter login) -------------------------
create table people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  monthly_limit_cents bigint check (monthly_limit_cents >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on people (workspace_id);

-- Contas (manuais, sem integração bancária) -------------------------------------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'checking' check (kind in ('checking','savings','wallet','other')),
  initial_balance_cents bigint not null default 0,
  currency char(3) not null default 'BRL',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on accounts (workspace_id);

-- Cartões de crédito -------------------------------------------------------------
create table cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  limit_cents bigint not null check (limit_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  payment_account_id uuid references accounts(id) on delete set null,
  currency char(3) not null default 'BRL',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on cards (workspace_id);
create index on cards (payment_account_id);

-- Categorias com limite mensal ---------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  kind text not null check (kind in ('expense','income')),
  monthly_limit_cents bigint check (monthly_limit_cents >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, kind, name)
);
create index on categories (workspace_id);

-- Lançamentos ----------------------------------------------------------------------
-- Uma linha por parcela. Compra parcelada = N linhas com o mesmo installment_group_id.
-- Despesa no cartão: card_id preenchido, account_id nulo, statement_month = mês da fatura.
-- Transferência: account_id (origem) + to_account_id (destino), sem categoria.
create table transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('expense','income','transfer','card_payment')),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  occurred_on date not null,
  description text not null default '',
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete restrict,
  to_account_id uuid references accounts(id) on delete restrict,
  card_id uuid references cards(id) on delete restrict,
  statement_month date check (statement_month is null or extract(day from statement_month) = 1),
  person_id uuid references people(id) on delete set null,
  installment_group_id uuid,
  installment_number smallint,
  installment_total smallint,
  is_paid boolean not null default true,
  due_on date,
  source text not null default 'app'
    check (source in ('app','whatsapp_text','whatsapp_audio','whatsapp_photo','import')),
  attachment_path text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_source check (
    case kind
      when 'expense'      then (account_id is null) <> (card_id is null) and to_account_id is null
      when 'income'       then account_id is not null and card_id is null and to_account_id is null
      when 'transfer'     then account_id is not null and to_account_id is not null
                               and account_id <> to_account_id and card_id is null and category_id is null
      when 'card_payment' then account_id is not null and card_id is not null and to_account_id is null
    end),
  constraint card_has_statement check (
    case when kind = 'expense' and card_id is not null then statement_month is not null
         when kind = 'card_payment' then true          -- fatura paga (opcional)
         else statement_month is null end),
  constraint installments check (
    (installment_group_id is null and installment_number is null and installment_total is null)
    or (installment_group_id is not null and installment_total between 2 and 120
        and installment_number between 1 and installment_total)),
  unique (installment_group_id, installment_number)
);
create index on transactions (workspace_id, occurred_on desc);
create index on transactions (category_id);
create index on transactions (account_id);
create index on transactions (to_account_id);
create index on transactions (card_id, statement_month);
create index on transactions (person_id);
create index on transactions (workspace_id, is_paid, due_on) where not is_paid;

-- Metas -----------------------------------------------------------------------------
create table goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  target_cents bigint not null check (target_cents > 0),
  target_date date,
  status text not null default 'active' check (status in ('active','done','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on goals (workspace_id);

create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),  -- negativo = resgate
  contributed_on date not null,
  person_id uuid references people(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on goal_contributions (goal_id);
create index on goal_contributions (workspace_id);

-- Dívidas parceladas ------------------------------------------------------------------
create table debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  creditor text,
  installment_cents bigint not null check (installment_cents > 0),
  installments_total smallint not null check (installments_total > 0),
  installments_paid smallint not null default 0,
  first_due_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (installments_paid between 0 and installments_total)
);
create index on debts (workspace_id);

-- Fechamento do mês (fotografia do resumo; meses fechados ficam só leitura na UI) ------
create table month_closings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  income_cents bigint not null,
  expense_cents bigint not null,
  balance_cents bigint not null,
  summary jsonb not null default '{}',   -- por categoria / pessoa / conta
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz not null default now(),
  unique (workspace_id, month)
);

-- Preferências por usuário (menu personalizado etc.) ----------------------------------
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_workspace_id uuid references workspaces(id) on delete set null,
  menu jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Visões de saldo -----------------------------------------------------------------------
create view account_balances with (security_invoker = true) as
select a.id as account_id, a.workspace_id,
       a.initial_balance_cents
       + coalesce(sum(case
           when t.kind = 'income' and t.account_id = a.id then t.amount_cents
           when t.kind in ('expense','card_payment') and t.account_id = a.id then -t.amount_cents
           when t.kind = 'transfer' and t.account_id = a.id then -t.amount_cents
           when t.kind = 'transfer' and t.to_account_id = a.id then t.amount_cents
         end) filter (where t.is_paid), 0) as balance_cents
from accounts a
left join transactions t on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

create view card_usage with (security_invoker = true) as
select c.id as card_id, c.workspace_id, c.limit_cents,
       coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)
       - coalesce(sum(t.amount_cents) filter (where t.kind = 'card_payment'), 0) as used_cents
from cards c
left join transactions t on t.card_id = c.id
group by c.id;

-- triggers updated_at -------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['workspaces','people','accounts','cards','categories','transactions','goals','debts','user_settings'] loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- RLS: membros leem; owner/editor escrevem -------------------------------------------------
alter table workspaces enable row level security;
create policy ws_select on workspaces for select using (is_member(id));
create policy ws_insert on workspaces for insert with check (owner_id = auth.uid());
create policy ws_update on workspaces for update using (owner_id = auth.uid());
create policy ws_delete on workspaces for delete using (owner_id = auth.uid());

alter table workspace_members enable row level security;
create policy wm_select on workspace_members for select using (is_member(workspace_id));
create policy wm_write on workspace_members for all
  using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

do $$ declare t text; begin
  foreach t in array array['people','accounts','cards','categories','transactions','goals','goal_contributions','debts','month_closings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_select on %I for select using (is_member(workspace_id))', t, t);
    execute format('create policy %I_write on %I for all using (can_edit(workspace_id)) with check (can_edit(workspace_id))', t, t);
  end loop;
end $$;

alter table user_settings enable row level security;
create policy us_own on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
