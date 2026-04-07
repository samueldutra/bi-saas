# Rotas de API - Módulo de Configurações

Este documento contém a documentação completa de todas as rotas de API do módulo de Configurações.

## Índice

1. [APIs de Usuários](#apis-de-usuários)
2. [APIs de Setores](#apis-de-setores)
3. [Autenticação e Permissões](#autenticação-e-permissões)

---

## APIs de Usuários

### POST /api/users/create

**Descrição**: Cria um novo usuário no sistema usando Supabase Admin SDK.

**Arquivo**: [src/app/api/users/create/route.ts](../../../src/app/api/users/create/route.ts)

**Permissões**: Admin ou Superadmin

**Request Body**:
```typescript
{
  email: string                   // Email do usuário (obrigatório, único)
  full_name: string               // Nome completo (obrigatório)
  role: UserRole                  // Role: superadmin, admin, user, viewer
  tenant_id: string               // UUID do tenant (obrigatório)
  authorized_branches?: number[]  // IDs das filiais autorizadas (opcional)
}
```

**Response - Sucesso (200)**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "novo@empresa.com",
  "message": "User created successfully"
}
```

**Response - Erro (400)**:
```json
{
  "error": "Email already exists"
}
```

**Response - Erro (403)**:
```json
{
  "error": "Admins cannot create superadmin users"
}
```

**Exemplo de Uso**:
```typescript
const response = await fetch('/api/users/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'joao.silva@empresa.com',
    full_name: 'João Silva',
    role: 'user',
    tenant_id: currentTenant.id,
    authorized_branches: [1, 2, 3]
  })
})

