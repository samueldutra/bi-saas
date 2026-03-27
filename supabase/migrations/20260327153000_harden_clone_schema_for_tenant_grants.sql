REVOKE ALL ON FUNCTION public.clone_schema_for_tenant(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clone_schema_for_tenant(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clone_schema_for_tenant(text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.clone_schema_for_tenant(text) TO service_role;
