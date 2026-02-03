# Multi-tenant: funcionamento e concessao de acesso

Este documento descreve como o multi-tenant funciona no projeto e como conceder acesso de um usuario a outro tenant no Supabase.

## Visao geral

O sistema usa **multi-tenant por schema** para dados de negocio e **controle de acesso por tabelas no schema public**:

- `public.tenants`: cadastro de tenants (empresa/filial).
- `public.user_profiles`: perfil do usuario, com `role` e `tenant_id` principal.
- `public.user_tenant_access`: acessos adicionais a outros tenants.

Na aplicacao, o usuario pode ter:

- **Tenant principal**: `user_profiles.tenant_id`
- **Acessos extras**: linhas em `user_tenant_access`

## Regras de acesso (RLS)

As politicas de RLS garantem:

- **Superadmin**: acesso total.
- **Admin**: acesso apenas aos tenants que ele ja acessa (tenant principal ou linhas em `user_tenant_access`).
- **User/Viewer**: acesso somente ao tenant principal e seus dados.

Funcoes usadas pelas politicas:

```sql
-- Retorna true se o usuario atual tem acesso ao tenant informado.
-- Regra: tenant principal OU registro em user_tenant_access.
create or replace function public.has_tenant_access(p_tenant_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    (select tenant_id from public.user_profiles where id = auth.uid()) = p_tenant_id
    or exists (
      select 1
      from public.user_tenant_access
      where user_id = auth.uid()
        and tenant_id = p_tenant_id
    );
$$;

-- Usado por funcoes de suporte (ex: get_accessible_tenants)
create or replace function public.is_superadmin(user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from user_profiles
    where id = user_id
      and role = 'superadmin'
  );
end;
$$;
```

Politicas relevantes:

- `user_tenant_access`: **Admins podem gerenciar** acessos **apenas** para tenants que eles ja acessam.
- `tenants`: usuarios podem ver apenas tenants acessiveis (via `has_tenant_access`), superadmin ve todos.
- `user_profiles`: admin so ve/edita usuarios dos tenants que ele acessa.

## Onde isso aparece no app

- Contexto e selecao de tenant:
  - `src/contexts/tenant-context.tsx`
  - `src/hooks/use-accessible-tenants.ts`
- Validacao de acesso:
  - `src/lib/security/tenant-access.ts` (server-side)
- API para gerenciar acessos:
  - `src/app/api/users/tenant-access/route.ts`

## Como conceder acesso a outro tenant

### Opcao 1: SQL direto (mais simples)

Execute no SQL Editor do Supabase (como superadmin ou como admin que ja tem acesso ao tenant destino):

```sql
insert into public.user_tenant_access (user_id, tenant_id, granted_by)
values ('USER_ID_RECEBEDOR', 'TENANT_ID_DESTINO', 'USER_ID_CONCEDENTE')
on conflict (user_id, tenant_id) do nothing;
```

> Se o concedente for **admin**, ele so consegue inserir se ja tiver acesso ao tenant destino.

Para checar isso:

```sql
select public.has_tenant_access('TENANT_ID_DESTINO');
```

### Opcao 2: API do projeto

Endpoint:

```
POST /api/users/tenant-access
```

Payload:

```json
{
  "userId": "USER_ID_RECEBEDOR",
  "tenantId": "TENANT_ID_DESTINO"
}
```

A API respeita as mesmas politicas de RLS.

## Como remover acesso

SQL:

```sql
delete from public.user_tenant_access
where user_id = 'USER_ID_RECEBEDOR'
  and tenant_id = 'TENANT_ID_DESTINO';
```

API:

```
DELETE /api/users/tenant-access?userId=USER_ID_RECEBEDOR&tenantId=TENANT_ID_DESTINO
```

## Observacoes importantes

- Se um admin precisar conceder acesso a um tenant que **ele ainda nao acessa**, um **superadmin** deve conceder o primeiro acesso.
- O campo `user_profiles.tenant_id` e o **tenant principal**. Acesso extra sempre entra em `user_tenant_access`.
- O `user_tenant_access` tem constraint `UNIQUE (user_id, tenant_id)` para evitar duplicidade.

## Exemplo real do caso resolvido

```sql
insert into public.user_tenant_access (user_id, tenant_id, granted_by)
values (
  'f5dee589-4a94-4438-94fe-5961cefa6f16',
  'c3dba297-5d58-40ab-a86a-e67b5babeb96',
  'fa313b5b-17cf-4e29-b1fd-b03119eeadc1'
)
on conflict (user_id, tenant_id) do nothing;
```
