# Fluxo de Integração - Módulo de Configurações

Este documento descreve os fluxos completos de integração do módulo de Configurações.

## Visão Geral

```
Frontend (React) → API Route (Next.js) → Supabase (PostgreSQL) → Database
       ↓                    ↓                        ↓                 ↓
   [page.tsx]         [route.ts]          [Supabase Client]      [tables]
```

---

## Índice

1. [Fluxo: Perfil](#fluxo-perfil)
2. [Fluxo: Usuários](#fluxo-usuários)
3. [Fluxo: Parâmetros](#fluxo-parâmetros)
4. [Fluxo: Setores](#fluxo-setores)
5. [Fluxo: Empresas](#fluxo-empresas)
6. [Fluxo: Filiais Autorizadas](#fluxo-filiais-autorizadas)

---

## Fluxo: Perfil

### 1. Visualização do Perfil

**Arquivo**: [src/components/configuracoes/perfil-content.tsx](../../../src/components/configuracoes/perfil-content.tsx)

#### 1.1. Montagem do Componente

```typescript
// Ao carregar a aba de Perfil
useEffect(() => {
  // 1. Obter usuário do contexto
  const { userProfile, currentTenant } = useTenantContext()

  // 2. Exibir dados do perfil
  setProfileData({
    fullName: userProfile.full_name,
    email: userProfile.email,
    role: userProfile.role,
    tenant: currentTenant.name,
    status: userProfile.is_active
  })
}, [])
```

**Dados Exibidos**:
- Nome completo (editável)
- Email (leitura)
- Role formatado (leitura)
- Empresa/Tenant (leitura)
- Status ativo/inativo (leitura)

---

### 2. Edição de Nome

**Arquivo**: [src/components/perfil/profile-form.tsx](../../../src/components/perfil/profile-form.tsx)

#### 2.1. Fluxo de Atualização

```typescript
// Quando usuário submete o formulário
const handleSubmit = async (data: ProfileFormData) => {
  try {
    // 1. Validar dados
    if (!data.full_name || data.full_name.trim().length < 3) {
      throw new Error('Nome inválido')
    }

    // 2. Atualizar no Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: data.full_name })
      .eq('id', userProfile.id)

    if (error) throw error

    // 3. Recarregar contexto
    await reloadUserProfile()

    // 4. Feedback ao usuário
    toast.success('Nome atualizado com sucesso')

  } catch (error) {
    console.error('Erro ao atualizar nome:', error)
    toast.error('Erro ao atualizar nome')
  }
}
```

**Sequência**:
```
Usuário preenche formulário
        ↓
Valida dados localmente
        ↓
UPDATE user_profiles
        ↓
Recarrega contexto
        ↓
Exibe sucesso
```

---

### 3. Alteração de Senha

**Arquivo**: [src/components/perfil/password-form.tsx](../../../src/components/perfil/password-form.tsx)

#### 3.1. Fluxo de Alteração

```typescript
// Quando usuário submete o formulário
const handleSubmit = async (data: PasswordFormData) => {
  try {
    // 1. Validar senhas
    if (data.newPassword !== data.confirmPassword) {
      throw new Error('Senhas não coincidem')
    }

    if (data.newPassword.length < 6) {
      throw new Error('Senha deve ter no mínimo 6 caracteres')
    }

    // 2. Atualizar senha via Supabase Auth
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: data.newPassword
    })

    if (error) throw error

    // 3. Limpar formulário
    reset()

    // 4. Feedback ao usuário
    toast.success('Senha alterada com sucesso')

  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    toast.error('Erro ao alterar senha')
  }
}
```

**Sequência**:
```
Usuário preenche formulário (senha atual, nova, confirmação)
        ↓
Valida senhas localmente
        ↓
supabase.auth.updateUser({ password })
        ↓
Verifica senha atual no Auth
        ↓
Atualiza senha no auth.users
        ↓
Exibe sucesso
```

**Observação**: Não requer API route, usa diretamente Supabase Auth client-side.

---

## Fluxo: Usuários

### 1. Listagem de Usuários

**Arquivo**: [src/app/(dashboard)/usuarios/page.tsx](../../../src/app/(dashboard)/usuarios/page.tsx)

#### 1.1. Carregamento Inicial

```typescript
// Server Component - carrega dados no servidor
export default async function UsuariosPage() {
  // 1. Criar cliente Supabase server-side
  const supabase = await createClient()

  // 2. Obter usuário autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 3. Obter perfil com tenant
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single()

  // 4. Verificar permissões
  if (!['admin', 'superadmin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // 5. Carregar usuários do tenant
  const { data: users } = await supabase
    .from('user_profiles')
    .select('*, tenants(name)')
    .eq('tenant_id', profile.tenant_id)
    .order('full_name')

  // 6. Renderizar com dados
  return <UsuariosClient users={users} profile={profile} />
}
```

**Sequência**:
```
Página carrega (SSR)
        ↓
Valida autenticação
        ↓
Carrega perfil do usuário
        ↓
Verifica permissões (admin/superadmin)
        ↓
SELECT user_profiles WHERE tenant_id = X
        ↓
Renderiza lista de usuários
```

---

### 2. Criar Novo Usuário

**Arquivos**:
- Frontend: [src/app/(dashboard)/usuarios/novo/page.tsx](../../../src/app/(dashboard)/usuarios/novo/page.tsx)
- Formulário: [src/components/usuarios/user-form.tsx](../../../src/components/usuarios/user-form.tsx)
- API: [src/app/api/users/create/route.ts](../../../src/app/api/users/create/route.ts)

#### 2.1. Frontend - Formulário

```typescript
// Quando usuário submete o formulário
const handleSubmit = async (data: UserFormData) => {
  try {
    setLoading(true)

    // 1. Validar dados
    if (!data.email || !data.full_name || !data.role) {
      throw new Error('Preencha todos os campos obrigatórios')
    }

    // 2. Validar restrição de superadmin
    if (userProfile.role === 'admin' && data.role === 'superadmin') {
      throw new Error('Admins não podem criar superadmins')
    }

    // 3. Chamar API
    const response = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        tenant_id: currentTenant.id,
        authorized_branches: data.authorized_branches || []
      })
    })

    const result = await response.json()

    // 4. Tratar resposta
    if (!response.ok) {
      throw new Error(result.error || 'Erro ao criar usuário')
    }

    // 5. Redirecionar para listagem
    toast.success('Usuário criado com sucesso')
    router.push('/usuarios')

  } catch (error) {
    console.error('Erro:', error)
    toast.error(error.message)
  } finally {
    setLoading(false)
  }
}
```

#### 2.2. Backend - API Route

```typescript
// src/app/api/users/create/route.ts
export async function POST(request: Request) {
  try {
    // 1. Criar cliente Supabase com service_role (Admin SDK)
    const supabase = createClient()

    // 2. Validar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 3. Obter perfil do solicitante
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    // 4. Verificar permissões
    if (!['admin', 'superadmin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 5. Obter dados do body
    const body = await request.json()
    const { email, full_name, role, tenant_id, authorized_branches } = body

    // 6. Validar restrição de superadmin
    if (profile.role === 'admin' && role === 'superadmin') {
      return NextResponse.json(
        { error: 'Admins cannot create superadmin users' },
        { status: 403 }
      )
    }

    // 7. Verificar se email já existe
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email)
    if (existingUser?.user) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // 8. Criar usuário no Auth via Admin SDK
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirmar email
      user_metadata: { full_name }
    })

    if (authError) throw authError

    // 9. Criar perfil em user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUser.user.id,
        tenant_id,
        email,
        full_name,
        role,
        is_active: true
      })

    if (profileError) throw profileError

    // 10. Criar filiais autorizadas (se especificado)
    if (authorized_branches && authorized_branches.length > 0) {
      const branchRecords = authorized_branches.map(branch_id => ({
        user_id: newUser.user.id,
        branch_id
      }))

      const { error: branchError } = await supabase
        .from('user_authorized_branches')
        .insert(branchRecords)

      if (branchError) throw branchError
    }

    // 11. Retornar sucesso
    return NextResponse.json({
      user_id: newUser.user.id,
      email,
      message: 'User created successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Sequência Completa**:
```
Usuário preenche formulário
        ↓
Valida dados (frontend)
        ↓
POST /api/users/create
        ↓
Valida autenticação
        ↓
Valida permissões (admin/superadmin)
        ↓
Valida restrições (admin não cria superadmin)
        ↓
Verifica se email existe (Admin SDK)
        ↓
CREATE USER via Admin SDK (auth.users)
        ↓
INSERT INTO user_profiles
        ↓
INSERT INTO user_authorized_branches (se houver)
        ↓
Retorna sucesso
        ↓
Redireciona para /usuarios
```

**Tabelas Afetadas**:
1. `auth.users` (via Admin SDK)
2. `public.user_profiles`
3. `public.user_authorized_branches` (opcional)

---

### 3. Editar Usuário

**Arquivos**:
- Frontend: [src/app/(dashboard)/usuarios/[id]/editar/page.tsx](../../../src/app/(dashboard)/usuarios/[id]/editar/page.tsx)
- Formulário: [src/components/usuarios/user-form.tsx](../../../src/components/usuarios/user-form.tsx)

#### 3.1. Carregamento de Dados

```typescript
// Server Component - carrega usuário existente
export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // 1. Carregar usuário
  const { data: user } = await supabase
    .from('user_profiles')
    .select('*, tenants(name)')
    .eq('id', params.id)
    .single()

  // 2. Carregar filiais autorizadas
  const { data: authorizedBranches } = await supabase
    .from('user_authorized_branches')
    .select('branch_id')
    .eq('user_id', params.id)

  const branchIds = authorizedBranches?.map(ab => ab.branch_id) || []

  // 3. Renderizar formulário com dados
  return <UserForm mode="edit" initialData={{ ...user, authorized_branches: branchIds }} />
}
```

#### 3.2. Atualização de Dados

```typescript
// Quando usuário submete o formulário
const handleUpdate = async (data: UserFormData) => {
  try {
    setLoading(true)
    const supabase = createClient()

    // 1. Atualizar perfil
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active
      })
      .eq('id', userId)

    if (profileError) throw profileError

    // 2. Atualizar email (se alterado) via API
    if (data.email !== currentEmail) {
      const response = await fetch('/api/users/update-email', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, email: data.email })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error)
      }
    }

    // 3. Atualizar filiais autorizadas via API
    const response = await fetch('/api/users/authorized-branches', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        branch_ids: data.authorized_branches || []
      })
    })

    if (!response.ok) throw new Error('Erro ao atualizar filiais')

    // 4. Sucesso
    toast.success('Usuário atualizado com sucesso')
    router.push('/usuarios')

  } catch (error) {
    console.error('Erro:', error)
    toast.error(error.message)
  } finally {
    setLoading(false)
  }
}
```

**Sequência**:
```
Carrega dados do usuário
        ↓
