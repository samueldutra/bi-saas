# Estruturas de Dados - Módulo de Configurações

Este documento contém todas as estruturas de dados, tipos TypeScript e interfaces utilizadas no módulo de Configurações.

## Índice

1. [Tipos de Database](#tipos-de-database)
2. [Tipos de Usuário](#tipos-de-usuário)
3. [Tipos de Empresa](#tipos-de-empresa)
4. [Tipos de Filial](#tipos-de-filial)
5. [Tipos de Setor](#tipos-de-setor)
6. [Tipos de Parâmetros](#tipos-de-parâmetros)
7. [Tipos de Formulários](#tipos-de-formulários)
8. [Enums e Constantes](#enums-e-constantes)

---

## Tipos de Database

### `Database` (Gerado pelo Supabase)

**Descrição**: Tipos gerados automaticamente pelo Supabase baseados no schema do banco.

**Localização**: [src/types/database.types.ts](../../../src/types/database.types.ts)

**Tabelas Principais**:
```typescript
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant
        Insert: TenantInsert
        Update: TenantUpdate
      }
      user_profiles: {
        Row: UserProfile
        Insert: UserProfileInsert
        Update: UserProfileUpdate
      }
      branches: {
        Row: Branch
        Insert: BranchInsert
        Update: BranchUpdate
      }
      user_authorized_branches: {
        Row: UserAuthorizedBranch
        Insert: UserAuthorizedBranchInsert
        Update: UserAuthorizedBranchUpdate
      }
      tenant_parameters: {
        Row: TenantParameters
        Insert: TenantParametersInsert
        Update: TenantParametersUpdate
      }
    }
  }
}
```

---

## Tipos de Usuário

### `UserProfile`

**Descrição**: Perfil completo de um usuário do sistema.

**Definição**:
```typescript
export type UserProfile = {
  id: string                      // UUID do usuário (FK para auth.users)
  tenant_id: string               // UUID do tenant (empresa)
  email: string                   // Email do usuário (único)
  full_name: string               // Nome completo
  role: UserRole                  // Role (superadmin, admin, user, viewer)
  is_active: boolean              // Status de ativação
  created_at: string              // Data de criação (ISO 8601)
  updated_at: string              // Data de atualização (ISO 8601)
}
```

**Exemplo**:
```typescript
const userProfile: UserProfile = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  tenant_id: "987f6543-e21a-34b5-c678-123456789abc",
  email: "joao.silva@okilao.com.br",
  full_name: "João Silva",
  role: "admin",
  is_active: true,
  created_at: "2025-01-12T10:30:00.000Z",
  updated_at: "2025-01-12T10:30:00.000Z"
}
```

**Uso**: Armazenado em contexto, usado em todas as operações

---

### `UserRole`

**Descrição**: Enum de roles de usuário.

**Definição**:
```typescript
export type UserRole =
  | 'superadmin'  // Acesso total ao sistema
  | 'admin'       // Administrador do tenant
  | 'user'        // Usuário padrão
  | 'viewer'      // Somente leitura
```

**Mapeamento de Labels**:
```typescript
export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  user: 'Usuário',
  viewer: 'Visualizador'
}
```

**Uso**: [use-permissions.ts](../../../src/hooks/use-permissions.ts)

---

### `UserWithTenant`

**Descrição**: UserProfile com dados do tenant (join).

**Definição**:
```typescript
export type UserWithTenant = UserProfile & {
  tenants: {
    id: string
    name: string
    supabase_schema: string
  }
}
```

**Exemplo de Query**:
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select('*, tenants(id, name, supabase_schema)')
  .eq('id', userId)
  .single()
```

**Uso**: Listagem de usuários

---

### `UserFormData`

**Descrição**: Dados do formulário de criação/edição de usuário.

**Definição**:
```typescript
export type UserFormData = {
  email: string                   // Email (obrigatório)
  full_name: string               // Nome completo (obrigatório)
  role: UserRole                  // Role (obrigatório)
  is_active: boolean              // Status (padrão: true)
  authorized_branches?: number[]  // IDs das filiais autorizadas (opcional)
}
```

**Validação com Zod**:
```typescript
const userFormSchema = z.object({
  email: z.string().email('Email inválido'),
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  role: z.enum(['superadmin', 'admin', 'user', 'viewer']),
  is_active: z.boolean(),
  authorized_branches: z.array(z.number()).optional()
})
```

**Uso**: [user-form.tsx](../../../src/components/usuarios/user-form.tsx)

---

### `CreateUserRequest`

**Descrição**: Payload para criação de usuário via API.

**Definição**:
```typescript
export type CreateUserRequest = {
  email: string
  full_name: string
  role: UserRole
  tenant_id: string
  authorized_branches?: number[]
}
```

**Exemplo de Requisição**:
```typescript
const response = await fetch('/api/users/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'novo@empresa.com',
    full_name: 'Novo Usuário',
    role: 'user',
    tenant_id: currentTenant.id,
    authorized_branches: [1, 2, 3]
  })
})
```

**Implementação**: [src/app/api/users/create/route.ts](../../../src/app/api/users/create/route.ts)

---

### `UpdateUserRequest`

**Descrição**: Payload para atualização de usuário.

**Definição**:
```typescript
export type UpdateUserRequest = {
  user_id: string
  full_name?: string
  role?: UserRole
  is_active?: boolean
  authorized_branches?: number[]
}
```

**Observação**: Email é atualizado via endpoint separado.

---

## Tipos de Empresa

### `Tenant`

**Descrição**: Empresa/tenant no sistema multi-tenant.

**Definição**:
```typescript
export type Tenant = {
  id: string                      // UUID do tenant
  name: string                    // Nome da empresa
  supabase_schema: string         // Schema do PostgreSQL (único)
  created_at: string              // Data de criação (ISO 8601)
  updated_at: string              // Data de atualização (ISO 8601)
}
```

**Exemplo**:
```typescript
const tenant: Tenant = {
  id: "987f6543-e21a-34b5-c678-123456789abc",
  name: "Okilão Supermercados",
  supabase_schema: "okilao",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-12T10:00:00.000Z"
}
```

**Uso**: TenantContext, listagem de empresas

---

### `TenantWithBranches`

**Descrição**: Tenant com contagem de filiais.

**Definição**:
```typescript
export type TenantWithBranches = Tenant & {
  branches_count: number          // Quantidade de filiais
  active_branches_count: number   // Quantidade de filiais ativas
}
```

**Exemplo de Query**:
```typescript
const { data } = await supabase
  .from('tenants')
  .select(`
    *,
    branches:branches(count),
    active_branches:branches!is_active.eq.true(count)
  `)
```

**Uso**: Listagem de empresas

---

### `TenantFormData`

**Descrição**: Dados do formulário de criação/edição de empresa.

**Definição**:
```typescript
export type TenantFormData = {
  name: string                    // Nome da empresa (obrigatório)
  supabase_schema: string         // Schema (obrigatório, imutável após criação)
}
```

**Validação**:
```typescript
const tenantFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  supabase_schema: z
    .string()
    .min(3, 'Schema deve ter no mínimo 3 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Schema deve conter apenas letras minúsculas, números e underscore')
})
```

**Uso**: [company-form.tsx](../../../src/components/empresas/company-form.tsx)

---

## Tipos de Filial

### `Branch`

**Descrição**: Filial de uma empresa.

**Definição**:
```typescript
export type Branch = {
  id: number                      // ID da filial (PK)
  tenant_id: string               // UUID do tenant (FK)
  name: string                    // Nome da filial
  code: string                    // Código da filial (ex: "F001")
  is_active: boolean              // Status de ativação
  created_at: string              // Data de criação (ISO 8601)
  updated_at: string              // Data de atualização (ISO 8601)
}
```

**Exemplo**:
```typescript
const branch: Branch = {
  id: 1,
  tenant_id: "987f6543-e21a-34b5-c678-123456789abc",
  name: "Filial Centro",
  code: "F001",
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-12T10:00:00.000Z"
}
```

**Uso**: Filtros, seleção de filiais

---

### `BranchOption`

**Descrição**: Opção de filial para Select/Combobox.

**Definição**:
```typescript
export type BranchOption = {
  value: string                   // ID da filial (como string)
  label: string                   // Texto exibido (ex: "Filial Centro")
  disabled?: boolean              // Se opção está desabilitada
}
```

**Exemplo**:
```typescript
const branchOptions: BranchOption[] = [
  { value: '0', label: 'Todas as Filiais' },
  { value: '1', label: 'Filial Centro' },
  { value: '2', label: 'Filial Sul' },
  { value: '3', label: 'Filial Norte', disabled: true }
]
```

**Uso**: [use-branches.ts](../../../src/hooks/use-branches.ts)

---

### `BranchFormData`

**Descrição**: Dados do formulário de criação/edição de filial.

**Definição**:
```typescript
export type BranchFormData = {
  name: string                    // Nome da filial (obrigatório)
  code: string                    // Código da filial (obrigatório)
  is_active: boolean              // Status (padrão: true)
}
```

**Validação**:
```typescript
const branchFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  code: z.string().min(1, 'Código é obrigatório'),
  is_active: z.boolean()
})
```

**Uso**: [branch-manager.tsx](../../../src/components/empresas/branch-manager.tsx)

---

### `UserAuthorizedBranch`

**Descrição**: Relacionamento entre usuário e filial autorizada.

**Definição**:
```typescript
export type UserAuthorizedBranch = {
  user_id: string                 // UUID do usuário (FK)
  branch_id: number               // ID da filial (FK)
}
```

**Exemplo**:
```typescript
const authorizedBranch: UserAuthorizedBranch = {
  user_id: "123e4567-e89b-12d3-a456-426614174000",
  branch_id: 1
}
```

**Uso**: Controle de acesso por filial

---

## Tipos de Setor

### `Setor`

**Descrição**: Setor de negócio associado a departamentos.

**Definição**:
```typescript
export type Setor = {
  id: number                      // ID do setor (PK)
  nome: string                    // Nome do setor (único por tenant)
  cor: string                     // Cor hex (ex: "#3B82F6")
  departamento_id_nivel_1: number[] | null  // IDs dos departamentos nível 1
  departamento_id_nivel_2: number[] | null  // IDs dos departamentos nível 2
  departamento_id_nivel_3: number[] | null  // IDs dos departamentos nível 3
  departamento_id_nivel_4: number[] | null  // IDs dos departamentos nível 4
  departamento_id_nivel_5: number[] | null  // IDs dos departamentos nível 5
  departamento_id_nivel_6: number[] | null  // IDs dos departamentos nível 6
  created_at: string              // Data de criação (ISO 8601)
  updated_at: string              // Data de atualização (ISO 8601)
}
```

**Exemplo**:
```typescript
const setor: Setor = {
  id: 1,
  nome: "Mercearia",
  cor: "#3B82F6",
  departamento_id_nivel_1: [1, 2, 3],
  departamento_id_nivel_2: [10, 11],
  departamento_id_nivel_3: [100, 101, 102],
  departamento_id_nivel_4: null,
  departamento_id_nivel_5: null,
  departamento_id_nivel_6: null,
  created_at: "2025-01-05T00:00:00.000Z",
  updated_at: "2025-01-12T15:30:00.000Z"
}
```

**Uso**: Módulo de Metas por Setor

---

### `SetorFormData`

**Descrição**: Dados do formulário de criação/edição de setor.

**Definição**:
```typescript
export type SetorFormData = {
  nome: string                    // Nome do setor (obrigatório)
  cor: string                     // Cor hex (obrigatório)
  departamento_id_nivel_1?: number[]
  departamento_id_nivel_2?: number[]
  departamento_id_nivel_3?: number[]
  departamento_id_nivel_4?: number[]
  departamento_id_nivel_5?: number[]
  departamento_id_nivel_6?: number[]
}
```

**Validação**:
```typescript
const setorFormSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Cor inválida'),
  departamento_id_nivel_1: z.array(z.number()).optional(),
  departamento_id_nivel_2: z.array(z.number()).optional(),
  departamento_id_nivel_3: z.array(z.number()).optional(),
  departamento_id_nivel_4: z.array(z.number()).optional(),
  departamento_id_nivel_5: z.array(z.number()).optional(),
  departamento_id_nivel_6: z.array(z.number()).optional()
})
```

**Uso**: [setores-content.tsx](../../../src/components/configuracoes/setores-content.tsx)

---

### `Departamento`

**Descrição**: Departamento da hierarquia de 6 níveis.

**Definição**:
```typescript
export type Departamento = {
  id: number                      // ID do departamento (PK)
  descricao: string               // Descrição do departamento
  nivel: 1 | 2 | 3 | 4 | 5 | 6    // Nível na hierarquia
}
```

**Exemplo**:
```typescript
const departamento: Departamento = {
  id: 1,
  descricao: "MERCEARIA",
  nivel: 1
}
```

**Tabelas no Banco**:
- `{schema}.departments_level_1`
- `{schema}.departments_level_2`
- `{schema}.departments_level_3`
- `{schema}.departments_level_4`
- `{schema}.departments_level_5`
- `{schema}.departments_level_6`

---

### `DepartamentoOption`

**Descrição**: Opção de departamento para Select.

**Definição**:
```typescript
export type DepartamentoOption = {
  value: number                   // ID do departamento
  label: string                   // Descrição do departamento
}
```

**Exemplo**:
```typescript
const departamentoOptions: DepartamentoOption[] = [
  { value: 1, label: "MERCEARIA" },
  { value: 2, label: "AÇOUGUE" },
  { value: 3, label: "PADARIA" }
]
```

**Uso**: Seleção de departamentos no formulário de setores

---

## Tipos de Parâmetros

> Fonte oficial e detalhada deste submódulo:
> [./parametros/DATA_STRUCTURES.md](./parametros/DATA_STRUCTURES.md)

### `tenant_parameters` vigente

O modelo atual não usa uma coluna booleana fixa por tenant. Ele usa estrutura chave/valor:

```typescript
type TenantParameterRow = {
  id: string
  tenant_id: string
  parameter_key: string
  parameter_value: boolean
  parameter_numeric_value: number | null
  created_at: string
  updated_at: string
}
```

### Chaves atualmente utilizadas

```typescript
type TenantParametersState = {
  enable_descontos_venda: boolean
  enable_faturamento_metas: boolean
  enable_api_filial_vendas: boolean
}