const result = await response.json()
```

**Fluxo**:
1. Valida autenticação
2. Verifica permissões (admin/superadmin)
3. Valida restrição de role (admin não cria superadmin)
4. Verifica se email já existe
5. Cria usuário no Auth via Admin SDK
6. Cria perfil no `user_profiles`
7. Cria filiais autorizadas (se houver)
8. Retorna sucesso

**Observações**:
- Usa `supabase.auth.admin.createUser()` (service_role)
- Email é auto-confirmado (`email_confirm: true`)
- Senha temporária enviada por email (futuro)

---

### GET /api/users/get-email

**Descrição**: Obtém o email de um usuário pelo ID (necessário porque Admin SDK retorna)

**Arquivo**: [src/app/api/users/get-email/route.ts](../../../src/app/api/users/get-email/route.ts)

**Permissões**: Admin ou Superadmin

**Query Parameters**:
- `userId` (string): UUID do usuário

**Response - Sucesso (200)**:
```json
{
  "email": "usuario@empresa.com"
}
```

**Response - Erro (404)**:
```json
{
  "error": "User not found"
}
```

**Exemplo de Uso**:
```typescript
const params = new URLSearchParams({ userId: '123...' })
const response = await fetch(`/api/users/get-email?${params}`)
const { email } = await response.json()
```

**Fluxo**:
1. Valida autenticação
2. Busca usuário via Admin SDK
3. Retorna email

---

### POST /api/users/update-email

**Descrição**: Atualiza o email de um usuário (requer Admin SDK)

**Arquivo**: [src/app/api/users/update-email/route.ts](../../../src/app/api/users/update-email/route.ts)

**Permissões**: Admin ou Superadmin

**Request Body**:
```typescript
{
  user_id: string                 // UUID do usuário (obrigatório)
  email: string                   // Novo email (obrigatório, único)
}
```

**Response - Sucesso (200)**:
```json
{
  "message": "Email updated successfully"
}
```

**Response - Erro (400)**:
```json
{
  "error": "Email already exists"
}
```

**Exemplo de Uso**:
```typescript
const response = await fetch('/api/users/update-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'novoemail@empresa.com'
  })
})
```

**Fluxo**:
1. Valida autenticação e permissões
2. Verifica se novo email já existe
3. Atualiza email via Admin SDK
4. Atualiza email em `user_profiles`
5. Retorna sucesso

**Observações**:
- Requer Admin SDK (`supabase.auth.admin.updateUserById`)
- Email deve ser único no sistema

---

### DELETE /api/users/delete

**Descrição**: Exclui um usuário do sistema (Auth + Profile + dados relacionados)

**Arquivo**: [src/app/api/users/delete/route.ts](../../../src/app/api/users/delete/route.ts)

**Permissões**: Admin ou Superadmin

**Query Parameters**:
- `userId` (string): UUID do usuário a ser excluído (obrigatório)

**Response - Sucesso (200)**:
```json
{
  "success": true,
  "message": "User deleted successfully",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response - Erro (400)**:
```json
{
  "error": "Cannot delete your own account"
}
```

**Response - Erro (403)**:
```json
{
  "error": "Admins cannot delete superadmins"
}
```

**Response - Erro (404)**:
```json
{
  "error": "User not found"
}
```

**Response - Erro (500)**:
```json
{
  "error": "Configuração do servidor incompleta"
}
```

**Exemplo de Uso**:
```typescript
const response = await fetch(`/api/users/delete?userId=${userId}`, {
  method: 'DELETE'
})

const result = await response.json()

if (response.ok) {
  console.log('Usuário excluído:', result.userId)
} else {
  console.error('Erro:', result.error)
}
```

**Fluxo**:
1. Valida autenticação (cookie de sessão)
2. Verifica permissões (admin ou superadmin)
3. Valida que `userId` foi fornecido
4. Verifica que usuário não está tentando deletar a si mesmo
5. Busca dados do usuário a ser deletado
6. Valida regras de negócio:
   - Admin não pode deletar superadmin
   - Admin só pode deletar usuários do mesmo tenant
7. Deleta usuário via Admin SDK (`supabase.auth.admin.deleteUser`)
8. CASCADE automático deleta registros relacionados:
   - `user_profiles`
   - `user_authorized_branches`
   - `user_authorized_modules`
9. Retorna sucesso

**Regras de Negócio (RN-USER-006)**:
- ✅ Apenas admins e superadmins podem excluir usuários
- ✅ Admins NÃO podem excluir superadmins
- ✅ Admins só podem excluir usuários do mesmo tenant
- ✅ Usuário NÃO pode excluir a si mesmo
- ✅ Dialog de confirmação obrigatório no frontend
- ✅ Exclusão em `auth.users` cascateia para todas as tabelas relacionadas

**Validações da API**:
1. `SUPABASE_SERVICE_ROLE_KEY` deve estar configurada no `.env.local`
2. Usuário autenticado (sessão válida)
3. Role = `admin` ou `superadmin`
4. `userId` é obrigatório
5. `userId` ≠ ID do usuário logado
6. Usuário target existe
7. Se admin: target não é superadmin
8. Se admin: target é do mesmo tenant

**Observações**:
- ⚠️ **Operação irreversível** - Não há como desfazer
- Usa Admin SDK (`supabase.auth.admin.deleteUser`)
- DELETE em `auth.users` cascateia automaticamente
- Frontend deve mostrar dialog de confirmação
- Logs detalhados no console do servidor

**Exemplo Completo (Frontend)**:
```typescript
// 1. Abrir dialog de confirmação
const handleDeleteClick = async (user: UserProfile) => {
  setUserToDelete(user)

  // Buscar email do usuário
  const response = await fetch(`/api/users/get-email?userId=${user.id}`)
  const { email } = await response.json()
  setUserEmail(email)

  setDeleteDialogOpen(true)
}

// 2. Confirmar exclusão
const handleConfirmDelete = async () => {
  try {
    const response = await fetch(`/api/users/delete?userId=${userToDelete.id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (response.ok) {
      toast.success('Usuário excluído com sucesso')
      // Recarregar lista de usuários
      await loadUsers()
    } else {
      toast.error(data.error || 'Erro ao excluir usuário')
    }
  } catch (error) {
    toast.error('Erro inesperado ao excluir usuário')
  }
}
```

---

### GET /api/users/authorized-branches

**Descrição**: Lista as filiais autorizadas de um usuário

**Arquivo**: [src/app/api/users/authorized-branches/route.ts](../../../src/app/api/users/authorized-branches/route.ts)

**Permissões**: Admin ou Superadmin

**Query Parameters**:
- `userId` (string): UUID do usuário

**Response - Sucesso (200)**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "branch_ids": [1, 2, 3, 4]
}
```

**Response - Sucesso (200) - Sem restrições**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "branch_ids": []
}
```

**Exemplo de Uso**:
```typescript
const params = new URLSearchParams({ userId: '123...' })
const response = await fetch(`/api/users/authorized-branches?${params}`)
const { branch_ids } = await response.json()