Usuário edita formulário
        ↓
UPDATE user_profiles (nome, role, status)
        ↓
POST /api/users/update-email (se email mudou)
        ↓
POST /api/users/authorized-branches (filiais)
        ↓
Exibe sucesso
```

---

## Fluxo: Parâmetros

> Fonte oficial e detalhada deste submódulo:
> [./parametros/INTEGRATION_FLOW.md](./parametros/INTEGRATION_FLOW.md)

### Resumo vigente

```text
/configuracoes
  -> ConfiguracoesPage entrega tenantId atual
  -> ParametrosContent lê public.tenant_parameters
  -> updateParameter faz SELECT por tenant_id + parameter_key
  -> se existir: UPDATE por id
  -> se não existir: INSERT da chave
  -> página é recarregada para reaplicar navegação
```

### Consumos relevantes

- `enable_descontos_venda` é consumido em sidebar e na página `/descontos-venda`
- `enable_faturamento_metas` é consumido server-side nas APIs de metas
- o detalhamento completo deve ser mantido apenas na subpasta `parametros/`

---

## Fluxo: Setores

### 1. Listagem de Setores

**Arquivo**: [src/components/configuracoes/setores-content.tsx](../../../src/components/configuracoes/setores-content.tsx)

```typescript
// Ao montar o componente
useEffect(() => {
  loadSetores()
}, [currentTenant])

