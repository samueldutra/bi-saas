# Fluxo de Integração: Configurações > Parâmetros

## 1. Fluxo de leitura na tela

```text
/configuracoes
  -> ConfiguracoesPage identifica tenant corrente
  -> renderiza ParametrosContent(tenantId)
  -> ParametrosContent consulta public.tenant_parameters
  -> merge dos registros encontrados com defaults locais
  -> switches são renderizados
```

## 2. Fluxo de atualização na tela

```text
Usuário altera um switch
  -> updateParameter(key, value)
  -> SELECT por tenant_id + parameter_key
  -> se existir: UPDATE
  -> se não existir: INSERT
  -> estado local é atualizado
  -> mensagem de sucesso é exibida
  -> window.location.reload() reaplica navegação/estado
```

## 3. Fluxo de consumo client-side de `enable_descontos_venda`

```text
TenantContext define tenant corrente
  -> useTenantParameters(tenantId) lê tenant_parameters
  -> AppSidebar filtra item /descontos-venda
  -> DescontosVendaPage revalida parâmetro no carregamento
  -> se false: redirect para /dashboard
```

## 4. Fluxo de consumo server-side de `enable_faturamento_metas`

```text
API de metas recebe schema
  -> isFaturamentoMetasEnabled(schema)
  -> tenants: resolve tenant.id por supabase_schema
  -> tenant_parameters: busca enable_faturamento_metas
  -> API escolhe RPC nova ou legada
  -> se RPC nova falhar e parâmetro estiver ativo: fallback para RPC legada
```

## 5. Fluxo de consumo server-side de `enable_api_filial_vendas`

```text
API do Dashboard 360 recebe schema
  -> isApiFilialVendasEnabled(schema)
  -> tenants: resolve tenant.id por supabase_schema
  -> tenant_parameters: busca enable_api_filial_vendas
  -> API escolhe RPC nova ou legada do Dashboard 360
  -> quando ativa: usa base vendas_filiais_snapshot
```

## 6. Dependências relevantes

- `TenantContext` para tenant corrente
- `createClient()` no browser para leitura e escrita direta
- `createDirectClient()` no server para leitura por schema
- tabela `public.tenants`
- tabela `public.tenant_parameters`

## 7. Lacunas atuais conhecidas

- não existe API route dedicada para gerenciamento de parâmetros
- não existe cache centralizado de parâmetros por tenant
- a proteção de `Descontos de Vendas` está no cliente, não no middleware
- a tela de parâmetros não reutiliza diretamente `use-tenant-parameters`
- `enable_api_filial_vendas` é consumido server-side pelas APIs do `Dashboard 360`