// Se branch_ids vazio, usuário tem acesso a TODAS as filiais
const hasRestrictions = branch_ids.length > 0
```

**Fluxo**:
1. Valida autenticação e permissões
2. Busca filiais autorizadas no `user_authorized_branches`
3. Retorna array de IDs

---

### POST /api/users/authorized-branches

**Descrição**: Atualiza as filiais autorizadas de um usuário (substituição completa)

**Arquivo**: [src/app/api/users/authorized-branches/route.ts](../../../src/app/api/users/authorized-branches/route.ts)

**Permissões**: Admin ou Superadmin

**Request Body**:
```typescript
{
  user_id: string                 // UUID do usuário (obrigatório)
  branch_ids: number[]            // IDs das filiais autorizadas
}
```

**Response - Sucesso (200)**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "branch_ids": [1, 2, 3]
}
```

**Exemplo de Uso**:
```typescript
// Restringir acesso a filiais específicas
const response = await fetch('/api/users/authorized-branches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    branch_ids: [1, 2, 3]
  })
})

// Remover todas as restrições (acesso a todas)
const response = await fetch('/api/users/authorized-branches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    branch_ids: []
  })
})
```

**Fluxo**:
1. Valida autenticação e permissões
2. Valida que filiais pertencem ao tenant do usuário
3. **Deleta** todas as filiais autorizadas do usuário
4. **Insere** novas filiais (se houver)
5. Retorna sucesso

**Comportamento Importante**:
- `branch_ids: []` → Remove todas as restrições → Acesso a **TODAS** as filiais
- `branch_ids: [1, 2, 3]` → Restringe acesso a filiais 1, 2 e 3

---

### DELETE /api/users/authorized-branches

**Descrição**: Remove uma filial autorizada específica de um usuário

**Arquivo**: [src/app/api/users/authorized-branches/route.ts](../../../src/app/api/users/authorized-branches/route.ts)

**Permissões**: Admin ou Superadmin

**Query Parameters**:
- `userId` (string): UUID do usuário
- `branchId` (number): ID da filial

**Response - Sucesso (200)**:
```json
{
  "message": "Branch removed"
}
```

**Exemplo de Uso**:
```typescript
const params = new URLSearchParams({
  userId: '123e4567-e89b-12d3-a456-426614174000',
  branchId: '3'
})

const response = await fetch(`/api/users/authorized-branches?${params}`, {
  method: 'DELETE'
})
```

**Fluxo**:
1. Valida autenticação e permissões
2. Deleta registro específico de `user_authorized_branches`
3. Retorna sucesso

---

## APIs de Setores

### GET /api/setores

**Descrição**: Lista todos os setores de um tenant (schema)

**Arquivo**: [src/app/api/setores/route.ts](../../../src/app/api/setores/route.ts)

**Permissões**: Admin ou Superadmin

**Query Parameters**:
- `schema` (string): Nome do schema do tenant (obrigatório)
- `include_level1` (boolean): Quando `true`, inclui `departamento_ids_nivel_1` calculado pela RPC `get_setores_com_nivel1`

**Response - Sucesso (200)**:
```json
[
  {
    "id": 1,
    "nome": "Mercearia",
    "departamento_nivel": 2,
    "departamento_ids": [10, 11],
    "departamento_ids_nivel_1": [1, 2, 3],
    "ativo": true,
    "created_at": "2025-01-05T00:00:00.000Z",
    "updated_at": "2025-01-12T15:30:00.000Z"
  },
  {
    "id": 2,
    "nome": "Açougue",
    "departamento_nivel": 1,
    "departamento_ids": [4, 5],
    "departamento_ids_nivel_1": [4, 5],
    "ativo": true,
    "created_at": "2025-01-06T00:00:00.000Z",
    "updated_at": "2025-01-12T15:30:00.000Z"
  }
]
```

**Exemplo de Uso**:
```typescript
const params = new URLSearchParams({ schema: 'okilao' })
const response = await fetch(`/api/setores?${params}`)
const setores = await response.json()
```