const loadSetores = async () => {
  try {
    setLoading(true)

    // 1. Chamar API de setores
    const params = new URLSearchParams({
      schema: currentTenant.supabase_schema
    })

    const response = await fetch(`/api/setores?${params}`)
    const data = await response.json()

    // 2. Verificar erro
    if (!response.ok) {
      throw new Error(data.error)
    }

    // 3. Atualizar estado
    setSetores(data)

  } catch (error) {
    console.error('Erro:', error)
    toast.error('Erro ao carregar setores')
  } finally {
    setLoading(false)
  }
}
```

**API**: [src/app/api/setores/route.ts](../../../src/app/api/setores/route.ts)

```typescript
// GET /api/setores
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schema = searchParams.get('schema')

    // 1. Validar autenticação
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // 2. Validar schema
    if (!schema) {
      return NextResponse.json({ error: 'Schema required' }, { status: 400 })
    }

    // 3. Buscar setores do schema
    const { data, error } = await supabase
      .from(`${schema}.setores`)
      .select('*')
      .order('nome')

    if (error) throw error

    // 4. Retornar setores
    return NextResponse.json(data)

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Sequência**:
```
Componente monta
        ↓
GET /api/setores?schema=okilao
        ↓
Valida autenticação
        ↓
SELECT * FROM okilao.setores
        ↓
Retorna JSON com setores
        ↓
Atualiza estado
        ↓
Renderiza lista
```

