-- Controle de estoque: validade no produto, histórico de entradas e saídas e a função que aplica cada uma.
alter table products add column if not exists expires_on date;

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null default '' check (length(product_name) <= 100),
  kind text not null check (kind in ('in', 'out')),
  qty numeric(14,3) not null check (qty > 0),
  unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents >= 0),
  note text not null default '' check (length(note) <= 300),
  expires_on date,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_ws_day_idx on stock_movements (workspace_id, occurred_on desc);
alter table stock_movements enable row level security;
create policy stock_movements_select on stock_movements for select using (is_member(workspace_id));
create policy stock_movements_write on stock_movements for all using (can_edit(workspace_id)) with check (can_edit(workspace_id));

-- Entrada soma e recalcula o custo médio; saída subtrai sem deixar negativo. Roda com as permissões de quem chama (RLS vale).
create or replace function move_stock(p_product uuid, p_kind text, p_qty numeric, p_unit_cost bigint, p_note text, p_expires date, p_on date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare p products; before numeric; cur date;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Informe uma quantidade maior que zero no estoque.'; end if;
  select * into p from products where id = p_product for update;
  if not found then raise exception 'Produto não encontrado no estoque.'; end if;
  if p_kind = 'out' then
    if p_qty > p.stock then raise exception 'A saída é maior que o estoque atual (%).', p.stock; end if;
    update products set stock = stock - p_qty, expires_on = case when stock - p_qty > 0 then expires_on end where id = p.id returning * into p;
    insert into stock_movements (workspace_id, product_id, product_name, kind, qty, unit_cost_cents, note, occurred_on)
      values (p.workspace_id, p.id, p.name, 'out', p_qty, p.cost_cents, coalesce(p_note, ''), coalesce(p_on, current_date));
  elsif p_kind = 'in' then
    before := greatest(p.stock, 0);
    cur := case when before > 0 then p.expires_on end;
    update products set
      stock = before + p_qty,
      cost_cents = case when p_unit_cost is null then cost_cents else round((before * cost_cents + p_qty * p_unit_cost) / (before + p_qty)) end,
      expires_on = case when p_expires is null then cur when cur is null then p_expires else least(cur, p_expires) end
    where id = p.id returning * into p;
    insert into stock_movements (workspace_id, product_id, product_name, kind, qty, unit_cost_cents, note, expires_on, occurred_on)
      values (p.workspace_id, p.id, p.name, 'in', p_qty, coalesce(p_unit_cost, p.cost_cents), coalesce(p_note, ''), p_expires, coalesce(p_on, current_date));
  else
    raise exception 'Tipo de movimentação inválido no estoque.';
  end if;
  return to_jsonb(p);
end $$;
revoke all on function move_stock(uuid, text, numeric, bigint, text, date, date) from public;
grant execute on function move_stock(uuid, text, numeric, bigint, text, date, date) to authenticated;