**Fluxo**:
1. Valida autenticação e permissões
2. Valida parâmetro `schema`
3. Se `include_level1=true`, usa a RPC `get_setores_com_nivel1`
4. Caso contrário, busca setores com `SELECT * FROM {schema}.setores ORDER BY nome`
5. Retorna array de setores

---

### POST /api/setores

**Descrição**: Cria um novo setor no tenant

**Arquivo**: [src/app/api/setores/route.ts](../../../src/app/api/setores/route.ts)

**Permissões**: Admin ou Superadmin

**Request Body**:
```typescript
{
  schema: string                  // Schema do tenant (obrigatório)
  nome: string                    // Nome do setor (obrigatório, único)
  departamento_nivel: number      // Nível da hierarquia (1-6)
  departamento_ids: number[]      // IDs do nível selecionado
}
```

**Response - Sucesso (200)**:
```json
{
  "id": 3,
  "nome": "Padaria",
  "departamento_nivel": 2,
  "departamento_ids": [20],
  "ativo": true,
  "created_at": "2025-01-12T16:00:00.000Z",
  "updated_at": "2025-01-12T16:00:00.000Z"
}
```

**Response - Erro (409 - nome duplicado)**:
```json
{
  "error": "Setor já existente",
  "message": "Já existe um setor com este nome neste schema.",
  "code": "23505"
}
```

**Response - Erro (409 - conflito com setor ativo)**:
```json
{
  "error": "Conflito de setor",
  "message": "Conflito de setor: departamentos nível 1 {1,2,3} já pertencem a outro setor ativo",
  "code": "23514"
}
```

**Exemplo de Uso**:
```typescript
const response = await fetch('/api/setores', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    schema: 'okilao',
    nome: 'Padaria',
    departamento_nivel: 2,
    departamento_ids: [20]
  })
})

const novoSetor = await response.json()
```

**Fluxo**:
1. Valida autenticação e permissões
2. Valida dados (`schema`, `nome`, `departamento_nivel`, `departamento_ids`)
3. Insere setor no `{schema}.setores`
4. Se o banco detectar nome duplicado ou sobreposição com outro setor ativo, retorna `409`
5. Retorna setor criado

---

### PUT /api/setores/[id]

**Descrição**: Atualiza um setor existente

**Arquivo**: [src/app/api/setores/[id]/route.ts](../../../src/app/api/setores/[id]/route.ts)

**Permissões**: Admin ou Superadmin

**URL Parameter**:
- `id` (number): ID do setor

**Query Parameters**:
- `schema` (string): Nome do schema do tenant

**Request Body**:
```typescript
{
  schema: string                  // Schema do tenant (obrigatório)
  nome: string                    // Novo nome do setor
  departamento_nivel: number      // Nível da hierarquia (1-6)
  departamento_ids: number[]      // IDs do nível selecionado
}
```

**Response - Sucesso (200)**:
```json
{
  "id": 1,
  "nome": "Mercearia Atualizada",
  "departamento_nivel": 1,
  "departamento_ids": [1, 2, 3, 4],
  "ativo": true,
  "created_at": "2025-01-05T00:00:00.000Z",
  "updated_at": "2025-01-12T16:30:00.000Z"
}
```

**Exemplo de Uso**:
```typescript
const params = new URLSearchParams({ schema: 'okilao' })

const response = await fetch(`/api/setores/1?${params}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    schema: 'okilao',
    nome: 'Mercearia Atualizada',
    departamento_nivel: 1,
    departamento_ids: [1, 2, 3, 4]
  })
})

const setorAtualizado = await response.json()
```

**Fluxo**:
1. Valida autenticação e permissões
2. Valida parâmetros (id, schema)
3. Atualiza setor no `{schema}.setores`
4. Se o banco detectar nome duplicado ou sobreposição com outro setor ativo, retorna `409`
5. Retorna setor atualizado

---

### DELETE /api/setores/[id]

**Descrição**: Deleta um setor (se não houver dependências)

**Arquivo**: [src/app/api/setores/[id]/route.ts](../../../src/app/api/setores/[id]/route.ts)

**Permissões**: Admin ou Superadmin

**URL Parameter**:
- `id` (number): ID do setor

**Query Parameters**:
- `schema` (string): Nome do schema do tenant

**Response - Sucesso (200)**:
```json
{
  "message": "Setor deletado com sucesso"
}
```

**Response - Erro (400)**:
```json
{
  "error": "Não é possível deletar setor com metas associadas"
}
```

**Exemplo de Uso**:
```typescript
const params = new URLSearchParams({ schema: 'okilao' })

