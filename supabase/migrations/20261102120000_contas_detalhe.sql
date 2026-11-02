-- Detalhes da conta bancária: banco, etiqueta, dono, cheque especial, cartão de débito, cor e subcontas.
alter table accounts
  add column bank text check (bank is null or length(bank) <= 60),
  add column label text check (label is null or length(label) <= 40),
  add column person_id uuid references people(id) on delete set null,
  -- null = não possui cheque especial
  add column overdraft_cents bigint check (overdraft_cents is null or overdraft_cents >= 0),
  add column has_debit boolean not null default false,
  add column debit_last4 text check (debit_last4 is null or debit_last4 ~ '^[0-9]{4}$'),
  add column debit_brand text check (debit_brand is null or length(debit_brand) <= 20),
  add column color text check (color is null or length(color) <= 20),
  -- subconta (poupança ou caixinha) ligada a outra conta do mesmo espaço
  add column parent_id uuid references accounts(id) on delete set null,
  add column sub_kind text check (sub_kind is null or sub_kind in ('poupanca','caixinha'));
create index on accounts (parent_id);
