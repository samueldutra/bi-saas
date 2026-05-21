# Dashboard 360 - Fluxo de Integração

## Índice

1. [Visão Geral do Fluxo](#visão-geral-do-fluxo)
2. [Fluxo de Inicialização](#fluxo-de-inicialização)
3. [Fluxo de Aplicação de Filtros](#fluxo-de-aplicação-de-filtros)
4. [Fluxo de Busca de Dados](#fluxo-de-busca-de-dados)
5. [Fluxo de Consolidação](#fluxo-de-consolidação)
6. [Fluxo de Renderização](#fluxo-de-renderização)
7. [Tratamento de Erros e Restrições](#tratamento-de-erros-e-restrições)

---

## Visão Geral do Fluxo

O módulo segue a sequência abaixo:

```text
1. Resolver tenant atual
2. Carregar filiais disponíveis
3. Definir filtros padrão
4. Montar apiParams
5. Selecionar família de RPCs pelo parâmetro `enable_api_filial_vendas`
6. Buscar dados em paralelo
7. Consolidar PDV + faturamento no frontend
8. Renderizar cards, gráfico e tabela
9. Permitir exportação PDF da tabela
```

---

## Fluxo de Inicialização

### 1. Contexto base

Ao entrar em `/dashboard`, a árvore está dentro de:

- `TenantProvider`
- `RouteGuard`
- `DashboardShell`

Referência:

- [`src/app/(dashboard)/layout.tsx`](../../../src/app/(dashboard)/layout.tsx#L6)

### 2. Filtros padrão

Na primeira carga, a página inicializa:

- `dataInicio` = primeiro dia do mês atual
- `dataFim` = ontem, ou primeiro dia do mês se ainda não existir ontem válido
- `filterType` = `month`
- `salesType` = `complete`

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L171)

### 3. Filtro visual de período

O componente [`dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L48) aciona `onPeriodChange`, que atualiza:

- `dataInicio`
- `dataFim`
- `filterType`

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L211)

---

## Fluxo de Aplicação de Filtros

### 1. Filiais

As opções de filiais vêm de `useBranchesOptions`, a partir do tenant atual.

Referência:

- [`src/hooks/use-branches.ts`](../../../src/hooks/use-branches.ts#L44)

### 2. Geração de `apiParams`

Sempre que mudam:

- tenant
- datas
- filiais
- `filterType`

o efeito central recalcula `apiParams`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L361)

### 3. Resultado

`apiParams` se torna a base única para as URLs de:

- resumo principal
- YTD
- MTD
- gráfico
- tabela por filial
- faturamento
- entradas/perdas

### 4. Seleção da origem PDV

No server-side, as rotas do módulo consultam `isApiFilialVendasEnabled(schema)` para decidir entre:

- RPCs legadas baseadas em `vendas_diarias_por_filial`
- RPCs paralelas baseadas em `vendas_filiais_snapshot`

As rotas retornam `sales_source` para o frontend. Quando o valor é `api_filial_vendas`, a página usa tipo de venda efetivo `pdv` para evitar consolidação com Faturamento.

Quando a fonte paralela está ativa, os campos PDV exibidos nos indicadores e na listagem são mapeados do snapshot:

- receita: `valor`
- custo: `custo_total_ajustado`
- lucro bruto: `lucro_ajustado`
- margem bruta: `margem_ajustada_percentual`
- ticket médio: `valor / quantidade_clientes`
- cupons: `quantidade_clientes`
- SKU: regra legada `COUNT(DISTINCT id_produto)` sobre `vendas`

---

## Fluxo de Busca de Dados

### 1. Resumo principal

```text
DashboardPage
  -> /api/dashboard
  -> validateSchemaAccess + filiais autorizadas
  -> RPC get_dashboard_data
```

Referência:

- [`src/app/api/dashboard/route.ts`](../../../src/app/api/dashboard/route.ts#L19)

### 2. YTD

Só executa quando `shouldShowYTD()` retorna `true`.

```text
DashboardPage
  -> /api/dashboard/ytd-metrics
  -> RPC get_dashboard_ytd_metrics
```

Com `enable_api_filial_vendas` ativo, a API troca para `get_dashboard_ytd_metrics_api_filial_vendas` e retorna `sales_source = api_filial_vendas`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L384)

### 3. MTD

Só executa quando `shouldShowMTD()` retorna `true`.

```text
DashboardPage
  -> /api/dashboard/mtd-metrics
  -> RPC get_dashboard_mtd_metrics
```

Com `enable_api_filial_vendas` ativo, a API troca para `get_dashboard_mtd_metrics_api_filial_vendas` e retorna `sales_source = api_filial_vendas`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L405)

### 4. Tabela por filial

```text
DashboardPage
  -> /api/dashboard/vendas-por-filial
  -> RPC get_vendas_por_filial
  -> em qualquer fonte: RPC get_total_sku_distinct + RPC get_total_sku_distinct_pa
  -> se fonte /filial/vendas: totalização de total_sku/pa_total_sku retornados pela RPC alternativa
```

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L433)
- [`src/app/api/dashboard/vendas-por-filial/route.ts`](../../../src/app/api/dashboard/vendas-por-filial/route.ts#L75)

### 5. Faturamento

```text
DashboardPage
  -> /api/faturamento
  -> RPC get_faturamento_data

DashboardPage
  -> /api/faturamento?por_filial=true
  -> RPC get_faturamento_por_filial
```

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L459)
- [`src/app/api/faturamento/route.ts`](../../../src/app/api/faturamento/route.ts#L76)

### 6. Entradas e perdas

```text
DashboardPage
  -> /api/dashboard/entradas-perdas
  -> query direta em entradas
  -> query direta em perdas
```

Referência:

- [`src/app/api/dashboard/entradas-perdas/route.ts`](../../../src/app/api/dashboard/entradas-perdas/route.ts#L75)

### 7. Gráfico mensal

```text
DashboardPage
  -> /api/charts/sales-by-month
  -> RPC get_sales_by_month_chart
  -> RPC get_expenses_by_month_chart
  -> RPC get_lucro_by_month_chart
  -> RPC get_faturamento_by_month_chart
  -> merge local por mês
```

Referência:

- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L95)

---

## Fluxo de Consolidação

### 1. Consolidação principal por `salesType`

O frontend produz `consolidatedTotals` com base em:

- resposta PDV de `/api/dashboard`
- resposta de faturamento atual
- resposta de faturamento do período comparativo

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L776)

### 2. Consolidação MTD

O frontend compõe `consolidatedMTD` combinando:

- `mtdData`
- faturamento do mês anterior
- faturamento do ano anterior

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L832)

### 3. Consolidação da tabela

Cada linha da tabela recalcula:

- receita
- custo
- lucro
- margem

de acordo com `salesType` e mapas de faturamento por filial.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1813)

### 4. Consolidação do gráfico

O gráfico transforma o merge mensal em:

- `receita`
- `despesa` negativa
- `lucro`

e troca a composição conforme `salesType`.

Referência:

- [`src/components/dashboard/chart-vendas.tsx`](../../../src/components/dashboard/chart-vendas.tsx#L67)

---

## Fluxo de Renderização

### Cards principais

Renderizam:

- valor atual
- `PA`
- `MTD` quando aplicável
- `YTD` quando aplicável

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1382)

### Cards operacionais

Renderizam:

- entradas
- perdas
- placeholder de trocas

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1466)

### Tabela por filial

Renderiza:

- linhas ordenáveis
- linha de totalização
- exportação PDF baseada no estado visível

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L915)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1670)

---

## Tratamento de Erros e Restrições

### Segurança

As APIs aplicam:

- autenticação obrigatória
- validação de schema
- filtragem de filiais por autorização

### Cache

As rotas principais usam:

- `dynamic = 'force-dynamic'`
- `revalidate = 0`

### Tolerância parcial

Algumas rotas continuam operando com dados parciais:

- `/api/faturamento` retorna zeros se a estrutura de faturamento não existir
- `/api/charts/sales-by-month` segue mesmo sem despesa/lucro/faturamento mensal em alguns cenários

Referências:

- [`src/app/api/faturamento/route.ts`](../../../src/app/api/faturamento/route.ts#L91)
- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L120)
