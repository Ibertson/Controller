-- Categoria pode valer para despesas e receitas ao mesmo tempo ("Ambos").
alter table categories drop constraint categories_kind_check;
alter table categories add constraint categories_kind_check check (kind in ('expense', 'income', 'both'));