---

### 2. Criar Setor

**Dialog**: [src/components/configuracoes/setores-content.tsx:150-250](../../../src/components/configuracoes/setores-content.tsx#L150-250)

#### 2.1. Carregamento de Departamentos

```typescript
// Ao abrir o dialog, carregar departamentos por nível
const loadDepartamentos = async () => {
  try {
    const promises = [1, 2, 3, 4, 5, 6].map(async (nivel) => {
      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        nivel: String(nivel)
      })

      const response = await fetch(`/api/setores/departamentos?${params}`)
      const data = await response.json()

      return {
        nivel,
        departamentos: data.departamentos || []
      }
    })

    const results = await Promise.all(promises)
    setDepartamentosPorNivel(results)

  } catch (error) {
    console.error('Erro ao carregar departamentos:', error)
  }
}
```

**API**: [src/app/api/setores/departamentos/route.ts](../../../src/app/api/setores/departamentos/route.ts)

```typescript
// GET /api/setores/departamentos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schema = searchParams.get('schema')
    const nivel = parseInt(searchParams.get('nivel') || '1')

    // 1. Validar parâmetros
    if (!schema || nivel < 1 || nivel > 6) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 2. Buscar departamentos do nível
    const supabase = await createClient()
    const tableName = `${schema}.departments_level_${nivel}`

    const { data, error } = await supabase
      .from(tableName)
      .select('id, descricao')
      .order('descricao')

    if (error) throw error

    // 3. Retornar departamentos
    return NextResponse.json({
      nivel,
      departamentos: data
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 2.2. Criação do Setor

```typescript
// Quando usuário submete o formulário
const handleCreateSetor = async (data: SetorFormData) => {
  try {
    setLoading(true)

    // 1. Validar dados
    if (!data.nome || !data.cor) {
      throw new Error('Preencha todos os campos obrigatórios')
    }

    // 2. Chamar API
    const response = await fetch('/api/setores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema: currentTenant.supabase_schema,
        nome: data.nome,
        cor: data.cor,
        departamento_id_nivel_1: data.departamento_id_nivel_1 || null,
        departamento_id_nivel_2: data.departamento_id_nivel_2 || null,
        departamento_id_nivel_3: data.departamento_id_nivel_3 || null,
        departamento_id_nivel_4: data.departamento_id_nivel_4 || null,
        departamento_id_nivel_5: data.departamento_id_nivel_5 || null,
        departamento_id_nivel_6: data.departamento_id_nivel_6 || null
      })
    })

    const result = await response.json()

    // 3. Tratar resposta
    if (!response.ok) {
      throw new Error(result.error)
    }

    // 4. Recarregar setores
    await loadSetores()

    // 5. Fechar dialog e feedback
    setDialogOpen(false)
    toast.success('Setor criado com sucesso')

  } catch (error) {
    console.error('Erro:', error)
    toast.error(error.message)
  } finally {
    setLoading(false)
  }
}
```

**API**: [src/app/api/setores/route.ts:80-120](../../../src/app/api/setores/route.ts#L80-120)

```typescript
// POST /api/setores
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { schema, nome, cor, ...departamentos } = body

    // 1. Validar autenticação e permissões
    // ... (código de validação)

    // 2. Verificar se nome já existe
    const { data: existing } = await supabase
      .from(`${schema}.setores`)
      .select('id')
      .eq('nome', nome)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Setor com este nome já existe' },
        { status: 400 }
      )
    }

    // 3. Inserir setor
    const { data: setor, error } = await supabase
      .from(`${schema}.setores`)
      .insert({
        nome,
        cor,
        departamento_id_nivel_1: departamentos.departamento_id_nivel_1,
        departamento_id_nivel_2: departamentos.departamento_id_nivel_2,
        departamento_id_nivel_3: departamentos.departamento_id_nivel_3,
        departamento_id_nivel_4: departamentos.departamento_id_nivel_4,
        departamento_id_nivel_5: departamentos.departamento_id_nivel_5,
        departamento_id_nivel_6: departamentos.departamento_id_nivel_6
      })
      .select()
      .single()

    if (error) throw error

    // 4. Retornar setor criado
    return NextResponse.json(setor)

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Sequência Completa**:
```
Usuário abre dialog
        ↓
Carrega departamentos dos 6 níveis em paralelo
        ↓
GET /api/setores/departamentos (6x, uma por nível)
        ↓
Usuário preenche formulário
        ↓
Seleciona departamentos por nível
        ↓
POST /api/setores
        ↓
Valida nome único
        ↓
INSERT INTO {schema}.setores
        ↓
Retorna setor criado
        ↓
Recarrega lista de setores
        ↓
Fecha dialog
```

