# Regras de Negócio - Módulo de Configurações

Este documento contém todas as regras de negócio do módulo de Configurações.

## Índice

1. [Regras de Permissões](#regras-de-permissões)
2. [Regras de Perfil](#regras-de-perfil)
3. [Regras de Usuários](#regras-de-usuários) ✅ *Atualizado com RN-USER-006*
4. [Regras de Parâmetros](#regras-de-parâmetros)
5. [Regras de Setores](#regras-de-setores)
6. [Regras de Empresas](#regras-de-empresas)
7. [Regras de Filiais Autorizadas](#regras-de-filiais-autorizadas)

---

## Regras de Permissões

### RN-PERM-001: Controle de Acesso por Role

**Descrição**: O sistema possui 4 níveis de roles com permissões hierárquicas.

**Níveis**:
1. `superadmin` - Acesso total ao sistema e todos os tenants
2. `admin` - Acesso administrativo ao próprio tenant
3. `user` - Acesso padrão para operações do tenant
4. `viewer` - Acesso somente leitura

**Matriz de Permissões**:

| Funcionalidade | superadmin | admin | user | viewer |
|----------------|------------|-------|------|--------|
| Ver próprio perfil | ✅ | ✅ | ✅ | ✅ |
| Editar próprio perfil | ✅ | ✅ | ✅ | ✅ |
| Alterar própria senha | ✅ | ✅ | ✅ | ✅ |
| Gerenciar usuários | ✅ | ✅* | ❌ | ❌ |
| Configurar parâmetros | ✅ | ✅ | ❌ | ❌ |
| Gerenciar setores | ✅ | ✅ | ❌ | ❌ |
| Gerenciar empresas | ✅ | ❌ | ❌ | ❌ |
| Trocar de tenant | ✅ | ❌ | ❌ | ❌ |

*Admin não pode criar/editar usuários com role `superadmin`

**Implementação**: [use-permissions.ts](../../../src/hooks/use-permissions.ts)

**Validação**: Server-side em todas as APIs

---

### RN-PERM-002: Isolamento por Tenant

**Descrição**: Usuários só podem acessar dados do próprio tenant, exceto superadmins.

**Regra**:
- Todas as queries devem filtrar por `tenant_id`
- Superadmins podem acessar todos os tenants
- Admin/user/viewer limitados ao próprio tenant

**Exemplo**:
```typescript
// ❌ ERRADO - Retorna todos os usuários
const { data } = await supabase
  .from('user_profiles')
  .select('*')

// ✅ CORRETO - Filtra por tenant
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('tenant_id', currentTenant.id)
```

**Implementação**: [tenant-context.tsx](../../../src/contexts/tenant-context.tsx)

---

### RN-PERM-003: Restrição de Criação de Superadmin

**Descrição**: Admins não podem criar ou editar usuários com role `superadmin`.

**Condição**:
```typescript
if (userProfile.role === 'admin' && formData.role === 'superadmin') {
  return { error: 'Admins cannot create superadmin users' }
}
```

**Implementação**: [src/app/api/users/create/route.ts:58](../../../src/app/api/users/create/route.ts#L58)

**Mensagem de Erro**: "Você não tem permissão para criar usuários com role superadmin"

---

## Regras de Perfil

### RN-PERFIL-001: Campos Editáveis

**Descrição**: Usuários podem editar apenas nome e senha. Email requer processo especial.

**Campos Editáveis**:
- ✅ Nome completo (`full_name`)
- ✅ Senha (requer senha atual para validação)

**Campos Não Editáveis**:
- ❌ Email (requer API específica com Admin SDK)
- ❌ Role (apenas admin/superadmin pode alterar)
- ❌ Tenant (não pode ser alterado)
- ❌ Status (apenas admin/superadmin pode alterar)

**Implementação**:
- [profile-form.tsx](../../../src/components/perfil/profile-form.tsx)
- [password-form.tsx](../../../src/components/perfil/password-form.tsx)

---

### RN-PERFIL-002: Validação de Senha

**Descrição**: Alteração de senha requer validação de senha atual.

**Regras**:
- Senha atual obrigatória
- Nova senha: mínimo 6 caracteres
- Confirmação de senha: deve ser igual à nova senha
- Validação server-side no Supabase Auth

**Exemplo**:
```typescript
const { error } = await supabase.auth.updateUser({
  password: newPassword
})
```

**Implementação**: [password-form.tsx:40-50](../../../src/components/perfil/password-form.tsx#L40-50)

---

### RN-PERFIL-003: Visualização de Informações

**Descrição**: Perfil exibe informações completas do usuário.

**Informações Exibidas**:
- Nome completo
- Email
- Role (formatado como "Super Admin", "Admin", "Usuário", "Visualizador")
- Empresa/Tenant
- Status (Ativo/Inativo)
- Avatar (placeholder - futuro)

**Implementação**: [perfil-content.tsx:15-80](../../../src/components/configuracoes/perfil-content.tsx#L15-80)

---

## Regras de Usuários

### RN-USER-001: Criação de Usuário

**Descrição**: Processo de criação de usuário via Admin SDK do Supabase.

**Fluxo**:
1. Validar permissão (admin ou superadmin)
2. Validar role (admin não pode criar superadmin)
3. Verificar se email já existe
4. Criar usuário no Auth via Admin SDK
5. Criar perfil no `user_profiles`
6. Criar filiais autorizadas (se especificado)

**Campos Obrigatórios**:
- Email (único)
- Nome completo
- Role
- Tenant ID

**Campos Opcionais**:
- Filiais autorizadas (se vazio, acesso a todas)

**Implementação**: [src/app/api/users/create/route.ts](../../../src/app/api/users/create/route.ts)

**Regras de Validação**:
```typescript
// Email deve ser válido
if (!email || !/\S+@\S+\.\S+/.test(email)) {
  return { error: 'Email inválido' }
}

// Nome não pode estar vazio
if (!fullName || fullName.trim().length === 0) {
  return { error: 'Nome completo é obrigatório' }
}

// Role deve ser válida
if (!['superadmin', 'admin', 'user', 'viewer'].includes(role)) {
  return { error: 'Role inválida' }
}
```

---

### RN-USER-002: Edição de Usuário

**Descrição**: Edição de informações do usuário existente.

**Campos Editáveis**:
- Nome completo
- Email (requer API específica)
- Role (com restrições)
- Status (ativo/inativo)
- Filiais autorizadas

**Restrições**:
- Admin não pode editar superadmin
- Não pode editar próprio role
- Tenant não pode ser alterado

**Implementação**:
- [src/app/(dashboard)/usuarios/[id]/editar/page.tsx](../../../src/app/(dashboard)/usuarios/[id]/editar/page.tsx)
- [user-form.tsx](../../../src/components/usuarios/user-form.tsx)

---

### RN-USER-003: Email Único

**Descrição**: Email deve ser único no sistema (não apenas no tenant).

**Validação**:
```sql
-- Verificar se email existe
SELECT id FROM auth.users WHERE email = $1;
```

**Mensagem de Erro**: "Este email já está cadastrado no sistema"

**Implementação**: [src/app/api/users/create/route.ts:70-75](../../../src/app/api/users/create/route.ts#L70-75)

---

### RN-USER-004: Status de Usuário

**Descrição**: Usuários podem ser ativados ou desativados.

**Estados**:
- `true` (Ativo): Usuário pode fazer login e acessar o sistema
- `false` (Inativo): Usuário não pode fazer login

**Operação**:
```typescript
// Desativar usuário
await supabase
  .from('user_profiles')
  .update({ is_active: false })
  .eq('id', userId)
```

**Observação**: Desativação não deleta o usuário, apenas impede acesso.

**Implementação**: [user-form.tsx:150-160](../../../src/components/usuarios/user-form.tsx#L150-160)

---

### RN-USER-005: Listagem com Filtros

**Descrição**: Listagem de usuários suporta filtros e busca.

**Filtros Disponíveis**:
- Busca por nome ou email (case-insensitive)
- Filtro por role
- Filtro por status (ativo/inativo)
- Ordenação por nome, email, role, data de criação

**Exemplo de Query**:
```typescript
let query = supabase
  .from('user_profiles')
  .select('*, tenants(name)')
  .eq('tenant_id', currentTenant.id)

if (search) {
  query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
}

if (roleFilter) {
  query = query.eq('role', roleFilter)
}

const { data } = await query.order('full_name')
```

**Implementação**: [src/app/(dashboard)/usuarios/page.tsx:45-80](../../../src/app/(dashboard)/usuarios/page.tsx#L45-80)

---

### RN-USER-006: Exclusão de Usuário ✅ *Novo*

**Descrição**: Apenas admins e superadmins podem excluir usuários, com restrições de segurança.

**Permissões**: Admin ou Superadmin

**Validações**:
1. ✅ Usuário autenticado com role `admin` ou `superadmin`
2. ✅ `userId` fornecido é válido (UUID)
3. ✅ Usuário a ser deletado existe
4. ✅ Usuário NÃO pode excluir a si mesmo
5. ✅ Admin NÃO pode excluir superadmin
6. ✅ Admin só pode excluir usuários do mesmo tenant
7. ✅ Dialog de confirmação obrigatório no frontend

**Fluxo**:
```typescript
// 1. Frontend: Usuário clica no botão lixeira
const handleDeleteClick = async (user: UserProfile) => {
  setUserToDelete(user)

  // Buscar email para exibir no dialog
  const response = await fetch(`/api/users/get-email?userId=${user.id}`)
  const { email } = await response.json()
  setUserEmail(email)

  setDeleteDialogOpen(true)
}

// 2. Frontend: Usuário confirma exclusão
const handleConfirmDelete = async () => {
  const response = await fetch(`/api/users/delete?userId=${userToDelete.id}`, {
    method: 'DELETE'
  })

  if (response.ok) {
    toast.success('Usuário excluído com sucesso')
    await loadUsers() // Recarrega lista
  }
}

// 3. Backend: Validações e exclusão
const { data: { user } } = await supabase.auth.getUser()

// Validar que não está deletando a si mesmo
if (userIdToDelete === user.id) {
  return { error: 'Cannot delete your own account' }
}

// Validar restrições de role
const { data: userToDelete } = await supabase
  .from('user_profiles')
  .select('role, tenant_id')
  .eq('id', userIdToDelete)
  .single()

if (currentProfile.role === 'admin' && userToDelete.role === 'superadmin') {
  return { error: 'Admins cannot delete superadmins' }
}

if (currentProfile.role === 'admin' && userToDelete.tenant_id !== currentProfile.tenant_id) {
  return { error: 'You can only delete users from your own tenant' }
}

// 4. Deletar via Admin SDK (cascateia para tabelas relacionadas)
const { error } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete)
```

**Cascade Automático** (ON DELETE CASCADE):
- `user_profiles` (perfil do usuário)
- `user_authorized_branches` (filiais autorizadas)
- `user_authorized_modules` (módulos autorizados)
- Outros registros com foreign key para `user_profiles.id`

**UI/UX**:
```jsx
<AlertDialog>
  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
  <AlertDialogDescription>
    Tem certeza que deseja excluir este usuário?

    Nome: {userToDelete.full_name}
    Email: {userEmail}

    ⚠️ Esta ação não pode ser desfeita!
    O usuário será permanentemente removido do sistema.
  </AlertDialogDescription>
  <AlertDialogFooter>
    <AlertDialogCancel>Cancelar</AlertDialogCancel>
    <AlertDialogAction onClick={handleConfirmDelete}>
      Excluir Usuário
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialog>
```

**Mensagens de Erro**:
- `401`: "Not authenticated"
- `400`: "User ID is required"
- `400`: "Cannot delete your own account"
- `403`: "Permission denied" (não é admin/superadmin)
- `403`: "Admins cannot delete superadmins"
- `403`: "You can only delete users from your own tenant"
- `404`: "User not found"
- `500`: "Server configuration incomplete" (sem SUPABASE_SERVICE_ROLE_KEY)
- `500`: "Failed to delete user"

**Implementação**:
- **API**: [src/app/api/users/delete/route.ts](../../../src/app/api/users/delete/route.ts)
- **Frontend**: [src/components/configuracoes/usuarios-content.tsx:118-206](../../../src/components/configuracoes/usuarios-content.tsx#L118-206)

**Observações**:
- ⚠️ **Operação irreversível** - Não há soft delete
- Requer `SUPABASE_SERVICE_ROLE_KEY` configurada no `.env.local`
- Usa Supabase Admin SDK (`supabase.auth.admin.deleteUser`)
- DELETE em `auth.users` cascateia automaticamente para `user_profiles`
- Frontend DEVE mostrar dialog de confirmação
- Logs detalhados no console do servidor para auditoria

---

## Regras de Parâmetros

> Fonte oficial e detalhada deste submódulo:
> [./parametros/BUSINESS_RULES.md](./parametros/BUSINESS_RULES.md)

### Resumo vigente

- parâmetros são armazenados por `tenant_id` e `parameter_key` em `public.tenant_parameters`
- o padrão efetivo para chaves ausentes é `false`
- `enable_descontos_venda` controla visibilidade/acesso operacional do módulo de descontos
- `enable_faturamento_metas` controla a seleção das RPCs de metas com fallback para a versão legada
- qualquer mudança neste fluxo deve atualizar a pasta `docs/modules/configuracoes/parametros/`

---

## Regras de Setores

### RN-SETOR-001: Criação de Setor

**Descrição**: Setores são criados com nome, nível da hierarquia e departamentos do nível selecionado.

**Campos Obrigatórios**:
- Nome (único por tenant)
- `departamento_nivel` (1 a 6)
- `departamento_ids` com ao menos um item

**Implementação**: [src/app/api/setores/route.ts:80-120](../../../src/app/api/setores/route.ts#L80-120)

---

### RN-SETOR-002: Nome Único por Tenant

**Descrição**: Nome do setor deve ser único dentro do tenant (schema).

**Validação**:
```sql
SELECT id FROM {schema}.setores WHERE nome = $1;
```

**Mensagem de Erro**: "Já existe um setor com este nome"

**Implementação**: [src/app/api/setores/route.ts:90-95](../../../src/app/api/setores/route.ts#L90-95)

---

### RN-SETOR-003: Associação com Departamentos

**Descrição**: Setores podem ser associados a múltiplos departamentos, desde que todos pertençam ao mesmo nível da hierarquia.

**Estrutura de Dados**:
```typescript
{
  departamento_nivel: number,
  departamento_ids: number[]
}
```

**Comportamento**:
- O formulário permite múltiplos IDs dentro do nível selecionado
- O backend persiste apenas um `departamento_nivel` por setor
- O mapeamento para departamentos nível 1 é derivado para filtros e validações

**Implementação**: [setores-content.tsx:150-200](../../../src/components/configuracoes/setores-content.tsx#L150-200)

---

### RN-SETOR-004: Não Sobrepor Setores Ativos

**Descrição**: Um setor não pode reutilizar departamentos de nível 1 já consumidos por outro setor ativo do mesmo schema, inclusive quando o cadastro ocorre em níveis 2 a 6.

**Comportamento**:
- O front bloqueia a seleção quando identifica a sobreposição
- A API retorna `409` com a mensagem do banco caso o conflito ainda chegue ao `POST` ou `PUT`
- Na edição, o setor atual é ignorado da própria validação de conflito

**Mensagem de Erro**: "Conflito de setor: departamentos nível 1 {...} já pertencem a outro setor ativo"

---

### RN-SETOR-005: Edição de Setor

**Descrição**: Setores podem ser editados, alterando nome ou departamentos.

**Campos Editáveis**:
- ✅ Nome
- ✅ Departamentos associados

**Restrição**: Não pode alterar para nome já existente (exceto próprio nome).

**Implementação**: [src/app/api/setores/[id]/route.ts](../../../src/app/api/setores/[id]/route.ts)

---

### RN-SETOR-006: Deleção de Setor

**Descrição**: Setores podem ser deletados se não houver dependências.

**Verificações**:
- Verificar se há metas associadas ao setor
- Se houver, impedir deleção

**Mensagem de Erro**: "Não é possível deletar setor com metas associadas"

**SQL**:
```sql
-- Verificar metas associadas
SELECT COUNT(*) FROM {schema}.metas_setor WHERE setor_id = $1;
```

**Implementação**: [src/app/api/setores/[id]/route.ts:80-100](../../../src/app/api/setores/[id]/route.ts#L80-100)

---

### RN-SETOR-007: Carregamento de Departamentos

**Descrição**: Departamentos são carregados por nível para seleção.

**Endpoint**: `GET /api/setores/departamentos?schema={schema}&nivel={1-6}`

**Resposta**:
```typescript
Array<{
  id: number,
  departamento_id: number,
  descricao: string,
  pai_level_2_id?: number | null,
  pai_level_3_id?: number | null,
  pai_level_4_id?: number | null,
  pai_level_5_id?: number | null,
  pai_level_6_id?: number | null
}>
```

**Implementação**: [src/app/api/setores/departamentos/route.ts](../../../src/app/api/setores/departamentos/route.ts)

---

## Regras de Empresas

### RN-EMP-001: Criação de Empresa (Tenant)

**Descrição**: Superadmins podem criar novas empresas (tenants).

**Campos Obrigatórios**:
- Nome da empresa
- Schema do Supabase (identificador único)

**Validação**:
```typescript
// Nome não vazio
if (!name || name.trim().length === 0) {
  return { error: 'Nome é obrigatório' }
}

// Schema alfanumérico, lowercase, sem espaços
if (!/^[a-z0-9_]+$/.test(schema)) {
  return { error: 'Schema inválido' }
}

// Schema único
const exists = await supabase
  .from('tenants')
  .select('id')
  .eq('supabase_schema', schema)
  .single()

if (exists.data) {
  return { error: 'Schema já existe' }
}
```

**Implementação**: [company-form.tsx:80-120](../../../src/components/empresas/company-form.tsx#L80-120)

---

### RN-EMP-002: Schema Único

**Descrição**: Supabase schema deve ser único no sistema.

**Formato**:
- Apenas lowercase
- Apenas letras, números e underscore
- Sem espaços
- Máximo 63 caracteres

**Exemplos**:
- ✅ `okilao`
- ✅ `sao_luiz`
- ✅ `empresa_123`
- ❌ `Okilao` (uppercase)
- ❌ `são luiz` (acento e espaço)
- ❌ `empresa-123` (hífen)

**Implementação**: [company-form.tsx:90-95](../../../src/components/empresas/company-form.tsx#L90-95)

---

### RN-EMP-003: Exposed Schemas

**Descrição**: Schema deve ser adicionado aos "Exposed schemas" do Supabase.

**Processo**:
1. Criar tenant no `public.tenants`
2. Criar schema no PostgreSQL: `CREATE SCHEMA {nome}`
3. Adicionar schema em Supabase Dashboard → Settings → API → Exposed schemas
4. Aguardar 1-2 minutos para propagação
5. Executar migrations no novo schema

**Formato no Supabase**:
```
public, graphql_public, okilao, saoluiz, paraiso, lucia, demo
```

**Referência**: [SUPABASE_SCHEMA_CONFIGURATION.md](../../SUPABASE_SCHEMA_CONFIGURATION.md)

---

### RN-EMP-004: Edição de Empresa

**Descrição**: Empresas podem ter nome editado, mas schema é imutável.

**Campos Editáveis**:
- ✅ Nome da empresa

**Campos Não Editáveis**:
- ❌ Schema (permanente após criação)

**Motivo**: Alterar schema quebraria todas as referências em user_profiles, branches, etc.

**Implementação**: [src/app/(dashboard)/empresas/[id]/editar/page.tsx](../../../src/app/(dashboard)/empresas/[id]/editar/page.tsx)

---

### RN-EMP-005: Deleção de Empresa

**Descrição**: Empresas podem ser deletadas se não houver dependências.

**Verificações**:
1. Verificar usuários associados
2. Verificar filiais ativas
3. Verificar dados no schema

**Mensagem de Erro**: "Não é possível deletar empresa com usuários ou dados associados"

**Recomendação**: Desativar em vez de deletar.

**Implementação**: Não implementado (proteção contra deleção acidental)

---

## Regras de Filiais Autorizadas

### RN-FILIAL-001: Controle de Acesso por Filial

**Descrição**: Usuários podem ter acesso restrito a filiais específicas.

**Comportamento**:
- **Sem restrições** (tabela vazia): Acesso a TODAS as filiais
- **Com restrições** (tabela populada): Acesso apenas às filiais especificadas

**Estrutura**:
```sql
CREATE TABLE user_authorized_branches (
  user_id uuid REFERENCES user_profiles(id),
  branch_id integer REFERENCES branches(id),
  PRIMARY KEY (user_id, branch_id)
);
```

**Implementação**: [use-authorized-branches.ts](../../../src/hooks/use-authorized-branches.ts)

---

### RN-FILIAL-002: Aplicação de Filtros

**Descrição**: Filtros de filiais devem respeitar as autorizações do usuário.

**Lógica**:
```typescript
// Carregar filiais autorizadas
const { authorizedBranches, hasRestrictions } = useAuthorizedBranches(userId)

// Se tem restrições, filtrar branches
const availableBranches = hasRestrictions
  ? branches.filter(b => authorizedBranches.includes(b.id))
  : branches
```

**Implementação**: [branch-selector.tsx:40-60](../../../src/components/usuarios/branch-selector.tsx#L40-60)

---

### RN-FILIAL-003: Gerenciamento de Autorizações

**Descrição**: Admins podem definir filiais autorizadas ao criar/editar usuários.

**Endpoints**:
- `GET /api/users/authorized-branches?userId={id}` - Listar
- `POST /api/users/authorized-branches` - Adicionar múltiplas
- `DELETE /api/users/authorized-branches?userId={id}&branchId={id}` - Remover uma

**Operação em Lote**:
```typescript
// Deletar todas as filiais do usuário
await supabase
  .from('user_authorized_branches')
  .delete()
  .eq('user_id', userId)

// Inserir novas filiais
if (branchIds.length > 0) {
  await supabase
    .from('user_authorized_branches')
    .insert(
      branchIds.map(id => ({ user_id: userId, branch_id: id }))
    )
}
```

**Implementação**: [src/app/api/users/authorized-branches/route.ts](../../../src/app/api/users/authorized-branches/route.ts)

---

### RN-FILIAL-004: Validação de Filiais

**Descrição**: Filiais autorizadas devem pertencer ao tenant do usuário.

**Validação**:
```typescript
// Verificar se todas as filiais pertencem ao tenant
const { data: branches } = await supabase
  .from('branches')
  .select('id')
  .in('id', branchIds)
  .eq('tenant_id', userProfile.tenant_id)

if (branches.length !== branchIds.length) {
  return { error: 'Filiais inválidas para este tenant' }
}
```

**Implementação**: [src/app/api/users/authorized-branches/route.ts:60-70](../../../src/app/api/users/authorized-branches/route.ts#L60-70)

---

### RN-FILIAL-005: Impacto em Relatórios

**Descrição**: Usuários com filiais autorizadas veem apenas dados dessas filiais.

**Aplicação**:
- Filtros de filiais mostram apenas filiais autorizadas
- Queries filtram automaticamente por filiais autorizadas
- "Todas as Filiais" considera apenas as autorizadas

**Exemplo de Query**:
```typescript
let query = supabase
  .from('vendas')
  .select('*')

if (hasRestrictions) {
  query = query.in('filial_id', authorizedBranches)
}
```

**Módulos Afetados**:
- Relatórios (Ruptura, Venda Curva, etc.)
- Metas (Mensal e Setor)
- DRE Gerencial
- Descontos de Venda

---

## Regras de Validação Gerais

### RN-VAL-001: Autenticação Obrigatória

**Descrição**: Todas as rotas e APIs requerem autenticação.

**Validação**:
```typescript
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  return NextResponse.json(
    { error: 'Not authenticated' },
    { status: 401 }
  )
}
```

**Implementação**: Todas as API routes

---

### RN-VAL-002: Validação de Tenant

**Descrição**: Operações devem validar que o usuário pertence ao tenant.

**Validação**:
```typescript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('tenant_id, role')
  .eq('id', user.id)
  .single()

if (profile.tenant_id !== targetTenantId && profile.role !== 'superadmin') {
  return { error: 'Unauthorized' }
}
```

**Implementação**: APIs de usuários, setores, etc.

---

### RN-VAL-003: Sanitização de Inputs

**Descrição**: Todos os inputs do usuário devem ser sanitizados.

**Operações**:
- Trim de strings
- Validação de formato (email, schema, etc.)
- Escape de caracteres especiais em queries dinâmicas
- Validação de tipos (números, booleanos, etc.)

**Implementação**: Em todos os formulários e APIs

---

**Última Atualização**: 2025-01-12
**Versão**: 1.0.0
