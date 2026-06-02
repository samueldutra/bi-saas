# Configurações > Parâmetros

> Status: ✅ Implementado
>
> Fonte oficial do submódulo: qualquer alteração funcional neste fluxo deve atualizar esta pasta no mesmo ciclo de mudança.

## Visão Geral

O submódulo `Configurações > Parâmetros` centraliza parâmetros por tenant na tabela `public.tenant_parameters`. Hoje ele controla:

- visibilidade e acesso do módulo `Descontos de Vendas`
- seleção das RPCs de metas com ou sem faturamento
- seleção da origem PDV do `Dashboard 360` entre a base legada e o snapshot da API `/filial/vendas`
- seleção da fonte de realizados do `Metas Mensais` entre o legado e `vendas_filiais_snapshot`
- margem de perda default para cálculos de margem de lucro

O fluxo é multi-tenant e sempre usa o `tenant` corrente vindo de `TenantContext`.

## Escopo Atual

### Entrada do usuário

- Rota hub: `/configuracoes`
- Aba interna: `Parâmetros`
- Componente principal: `src/components/configuracoes/parametros-content.tsx`

### Consumidores atuais

- `src/components/dashboard/app-sidebar.tsx`
- `src/app/(dashboard)/descontos-venda/page.tsx`
- `src/lib/tenant-parameters-server.ts`
- APIs de metas em `src/app/api/metas/**`
- APIs do `Dashboard 360` em `src/app/api/dashboard/**` e `src/app/api/charts/sales-by-month/route.ts`

## Parâmetros Disponíveis

### 1. `enable_descontos_venda`

- Tipo: `boolean`
- Padrão efetivo: `false`
- Efeito:
  - exibe/oculta `/descontos-venda` no menu lateral
  - bloqueia o uso normal da página com redirect client-side para `/dashboard`

### 2. `enable_faturamento_metas`

- Tipo: `boolean`
- Padrão efetivo: `false`
- Efeito:
  - altera a escolha das RPCs de metas para versões com faturamento
  - mantém fallback para RPC legada se a versão nova falhar

### 3. `enable_api_filial_vendas`

- Tipo: `boolean`
- Padrão efetivo: `false`
- Efeito:
  - quando `true`, o `Dashboard 360` usa RPCs novas baseadas em `vendas_filiais_snapshot`
  - quando `true`, o `Metas Mensais` usa RPCs novas para realizados, lucro líquido e margem realizada baseadas em `vendas_filiais_snapshot`
  - quando `false`, o `Dashboard 360` continua usando as RPCs legadas baseadas em `vendas_diarias_por_filial`
  - na fonte nova, Receita Bruta vem de `valor`, Custo vem de `custo_total_ajustado`, Lucro Bruto vem de `lucro_ajustado`, Margem Bruta vem de `margem_ajustada_percentual`, Ticket Médio é `valor / quantidade_clientes` e Cupons vêm de `quantidade_clientes`
  - SKU não muda com este parâmetro: sempre usa a regra legada `COUNT(DISTINCT id_produto)` sobre a tabela `vendas`

### 4. `margem_perda`

- Tipo: `numeric(4,2)`
- Padrão efetivo: `0.00`
- Persistência:
  - salvo em `tenant_parameters.parameter_numeric_value`
  - gravado por `tenant_id`, que representa o schema corrente selecionado no sistema
- Efeito:
  - não controla visibilidade de tela ou menu
  - disponibiliza uma margem de perda default para consumidores de cálculo de margem de lucro
  - valores aceitos vão de `0.00` a `99.99`

## Arquivos de Referência

- [../README.md](../README.md)
- [./BUSINESS_RULES.md](./BUSINESS_RULES.md)
- [./DATA_STRUCTURES.md](./DATA_STRUCTURES.md)
- [./INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md)
- [./CHANGELOG_FUNCTIONS.md](./CHANGELOG_FUNCTIONS.md)

## Mapa Técnico

### UI e edição

- `src/app/(dashboard)/configuracoes/page.tsx`
- `src/components/configuracoes/parametros-content.tsx`

### Leitura client-side

- `src/hooks/use-tenant-parameters.ts`
- `src/components/dashboard/app-sidebar.tsx`
- `src/app/(dashboard)/descontos-venda/page.tsx`

### Leitura server-side

- `src/lib/tenant-parameters-server.ts`
- `src/app/api/metas/generate/route.ts`
- `src/app/api/metas/update/route.ts`
- `src/app/api/metas/setor/generate/route.ts`
- `src/app/api/metas/setor/update-valores/route.ts`
- helper `getMargemPerdaDefault(schema)` para consumidores server-side de margem de lucro

## Pontos de Atenção

- A tela `parametros-content.tsx` hoje duplica parte da lógica já existente em `use-tenant-parameters.ts`.
- A tipagem gerada em `src/types/database.types.ts` ainda não inclui `tenant_parameters`.
- A proteção do módulo `Descontos de Vendas` não está mais no middleware; o controle atual está no menu e na página cliente.
- `margem_perda` é um parâmetro numérico; não deve ser lido pela coluna booleana `parameter_value`.

## Regra Permanente de Manutenção

Sempre que houver mudança em qualquer item abaixo, atualize esta pasta:

- novos parâmetros
- alteração de comportamento de parâmetros existentes
- mudança de tabela, RLS ou constraints de `tenant_parameters`
- alteração em consumidores client-side ou server-side
- mudança de rota, permissão ou fallback relacionado ao submódulo
- ativação ou alteração de qualquer consumidor ligado a `enable_api_filial_vendas`
