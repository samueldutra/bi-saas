# Módulo de Configurações

> Status: ✅ Implementado

## Visão Geral

O módulo de Configurações é o centro de gerenciamento administrativo do BI SaaS Dashboard. Ele permite que administradores e superadmins gerenciem usuários, empresas, setores, parâmetros do sistema e perfis pessoais. O módulo é organizado em 5 submódulos principais, cada um com funcionalidades específicas e níveis de acesso controlados por roles.

## Funcionalidades

- ✅ **Perfil**: Gerenciamento de dados pessoais (nome, senha)
- ✅ **Usuários**: CRUD completo de usuários com controle de permissões, filiais autorizadas e módulos autorizados
- ✅ **Parâmetros**: Configuração de parâmetros do tenant (ex: habilitar/desabilitar módulos)
- ✅ **Setores**: CRUD de setores de negócio com associação de departamentos
- ✅ **Empresas**: CRUD completo de empresas (tenants) e suas filiais (superadmin only)

## Componentes Principais

### Frontend

#### **Página Hub de Configurações**
- **Página Principal**: [src/app/(dashboard)/configuracoes/page.tsx](../../../src/app/(dashboard)/configuracoes/page.tsx)
- **Componentes de Abas**:
  - [src/components/configuracoes/perfil-content.tsx](../../../src/components/configuracoes/perfil-content.tsx)
  - [src/components/configuracoes/usuarios-content.tsx](../../../src/components/configuracoes/usuarios-content.tsx)
  - [src/components/configuracoes/parametros-content.tsx](../../../src/components/configuracoes/parametros-content.tsx)
  - [src/components/configuracoes/setores-content.tsx](../../../src/components/configuracoes/setores-content.tsx)
  - [src/components/configuracoes/empresas-content.tsx](../../../src/components/configuracoes/empresas-content.tsx)

#### **Páginas de Usuários**
- **Listagem**: [src/app/(dashboard)/usuarios/page.tsx](../../../src/app/(dashboard)/usuarios/page.tsx) ⚠️ *Redirect para `/configuracoes`*
- **Criar Novo**: [src/app/(dashboard)/usuarios/novo/page.tsx](../../../src/app/(dashboard)/usuarios/novo/page.tsx)
- **Editar**: [src/app/(dashboard)/usuarios/[id]/editar/page.tsx](../../../src/app/(dashboard)/usuarios/[id]/editar/page.tsx)
- **Formulário**: [src/components/users/user-form.tsx](../../../src/components/users/user-form.tsx)
- **Seletor de Módulos**: [src/components/usuarios/module-selector.tsx](../../../src/components/usuarios/module-selector.tsx)

#### **Páginas de Empresas**
- **Listagem**: [src/app/(dashboard)/empresas/page.tsx](../../../src/app/(dashboard)/empresas/page.tsx)
- **Criar Nova**: [src/app/(dashboard)/empresas/nova/page.tsx](../../../src/app/(dashboard)/empresas/nova/page.tsx)
- **Detalhes**: [src/app/(dashboard)/empresas/[id]/page.tsx](../../../src/app/(dashboard)/empresas/[id]/page.tsx)
- **Editar**: [src/app/(dashboard)/empresas/[id]/editar/page.tsx](../../../src/app/(dashboard)/empresas/[id]/editar/page.tsx)
- **Formulário**: [src/components/empresas/company-form.tsx](../../../src/components/empresas/company-form.tsx)
- **Gerenciador de Filiais**: [src/components/empresas/branch-manager.tsx](../../../src/components/empresas/branch-manager.tsx)

#### **Componentes de Perfil**
- **Formulário de Nome**: [src/components/perfil/profile-form.tsx](../../../src/components/perfil/profile-form.tsx)
- **Formulário de Senha**: [src/components/perfil/password-form.tsx](../../../src/components/perfil/password-form.tsx)

#### **Componentes de Segurança**
- **RouteGuard**: [src/components/auth/route-guard.tsx](../../../src/components/auth/route-guard.tsx) - Proteção de rotas baseada em módulos autorizados

### Backend

