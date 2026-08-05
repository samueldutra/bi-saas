-- Exponha os schemas ao PostgREST para permitir consultas com
-- supabase.schema('rossetti') e supabase.schema('veneza').
-- Preserve a lista completa de schemas atualmente usada pelo projeto.

ALTER ROLE authenticator SET pgrst.db_schemas =
  'public,graphql_public,okilao,saoluiz,paraiso,lucia,sol,demo,mendes,alvorada,solpet,fago,sophia,gazolla,granero,rossetti,veneza';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
