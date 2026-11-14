-- Registrar Despesa: forma de pagamento, histórico e comprovante de cada despesa do Painel Empresarial.
alter table expense_details
  add column if not exists payment_method text not null default '' check (length(payment_method) <= 20),
  add column if not exists notes text not null default '' check (length(notes) <= 1000),
  add column if not exists receipt_path text check (receipt_path is null or length(receipt_path) <= 300);

-- Comprovantes: bucket privado, um arquivo por despesa em <workspace_id>/<uuid>.<ext>, até 5MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- A primeira pasta do caminho é o espaço; só membros leem e só quem edita envia ou apaga.
create or replace function public.receipt_workspace(object_name text) returns uuid
  language sql immutable set search_path = '' as $$
  select case when (storage.foldername(object_name))[1] ~ '^[0-9a-f-]{36}$'
    then ((storage.foldername(object_name))[1])::uuid end
$$;
revoke execute on function public.receipt_workspace(text) from public, anon;
grant execute on function public.receipt_workspace(text) to authenticated;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_member(public.receipt_workspace(name)));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_edit(public.receipt_workspace(name)));
create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.can_edit(public.receipt_workspace(name)))
  with check (bucket_id = 'receipts' and public.can_edit(public.receipt_workspace(name)));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.can_edit(public.receipt_workspace(name)));
