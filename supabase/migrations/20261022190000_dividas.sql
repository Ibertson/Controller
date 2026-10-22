-- Dívidas parceladas e financiamentos: tipo, valor total, vencimento, juros, categoria, pessoa
-- e, para financiamento, os detalhes do bem, comissão e custos extras.
alter table debts rename column first_due_on to start_on;
alter table debts add column type text not null default 'outro'
  check (type in ('financiamento','emprestimo','informal','consorcio','cartao','outro'));
alter table debts add column total_cents bigint not null default 0 check (total_cents >= 0);
alter table debts add column due_day smallint not null default 10 check (due_day between 1 and 31);
alter table debts add column interest_rate numeric(7,2);
alter table debts add column category text check (category is null or length(category) <= 40);
alter table debts add column person_id uuid references people(id) on delete set null;
alter table debts add column asset_description text not null default '' check (length(asset_description) <= 120);
alter table debts add column commission_cents bigint not null default 0 check (commission_cents >= 0);
alter table debts add column commission_pct numeric(6,2);
alter table debts add column seller text not null default '' check (length(seller) <= 80);
alter table debts add column asset_final_cents bigint check (asset_final_cents >= 0);
alter table debts add column months_to_ready smallint check (months_to_ready between 0 and 600);
-- [{ "name": "IPTU", "amountCents": 12000, "frequency": "unico"|"mensal"|"anual" }]
alter table debts add column extra_costs jsonb not null default '[]' check (jsonb_typeof(extra_costs) = 'array');
alter table debts add column notes text not null default '' check (length(notes) <= 500);
alter table debts add constraint debts_name_len check (length(name) between 1 and 80);
alter table debts add constraint debts_creditor_len check (creditor is null or length(creditor) <= 80);
