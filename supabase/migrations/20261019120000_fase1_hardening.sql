-- Avisos do Security Advisor: search_path fixo e funções SECURITY DEFINER fora do alcance público.
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.add_owner_member() from public, anon, authenticated;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.can_edit(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.can_edit(uuid) to authenticated;