#### **API Routes - Usuários**
- **Criar**: [src/app/api/users/create/route.ts](../../../src/app/api/users/create/route.ts)
- **Obter Email**: [src/app/api/users/get-email/route.ts](../../../src/app/api/users/get-email/route.ts)
- **Atualizar Email**: [src/app/api/users/update-email/route.ts](../../../src/app/api/users/update-email/route.ts)
- **Excluir**: [src/app/api/users/delete/route.ts](../../../src/app/api/users/delete/route.ts) ✅ *Novo*
- **Filiais Autorizadas**: [src/app/api/users/authorized-branches/route.ts](../../../src/app/api/users/authorized-branches/route.ts)
- **Módulos Autorizados**: [src/app/api/users/authorized-modules/route.ts](../../../src/app/api/users/authorized-modules/route.ts)

#### **API Routes - Setores**
- **CRUD**: [src/app/api/setores/route.ts](../../../src/app/api/setores/route.ts)
- **Por ID**: [src/app/api/setores/[id]/route.ts](../../../src/app/api/setores/[id]/route.ts)
- **Departamentos**: [src/app/api/setores/departamentos/route.ts](../../../src/app/api/setores/departamentos/route.ts)

### Hooks

- **Permissões**: [src/hooks/use-permissions.ts](../../../src/hooks/use-permissions.ts)
- **Parâmetros do Tenant**: [src/hooks/use-tenant-parameters.ts](../../../src/hooks/use-tenant-parameters.ts)
- **Filiais**: [src/hooks/use-branches.ts](../../../src/hooks/use-branches.ts)
- **Filiais Autorizadas**: [src/hooks/use-authorized-branches.ts](../../../src/hooks/use-authorized-branches.ts)
- **Módulos Autorizados**: [src/hooks/use-authorized-modules.ts](../../../src/hooks/use-authorized-modules.ts)

### Database

#### **Tabelas Principais**
- `public.tenants` - Registro de empresas/tenants
- `public.user_profiles` - Perfis de usuários com roles
- `public.branches` - Filiais das empresas
- `public.user_authorized_branches` - Restrições de acesso por filial
- `public.user_authorized_modules` - Módulos autorizados por usuário (role = user)
- `public.tenant_parameters` - Parâmetros configuráveis por tenant
- `{schema}.setores` - Setores de negócio (isolado por tenant)

## Acesso Rápido

- 🔗 **Rota Principal**: `/configuracoes`
- 🔗 **Usuários**: `/usuarios`
- 🔗 **Empresas**: `/empresas` (superadmin only)
- 📁 **Parâmetros Oficiais**: [parametros/README.md](./parametros/README.md)
- 📄 **Regras de Negócio**: [BUSINESS_RULES.md](./BUSINESS_RULES.md)
- 🗂️ **Estruturas de Dados**: [DATA_STRUCTURES.md](./DATA_STRUCTURES.md)
- 🔄 **Fluxo de Integração**: [INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md)
- ⚙️ **Rotas de API**: [API_ROUTES.md](./API_ROUTES.md)
- 📝 **Changelog**: [CHANGELOG_FUNCTIONS.md](./CHANGELOG_FUNCTIONS.md)

## Permissões

| Role | Perfil | Usuários | Parâmetros | Setores | Empresas |
|------|--------|----------|------------|---------|----------|
| superadmin | ✅ Total | ✅ Total | ✅ Total | ✅ Total | ✅ Total |
| admin | ✅ Próprio | ✅ CRUD* | ✅ Total | ✅ Total | ❌ Sem acesso |
| user | ✅ Próprio | ❌ Leitura | ❌ Sem acesso | ❌ Sem acesso | ❌ Sem acesso |
| viewer | ✅ Próprio | ❌ Leitura | ❌ Sem acesso | ❌ Sem acesso | ❌ Sem acesso |

*Admin não pode criar/editar usuários com role `superadmin`

## Submódulos Detalhados

### 1. Perfil

**Descrição**: Permite que qualquer usuário autenticado visualize e edite seus dados pessoais.

**Funcionalidades**:
- Visualizar informações: nome, email, role, empresa, status
- Editar nome completo
- Alterar senha (com validação de senha atual)
- Upload de avatar (futuro)

