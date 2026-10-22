-- Subcategorias: uma categoria pode pertencer a outra (ex.: Alimentação › Delivery).
alter table categories add column parent_id uuid references categories(id) on delete cascade;
create index on categories (parent_id);

-- O mesmo nome pode existir em pais diferentes (Lazer › Outros e Casa › Outros).
alter table categories drop constraint if exists categories_workspace_id_kind_name_key;
alter table categories add constraint categories_workspace_kind_parent_name_key
  unique nulls not distinct (workspace_id, kind, parent_id, name);
