-- Cartões: banco, final, bandeira, cor e pessoa vinculada (todos opcionais).
alter table cards
  add column bank text,
  add column last4 text check (last4 ~ '^[0-9]{4}$'),
  add column brand text,
  add column color text,
  add column person_id uuid references people(id) on delete set null;
create index on cards (person_id);
