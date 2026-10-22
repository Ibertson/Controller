-- Perfil: telefone, localização, foto e números de WhatsApp de quem está conectado (um por usuário, não por espaço).
create table profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  phone text not null default '' check (length(phone) <= 20),
  location text not null default '' check (length(location) <= 80),
  -- foto já reduzida no navegador (data URL de ~256px)
  avatar text check (avatar is null or (avatar like 'data:image/%' and length(avatar) <= 300000)),
  -- até 5 números: [{ name, personId, phone, primary }]
  whatsapp jsonb not null default '[]' check (jsonb_typeof(whatsapp) = 'array' and jsonb_array_length(whatsapp) <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();

alter table profiles enable row level security;
create policy profiles_own on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- "Excluir Minha Conta": apaga o próprio usuário; espaços, membros e configurações caem junto (on delete cascade).
create function delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