const response = await fetch(`/api/setores/1?${params}`, {
  method: 'DELETE'
})

if (!response.ok) {
  const { error } = await response.json()
  console.error('Erro:', error)
}
```

**Fluxo**:
1. Valida autenticação e permissões
2. Valida parâmetros (id, schema)
3. **Verifica dependências** (metas associadas)
4. Se não houver dependências, deleta setor
5. Retorna sucesso

**Verificações de Dependências**:
```sql
-- Verifica se há metas associadas ao setor
SELECT COUNT(*) FROM {schema}.metas_setor WHERE setor_id = $1;
```

---

### GET /api/setores/departamentos

**Descrição**: Lista departamentos de um nível específico

**Arquivo**: [src/app/api/setores/departamentos/route.ts](../../../src/app/api/setores/departamentos/route.ts)

**Permissões**: Admin ou Superadmin

**Query Parameters**:
- `schema` (string): Nome do schema do tenant (obrigatório)
- `nivel` (number): Nível do departamento (1-6, obrigatório)
- `include_parents` (boolean): Quando `true` e `nivel=1`, inclui `pai_level_2_id` a `pai_level_6_id`

**Response - Sucesso (200)**:
```json
[
  {
    "id": 1,
    "departamento_id": 1,
    "descricao": "MERCEARIA",
    "pai_level_2_id": 10,
    "pai_level_3_id": 20,
    "pai_level_4_id": null,
    "pai_level_5_id": null,
    "pai_level_6_id": null
  }
]
```

**Exemplo de Uso**:
```typescript
// Carregar todos os níveis em paralelo
const promises = [1, 2, 3, 4, 5, 6].map(async (nivel) => {
  const params = new URLSearchParams({
    schema: 'okilao',
    nivel: String(nivel)
  })

  const response = await fetch(`/api/setores/departamentos?${params}`)
  return await response.json()
})

const departamentosPorNivel = await Promise.all(promises)