**Acesso**: Todos os usuários autenticados

**Componente**: `perfil-content.tsx`

---

### 2. Usuários

**Descrição**: Gerenciamento completo de usuários do sistema, incluindo criação, edição, desativação e controle de filiais autorizadas.

**Funcionalidades**:
- Listar todos os usuários do tenant (em Configurações → Usuários)
- Criar novo usuário (via Admin SDK do Supabase)
- Editar informações do usuário (nome, email, role)
- ✅ **Excluir usuário** (com dialog de confirmação)
- Desativar/ativar usuário
- Definir filiais autorizadas (restrição de acesso - descontinuado)
- Definir módulos autorizados (obrigatório para role = user)
- Visualizar status de ativação

**Acesso**: Admin e Superadmin

**Componentes**: `usuarios-content.tsx`, `user-form.tsx`, `branch-selector.tsx`, `module-selector.tsx`

**APIs**:
- `POST /api/users/create`
- `GET /api/users/get-email`
- `POST /api/users/update-email`
- ✅ `DELETE /api/users/delete` *(novo)*
- `GET/POST/DELETE /api/users/authorized-branches`
- `GET/POST /api/users/authorized-modules`

**Regras**:
- Admin não pode criar/editar superadmins
- Email deve ser único
- Role padrão é "user"
- Pelo menos um módulo deve ser selecionado para role = user
- Superadmin e Admin têm acesso automático a todos os módulos

---

### 3. Parâmetros

**Descrição**: Configuração de parâmetros booleanos e numéricos por tenant.

**Documentação Oficial do Submódulo**: [./parametros/README.md](./parametros/README.md)

**Funcionalidades**:
- Toggle para habilitar/desabilitar "Descontos de Venda"
- Toggle para habilitar/desabilitar o uso de faturamento nas rotinas de metas
- Campo decimal para margem de perda default
- Efeito imediato no menu lateral (adiciona/remove item)
- Persistência automática

**Acesso**: Admin e Superadmin

**Componente**: `parametros-content.tsx`

**Tabela**: `public.tenant_parameters`

**Parâmetros Disponíveis**:
- `enable_descontos_venda`: Habilita módulo de Descontos de Venda
- `enable_faturamento_metas`: Habilita RPCs de metas com base em faturamento
- `enable_api_filial_vendas`: Habilita as RPCs do `Dashboard 360` baseadas no snapshot da API `/filial/vendas`
- `margem_perda`: Define margem de perda default por schema, de `0.00` a `99.99`

---

### 4. Setores

**Descrição**: CRUD de setores de negócio com associação a departamentos da hierarquia de 6 níveis e prevenção de sobreposição com setores ativos.

**Funcionalidades**:
- Listar todos os setores do tenant
- Criar novo setor com nome, nível e departamentos
- Associar departamentos aos setores (multi-select por nível)
- Impedir seleção de departamentos que já conflitam com outro setor ativo
- Editar setor existente
- Deletar setor (se não houver dependências)
- Visualizar departamentos associados

**Acesso**: Admin e Superadmin

**Componente**: `setores-content.tsx`

**APIs**:
- `GET /api/setores` - Listar setores
- `POST /api/setores` - Criar setor
- `PUT /api/setores/[id]` - Atualizar setor
- `DELETE /api/setores/[id]` - Deletar setor
- `GET /api/setores/departamentos` - Listar departamentos por nível

**Tabela**: `{schema}.setores`

**Usado em**: Metas por Setor

---

### 5. Empresas

**Descrição**: Gerenciamento completo de empresas (tenants) e suas filiais. Exclusivo para superadmins.

**Funcionalidades**:
- Listar todas as empresas do sistema
- Criar nova empresa (tenant)
- Editar informações da empresa (nome, schema)
- Visualizar detalhes da empresa
- Gerenciar filiais da empresa (CRUD completo):
  - Criar filial
  - Editar filial (nome, código)
  - Ativar/desativar filial
  - Deletar filial

**Acesso**: Superadmin only

**Componentes**: `empresas-content.tsx`, `company-form.tsx`, `branch-manager.tsx`

**Tabelas**:
- `public.tenants` - Empresas
- `public.branches` - Filiais