type TenantNumericParametersState = {
  margem_perda: number
}
```

### Observação

Detalhamento completo de estrutura, defaults, constraints e consumidores deve ser mantido apenas em `docs/modules/configuracoes/parametros/`.

---

## Tipos de Formulários

### `ProfileFormData`

**Descrição**: Dados do formulário de edição de perfil.

**Definição**:
```typescript
export type ProfileFormData = {
  full_name: string               // Nome completo (obrigatório)
}
```

**Validação**:
```typescript
const profileFormSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres')
})
```

**Uso**: [profile-form.tsx](../../../src/components/perfil/profile-form.tsx)

---

### `PasswordFormData`

**Descrição**: Dados do formulário de alteração de senha.

**Definição**:
```typescript
export type PasswordFormData = {
  currentPassword: string         // Senha atual (obrigatório)
  newPassword: string             // Nova senha (obrigatório, min 6 caracteres)
  confirmPassword: string         // Confirmação (obrigatório, deve ser igual)
}
```

**Validação**:
```typescript
const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"]
})
```

**Uso**: [password-form.tsx](../../../src/components/perfil/password-form.tsx)

---

## Enums e Constantes

### Roles

```typescript
export const USER_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer'
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]
```

---

### Labels de Roles

```typescript
export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  user: 'Usuário',
  viewer: 'Visualizador'
}
```

**Uso**:
```typescript
const roleLabel = ROLE_LABELS[userProfile.role] // "Admin"
```

---

### Status de Usuário

```typescript
export const USER_STATUS = {
  ACTIVE: true,
  INACTIVE: false
} as const