// departamentosPorNivel[0] → Nível 1
// departamentosPorNivel[1] → Nível 2
// ...
```

**Fluxo**:
1. Valida autenticação e permissões
2. Valida parâmetros (schema, nivel entre 1-6)
3. Busca departamentos em `{schema}.departments_level_{nivel}`
4. Se `include_parents=true` e `nivel=1`, inclui a hierarquia pai para validação de conflitos no front
5. Retorna array simples de departamentos

**Tabelas Utilizadas**:
- `{schema}.departments_level_1`
- `{schema}.departments_level_2`
- `{schema}.departments_level_3`
- `{schema}.departments_level_4`
- `{schema}.departments_level_5`
- `{schema}.departments_level_6`

---

## Autenticação e Permissões

### Padrão de Validação

Todas as APIs seguem o mesmo padrão de autenticação e validação:

```typescript
export async function HANDLER(request: Request) {
  try {
    // 1. Criar cliente Supabase
    const supabase = await createClient()

    // 2. Validar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // 3. Obter perfil do usuário
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    // 4. Verificar permissões
    if (!['admin', 'superadmin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 5. Lógica da API...

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

### Códigos de Status HTTP

| Código | Descrição | Quando Usar |
|--------|-----------|-------------|
| 200 | OK | Operação bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Parâmetros inválidos ou faltando |
| 401 | Unauthorized | Não autenticado |
| 403 | Forbidden | Sem permissão para a operação |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: email duplicado) |
| 500 | Internal Server Error | Erro no servidor |

---

### Headers Obrigatórios

**Request**:
```
Content-Type: application/json
```

**Response**:
```
Content-Type: application/json
```

---

### Tratamento de Erros

**Formato Padrão de Erro**:
```json
{
  "error": "Mensagem de erro clara e descritiva"
}
```

**Exemplo com Detalhes**:
```json
{
  "error": "Email já existe no sistema",
  "details": {
    "field": "email",
    "value": "duplicado@empresa.com",
    "code": "DUPLICATE_EMAIL"
  }
}
```

---

### Rate Limiting

**Não implementado atualmente**, mas recomendado para produção:
- Limite por IP: 100 requests/minuto
- Limite por usuário: 200 requests/minuto
- Limite para criação de usuários: 10/minuto

---

### CORS

**Configuração Atual**: Same-origin only (Next.js API Routes)

**Para permitir outros origins**:
```typescript
// No handler
const response = NextResponse.json(data)
response.headers.set('Access-Control-Allow-Origin', '*')
response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
return response
```

---

## Exemplos de Uso Completos

### Exemplo 1: Criar Usuário e Definir Filiais

```typescript
async function criarUsuarioComFiliais() {
  try {
    // 1. Criar usuário
    const createResponse = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maria@empresa.com',
        full_name: 'Maria Santos',
        role: 'user',
        tenant_id: currentTenant.id
      })
    })

    if (!createResponse.ok) {
      throw new Error('Erro ao criar usuário')
    }

    const { user_id } = await createResponse.json()

    // 2. Definir filiais autorizadas
    const branchesResponse = await fetch('/api/users/authorized-branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        branch_ids: [1, 2, 3]
      })
    })

    if (!branchesResponse.ok) {
      throw new Error('Erro ao definir filiais')
    }

    toast.success('Usuário criado com sucesso!')
    router.push('/usuarios')

  } catch (error) {
    console.error(error)
    toast.error(error.message)
  }
}
```

---

### Exemplo 2: Criar Setor com Departamentos

```typescript
async function criarSetorCompleto() {
  try {
    // 1. Carregar departamentos
    const departamentosNivel1 = await fetch(
      `/api/setores/departamentos?schema=okilao&nivel=1`
    ).then(r => r.json())

    const departamentosNivel2 = await fetch(
      `/api/setores/departamentos?schema=okilao&nivel=2`
    ).then(r => r.json())

    // 2. Criar setor
    const response = await fetch('/api/setores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema: 'okilao',
        nome: 'Frios e Laticínios',
        cor: '#8B5CF6',
        departamento_id_nivel_1: [1, 2],
        departamento_id_nivel_2: [10, 11, 12]
      })
    })

    if (!response.ok) {
      const { error } = await response.json()
      throw new Error(error)
    }

    const novoSetor = await response.json()
    toast.success(`Setor "${novoSetor.nome}" criado com sucesso!`)

  } catch (error) {
    console.error(error)
    toast.error(error.message)
  }
}
```

---

### Exemplo 3: Listar Usuários com Filiais Autorizadas

```typescript
async function listarUsuariosComFiliais() {
  try {
    const supabase = createClient()

    // 1. Carregar todos os usuários do tenant
    const { data: users } = await supabase
      .from('user_profiles')
      .select('*, tenants(name)')
      .eq('tenant_id', currentTenant.id)
      .order('full_name')

    // 2. Carregar filiais autorizadas de cada usuário em paralelo
    const usersWithBranches = await Promise.all(
      users.map(async (user) => {
        const response = await fetch(
          `/api/users/authorized-branches?userId=${user.id}`
        )
        const { branch_ids } = await response.json()

        return {
          ...user,
          authorized_branches: branch_ids,
          has_restrictions: branch_ids.length > 0
        }
      })
    )

    setUsers(usersWithBranches)

  } catch (error) {
    console.error(error)
    toast.error('Erro ao carregar usuários')
  }
}
```

---

## Segurança

### Práticas Implementadas

✅ **Autenticação obrigatória**: Todas as rotas verificam usuário autenticado

✅ **Validação de permissões**: Role verificado em todas as operações

✅ **Isolamento por tenant**: Queries filtradas por `tenant_id`

✅ **Validação de inputs**: Dados sanitizados e validados

✅ **Admin SDK**: Operações sensíveis usam `service_role`

✅ **RLS ativo**: Row Level Security nas tabelas

### Práticas Recomendadas (Futuro)

⚠️ **Rate limiting**: Limitar requisições por IP/usuário

⚠️ **Logging de auditoria**: Registrar todas as operações

⚠️ **Validação de CSRF**: Tokens CSRF para requests POST/PUT/DELETE

⚠️ **Sanitização SQL**: Usar prepared statements (já feito pelo Supabase)

⚠️ **Timeout**: Limitar tempo de execução das APIs

---

**Última Atualização**: 2025-01-12
**Versão**: 1.0.0