**Regras**:
- Schema deve ser único
- Schema deve estar nos "Exposed schemas" do Supabase
- Não pode deletar empresa com usuários ativos

---

## Dependências

- **Supabase Auth**: Autenticação e Admin SDK para criação de usuários
- **TenantContext**: Provedor de contexto para tenant e usuário atual
- **SWR**: Cache e revalidação de dados (hooks de branches)
- **React Hook Form**: Validação de formulários
- **Zod**: Schema validation
- **shadcn/ui**: Componentes de UI (Dialog, Select, Switch, etc.)

## Fluxo de Navegação

```
/configuracoes (Hub)
├── Aba 1: Perfil
├── Aba 2: Usuários (listagem única)
│   ├── /usuarios → REDIRECT para /configuracoes
│   ├── /usuarios/novo (criar)
│   └── /usuarios/[id]/editar (editar)
├── Aba 3: Parâmetros
├── Aba 4: Setores
└── Aba 5: Empresas → /empresas (superadmin only)
    ├── /empresas/nova (criar)
    ├── /empresas/[id] (detalhes + gerenciar filiais)
    └── /empresas/[id]/editar (editar)
```

## Segurança

- **Autenticação obrigatória**: Todas as rotas protegidas por middleware
- **Validação de role**: Verificação server-side em todas as APIs
- **Isolamento de dados**: Queries sempre filtradas por tenant_id
- **Admin SDK**: Criação de usuários usa Supabase Admin SDK (service_role)
- **Row Level Security**: RLS ativo em todas as tabelas

## Observações Importantes

⚠️ **ATENÇÃO**:
- Apenas superadmins podem acessar o módulo de Empresas
- Admins não podem criar ou editar usuários com role "superadmin"
- **Admins não podem excluir superadmins** ✅ *Novo*
- **Usuário não pode excluir a si mesmo** ✅ *Novo*
- **Exclusão de usuário é irreversível** - requer confirmação em dialog ✅ *Novo*
- Schema de empresas deve estar em "Exposed schemas" no Supabase
- Alterações em parâmetros refletem imediatamente no menu lateral
- Filiais autorizadas: se vazio, usuário tem acesso a TODAS as filiais (descontinuado)
- Módulos autorizados: obrigatório para role = user, superadmin e admin têm acesso full automático
- Sidebar filtra itens de menu baseado nos módulos autorizados do usuário
- **Listagem de usuários centralizada em Configurações** → `/usuarios` redireciona para `/configuracoes` ✅ *Novo*

## Versão

**Versão Atual**: 1.3.0
**Última Atualização**: 2025-11-13

**Changelog 1.3.0** (2025-11-13):
- ✅ **Implementação completa de exclusão de usuários**
- ✅ Dialog de confirmação com nome e email do usuário
- ✅ Validações de segurança (não pode deletar si mesmo, admin não deleta superadmin)
- ✅ API `DELETE /api/users/delete` com Supabase Admin SDK
- ✅ Refatoração: listagem centralizada em Configurações
- ✅ `/usuarios` agora redireciona para `/configuracoes`
- ✅ Correção de erro de hidratação (React 19 + Next.js 15)
- ✅ Código limpo e organizado (remoção de duplicação)

**Changelog 1.1.0** (2025-01-12):
- ✨ Adicionado controle de módulos autorizados para usuários (role = user)
- ✨ Novo componente `ModuleSelector` com seleção via checkboxes
- ✨ Nova API `/api/users/authorized-modules` (GET/POST)
- ✨ Novo hook `useAuthorizedModules` para verificação de acesso a módulos
- ✨ Sidebar atualizada para filtrar itens de menu baseado em módulos autorizados
- ✨ Novo componente `RouteGuard` para proteção de rotas diretas
- ✨ 7 módulos configuráveis: Dashboard, DRE Gerencial, Metas (Mensal e Setor), Relatórios (Ruptura ABCD, Venda por Curva, Ruptura 60d)
- ✨ Superadmin e Admin têm acesso automático a todos os módulos
- 🔒 Segurança: URLs digitadas manualmente redirecionam para primeiro módulo autorizado