export const STATUS_LABELS: Record<string, string> = {
  'true': 'Ativo',
  'false': 'Inativo'
}

export const STATUS_COLORS: Record<string, string> = {
  'true': 'text-green-600',
  'false': 'text-red-600'
}
```

**Uso**:
```typescript
const statusLabel = STATUS_LABELS[String(user.is_active)] // "Ativo"
const statusColor = STATUS_COLORS[String(user.is_active)] // "text-green-600"
```

---

### Cores de Setores

```typescript
export const SETOR_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // green-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
] as const
```

**Uso**: Seleção de cor padrão ao criar setor

---

## Interfaces de API

### Response - Sucesso Genérico

```typescript
export interface ApiSuccessResponse<T = any> {
  data?: T
  message?: string
}
```

**Exemplo**:
```json
{
  "message": "Usuário criado com sucesso"
}
```

---

### Response - Erro Genérico

```typescript
export interface ApiErrorResponse {
  error: string
  details?: any
}
```

**Exemplo**:
```json
{
  "error": "Email já existe no sistema",
  "details": {
    "field": "email",
    "code": "DUPLICATE_EMAIL"
  }
}
```

---

### Request - Criar Usuário

```typescript
export interface CreateUserRequestBody {
  email: string
  full_name: string
  role: UserRole
  tenant_id: string
  authorized_branches?: number[]
}
```

---

### Response - Criar Usuário

```typescript
export interface CreateUserResponse {
  user_id: string
  email: string
  message: string
}
```

**Exemplo**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "novo@empresa.com",
  "message": "Usuário criado com sucesso"
}
```