---

### 3. Editar/Deletar Setor

**Edição**: Similar ao criar, mas usa `PUT /api/setores/[id]`

**Deleção**:
```typescript
// DELETE /api/setores/[id]
const handleDeleteSetor = async (setorId: number) => {
  try {
    // 1. Confirmar com usuário
    if (!confirm('Tem certeza que deseja deletar este setor?')) return

    // 2. Chamar API
    const params = new URLSearchParams({
      schema: currentTenant.supabase_schema
    })

    const response = await fetch(`/api/setores/${setorId}?${params}`, {
      method: 'DELETE'
    })

    // 3. Verificar resposta
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error)
    }

    // 4. Recarregar setores
    await loadSetores()
    toast.success('Setor deletado com sucesso')

  } catch (error) {
    console.error('Erro:', error)
    toast.error(error.message)
  }
}
```

**API verifica dependências**:
```typescript
// Antes de deletar, verificar se há metas associadas
const { data: metas } = await supabase
  .from(`${schema}.metas_setor`)
  .select('id')
  .eq('setor_id', setorId)
  .limit(1)

if (metas && metas.length > 0) {
  return NextResponse.json(
    { error: 'Não é possível deletar setor com metas associadas' },
    { status: 400 }
  )
}
```

---

## Fluxo: Empresas

### 1. Listagem de Empresas

**Arquivo**: [src/app/(dashboard)/empresas/page.tsx](../../../src/app/(dashboard)/empresas/page.tsx)

```typescript
// Server Component - carrega empresas
export default async function EmpresasPage() {
  const supabase = await createClient()

  // 1. Validar que é superadmin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile.role !== 'superadmin') {
    redirect('/dashboard')
  }

  // 2. Carregar todas as empresas
  const { data: tenants } = await supabase
    .from('tenants')
    .select(`
      *,
      branches(count)
    `)
    .order('name')

  // 3. Renderizar
  return <EmpresasClient tenants={tenants} />
}
```

