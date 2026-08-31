REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_workspace_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_workspace_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;