---

### Request - Filiais Autorizadas

```typescript
export interface AuthorizedBranchesRequestBody {
  user_id: string
  branch_ids: number[]
}
```

---

### Response - Filiais Autorizadas

```typescript
export interface AuthorizedBranchesResponse {
  user_id: string
  branch_ids: number[]
}
```

**Exemplo**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "branch_ids": [1, 2, 3, 4]
}
```

---

### Request - Criar/Atualizar Setor

```typescript
export interface SetorRequestBody {
  nome: string
  cor: string
  departamento_id_nivel_1?: number[]
  departamento_id_nivel_2?: number[]
  departamento_id_nivel_3?: number[]
  departamento_id_nivel_4?: number[]
  departamento_id_nivel_5?: number[]
  departamento_id_nivel_6?: number[]
}
```

---

### Response - Lista de Setores

```typescript
export type SetoresResponse = Setor[]
```

**Exemplo**:
```json
[
  {
    "id": 1,
    "nome": "Mercearia",
    "cor": "#3B82F6",
    "departamento_id_nivel_1": [1, 2, 3],
    "departamento_id_nivel_2": [10, 11],
    "departamento_id_nivel_3": null,
    "departamento_id_nivel_4": null,
    "departamento_id_nivel_5": null,
    "departamento_id_nivel_6": null,
    "created_at": "2025-01-05T00:00:00.000Z",
    "updated_at": "2025-01-12T15:30:00.000Z"
  }
]
```

---

### Response - Departamentos por Nível

```typescript
export interface DepartamentosResponse {
  nivel: number
  departamentos: Array<{
    id: number
    descricao: string
  }>
}
```

**Exemplo**:
```json
{
  "nivel": 1,
  "departamentos": [
    { "id": 1, "descricao": "MERCEARIA" },
    { "id": 2, "descricao": "AÇOUGUE" },
    { "id": 3, "descricao": "PADARIA" }
  ]
}
```

---

## Tipos de Contexto

### `TenantContextType`

**Descrição**: Tipo do contexto de tenant.

**Definição**:
```typescript
export type TenantContextType = {
  currentTenant: Tenant | null
  userProfile: UserProfile | null
  allTenants: Tenant[]
  isLoading: boolean
  switchTenant: (tenantId: string) => Promise<void>
  reloadUserProfile: () => Promise<void>
}
```

**Uso**: [tenant-context.tsx](../../../src/contexts/tenant-context.tsx)

---

### `PermissionsType`

**Descrição**: Tipo do hook de permissões.

**Definição**:
```typescript
export type PermissionsType = {
  isSuperAdmin: boolean
  isAdmin: boolean
  isUser: boolean
  isViewer: boolean
  canManageUsers: boolean
  canManageSettings: boolean
  canManageTenants: boolean
  canSwitchTenants: boolean
}
```

**Uso**: [use-permissions.ts](../../../src/hooks/use-permissions.ts)

---

## Mapeamentos Úteis

### Cores de Status

```typescript
export const STATUS_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'true': {
    bg: 'bg-green-100',
    text: 'text-green-800'
  },
  'false': {
    bg: 'bg-red-100',
    text: 'text-red-800'
  }
}
```

---

### Ícones por Role

```typescript
import { Shield, ShieldCheck, User, Eye } from 'lucide-react'

export const ROLE_ICONS: Record<UserRole, typeof Shield> = {
  superadmin: ShieldCheck,
  admin: Shield,
  user: User,
  viewer: Eye
}
```

---

**Última Atualização**: 2025-01-12
**Versão**: 1.0.0