**Sequência**:
```
Página carrega (SSR)
        ↓
Valida autenticação
        ↓
Verifica role = superadmin
        ↓
SELECT * FROM tenants + COUNT(branches)
        ↓
Renderiza lista de empresas
```

---

### 2. Criar Nova Empresa

**Arquivos**:
- Frontend: [src/app/(dashboard)/empresas/nova/page.tsx](../../../src/app/(dashboard)/empresas/nova/page.tsx)
- Formulário: [src/components/empresas/company-form.tsx](../../../src/components/empresas/company-form.tsx)

```typescript
// Quando usuário submete o formulário
const handleCreateTenant = async (data: TenantFormData) => {
  try {
    setLoading(true)
    const supabase = createClient()

    // 1. Validar dados
    if (!data.name || !data.supabase_schema) {
      throw new Error('Preencha todos os campos')
    }

    // 2. Validar formato do schema
    if (!/^[a-z0-9_]+$/.test(data.supabase_schema)) {
      throw new Error('Schema deve conter apenas letras minúsculas, números e underscore')
    }

    // 3. Verificar se schema já existe
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('supabase_schema', data.supabase_schema)
      .single()

    if (existing) {
      throw new Error('Schema já existe')
    }

    // 4. Criar tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name: data.name,
        supabase_schema: data.supabase_schema
      })
      .select()
      .single()

    if (error) throw error

    // 5. Feedback
    toast.success('Empresa criada com sucesso')
    toast.info('Lembre-se de adicionar o schema aos "Exposed schemas" no Supabase')

    // 6. Redirecionar
    router.push(`/empresas/${tenant.id}`)

  } catch (error) {
    console.error('Erro:', error)
    toast.error(error.message)
  } finally {
    setLoading(false)
  }
}
```

**Sequência**:
```
Usuário preenche formulário
        ↓
Valida dados (nome, schema)
        ↓
Verifica schema único
        ↓
INSERT INTO tenants
        ↓
Exibe sucesso + aviso sobre Exposed schemas
        ↓
Redireciona para /empresas/[id]
```

**⚠️ IMPORTANTE**: Após criar empresa:
1. Criar schema no PostgreSQL: `CREATE SCHEMA {nome};`
2. Adicionar aos "Exposed schemas" no Supabase Dashboard
3. Executar migrations no novo schema

---

### 3. Gerenciar Filiais

**Arquivo**: [src/components/empresas/branch-manager.tsx](../../../src/components/empresas/branch-manager.tsx)

#### 3.1. Listar Filiais

```typescript
// Carregar filiais da empresa
useEffect(() => {
  loadBranches()
}, [tenantId])

const loadBranches = async () => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('code')

  if (error) {
    toast.error('Erro ao carregar filiais')
    return
  }

  setBranches(data)
}
```

#### 3.2. Criar Filial

```typescript
// Criar nova filial
const handleCreateBranch = async (data: BranchFormData) => {
  const supabase = createClient()

  const { error } = await supabase
    .from('branches')
    .insert({
      tenant_id: tenantId,
      name: data.name,
      code: data.code,
      is_active: true
    })

  if (error) {
    toast.error('Erro ao criar filial')
    return
  }

  toast.success('Filial criada com sucesso')
  await loadBranches()
}
```

#### 3.3. Editar Filial

```typescript
// Editar filial existente
const handleUpdateBranch = async (branchId: number, data: BranchFormData) => {
  const supabase = createClient()

  const { error } = await supabase
    .from('branches')
    .update({
      name: data.name,
      code: data.code,
      is_active: data.is_active
    })
    .eq('id', branchId)

  if (error) {
    toast.error('Erro ao atualizar filial')
    return
  }

  toast.success('Filial atualizada com sucesso')
  await loadBranches()
}
```

#### 3.4. Deletar Filial

```typescript
// Deletar filial
const handleDeleteBranch = async (branchId: number) => {
  if (!confirm('Tem certeza que deseja deletar esta filial?')) return

  const supabase = createClient()

  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', branchId)

  if (error) {
    toast.error('Erro ao deletar filial')
    return
  }

  toast.success('Filial deletada com sucesso')
  await loadBranches()
}
```

**Sequência de CRUD de Filiais**:
```
Página de detalhes da empresa
        ↓
Renderiza BranchManager
        ↓
SELECT branches WHERE tenant_id = X
        ↓
   [Criar]    [Editar]    [Deletar]
       ↓          ↓           ↓
    INSERT    UPDATE      DELETE
       ↓          ↓           ↓
       └──────────┴───────────┘
                  ↓
          Recarrega lista
```

---

## Fluxo: Filiais Autorizadas

**Arquivos**:
- API: [src/app/api/users/authorized-branches/route.ts](../../../src/app/api/users/authorized-branches/route.ts)
- Componente: [src/components/usuarios/branch-selector.tsx](../../../src/components/usuarios/branch-selector.tsx)

### 1. Listar Filiais Autorizadas

```typescript
// GET /api/users/authorized-branches
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Buscar filiais autorizadas
    const { data, error } = await supabase
      .from('user_authorized_branches')
      .select('branch_id')
      .eq('user_id', userId)

    if (error) throw error

    const branchIds = data.map(ab => ab.branch_id)

    return NextResponse.json({
      user_id: userId,
      branch_ids: branchIds
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

### 2. Atualizar Filiais Autorizadas

```typescript
// POST /api/users/authorized-branches
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, branch_ids } = body

    const supabase = await createClient()

    // 1. Deletar todas as filiais do usuário
    const { error: deleteError } = await supabase
      .from('user_authorized_branches')
      .delete()
      .eq('user_id', user_id)

    if (deleteError) throw deleteError

    // 2. Inserir novas filiais (se houver)
    if (branch_ids && branch_ids.length > 0) {
      const records = branch_ids.map(branch_id => ({
        user_id,
        branch_id
      }))

      const { error: insertError } = await supabase
        .from('user_authorized_branches')
        .insert(records)

      if (insertError) throw insertError
    }

    // 3. Retornar sucesso
    return NextResponse.json({
      user_id,
      branch_ids
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Sequência**:
```
Usuário seleciona filiais no formulário
        ↓
POST /api/users/authorized-branches
        ↓
DELETE FROM user_authorized_branches WHERE user_id = X
        ↓
INSERT INTO user_authorized_branches (user_id, branch_id) VALUES ...
        ↓
Retorna sucesso
```

**Comportamento**:
- Array vazio `[]`: Deletar todas → **Acesso a TODAS as filiais**
- Array com IDs `[1, 2, 3]`: Deletar todas e inserir novas → **Acesso restrito**

---

### 3. Remover Filial Autorizada

```typescript
// DELETE /api/users/authorized-branches
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const branchId = searchParams.get('branchId')

    if (!userId || !branchId) {
      return NextResponse.json(
        { error: 'userId and branchId required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Deletar filial específica
    const { error } = await supabase
      .from('user_authorized_branches')
      .delete()
      .eq('user_id', userId)
      .eq('branch_id', parseInt(branchId))

    if (error) throw error

    return NextResponse.json({ message: 'Branch removed' })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## Diagrama de Fluxo Completo

```
                         MÓDULO DE CONFIGURAÇÕES
                                   |
        ┌──────────────────────────┴──────────────────────────┐
        |                                                       |
   [Perfil]  [Usuários]  [Parâmetros]  [Setores]  [Empresas]
        |         |            |            |            |
        |         |            |            |            |
        ↓         ↓            ↓            ↓            ↓

   UPDATE      API           UPDATE       API         INSERT
 user_profiles create      tenant_par   setores      tenants
                |                                        |
                ↓                                        ↓
            INSERT                                   INSERT
         user_profiles                              branches
                |
                ↓
            INSERT
  user_authorized_branches
```

---

**Última Atualização**: 2025-01-12
**Versão**: 1.0.0
