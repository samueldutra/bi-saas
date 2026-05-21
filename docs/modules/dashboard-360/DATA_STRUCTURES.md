# Dashboard 360 - Estruturas de Dados

## Índice

1. [Filtros Locais](#filtros-locais)
2. [Estruturas do Resumo Principal](#estruturas-do-resumo-principal)
3. [Estruturas de Comparação](#estruturas-de-comparação)
4. [Estruturas da Tabela por Filial](#estruturas-da-tabela-por-filial)
5. [Estruturas de Faturamento e Operação](#estruturas-de-faturamento-e-operação)
6. [Mapas Derivados](#mapas-derivados)

---

## Filtros Locais

### `SalesType`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L35)

```ts
type SalesType = 'complete' | 'pdv' | 'faturamento'
```

### `FilterType`

Fonte:

- [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L14)

```ts
type FilterType = 'month' | 'year' | 'custom'
```

### `apiParams`

Estado central que alimenta todas as chamadas do módulo.

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L199)

```ts
{
  schema: string | undefined
  data_inicio: string
  data_fim: string
  filiais: string
  filter_type: FilterType
}
```

---

## Estruturas do Resumo Principal

### `DashboardData`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L38)

Campos principais:

- `total_vendas`
- `total_lucro`
- `ticket_medio`
- `margem_lucro`
- `pa_vendas`
- `pa_lucro`
- `pa_ticket_medio`
- `pa_margem_lucro`
- variações mensais e anuais
- `grafico_vendas`

Uso:

- cards principais
- base PDV para consolidação com faturamento

### Exemplo conceitual

```json
{
  "total_vendas": 1250000,
  "total_lucro": 312000,
  "ticket_medio": 86.4,
  "margem_lucro": 24.96,
  "pa_vendas": 1180000,
  "pa_lucro": 280000
}
```

---

## Estruturas de Comparação

### `YTDMetrics`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L60)

Uso:

- comparação anual acumulada nos cards
- participa da detecção de `sales_source = api_filial_vendas` para manter o acumulado anual na fonte snapshot quando o parâmetro estiver ativo

Campos principais:

- `ytd_vendas`
- `ytd_vendas_ano_anterior`
- `ytd_variacao_vendas_percent`
- `ytd_lucro`
- `ytd_lucro_ano_anterior`
- `ytd_variacao_lucro_percent`
- `ytd_margem`
- `ytd_margem_ano_anterior`
- `ytd_variacao_margem`

### `MTDMetrics`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L73)

Uso:

- comparativos do mês anterior e do mesmo mês do ano anterior
- participa da detecção de `sales_source = api_filial_vendas` para manter os indicadores MTD na fonte snapshot quando o parâmetro estiver ativo

Campos principais:

- `mtd_vendas`
- `mtd_lucro`
- `mtd_margem`
- `mtd_mes_anterior_vendas`
- `mtd_mes_anterior_lucro`
- `mtd_mes_anterior_margem`
- `mtd_ano_anterior_vendas`
- `mtd_ano_anterior_lucro`
- `mtd_ano_anterior_margem`

---

## Estruturas da Tabela por Filial

### `VendaPorFilial`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L94)

Campos de PDV:

- `filial_id`
- `valor_total`: receita bruta
- `custo_total`: custo
- `total_lucro`: lucro bruto
- `quantidade_total`: quantidade vendida
- `total_transacoes`: cupons/transações
- `ticket_medio`: receita bruta / cupons
- `margem_lucro`: margem bruta
- equivalentes `pa_*`
- deltas de receita, custo, lucro e margem

Quando `enable_api_filial_vendas = true`, esses campos vêm de `vendas_filiais_snapshot`:

- `valor_total`: `valor`
- `custo_total`: `custo_total_ajustado`
- `total_lucro`: `lucro_ajustado`
- `margem_lucro`: `margem_ajustada_percentual`, ponderada por `valor` em agregações
- `total_cupons`: `quantidade_clientes`
- `total_sku`: regra legada `COUNT(DISTINCT id_produto)` sobre `vendas`

As respostas das APIs do Dashboard também podem trazer `sales_source`:

- `legacy`: fonte PDV legada
- `api_filial_vendas`: fonte `vendas_filiais_snapshot`

Campos operacionais:

- `total_entradas`
- `pa_total_entradas`
- `delta_entradas_percent`
- `total_cupons`
- `pa_total_cupons`
- `delta_cupons_percent`
- `total_sku`
- `pa_total_sku`
- `delta_sku_percent`

### `VendasPorFilialResponse`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L133)

```ts
interface VendasPorFilialResponse {
  vendas: VendaPorFilial[]
  total_sku_distinct: number
  pa_total_sku_distinct: number
}
```

Uso:

- linhas da tabela
- totalização de SKU distinto
- exportação PDF

---

## Estruturas de Faturamento e Operação

### `FaturamentoData`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L145)

```ts
interface FaturamentoData {
  receita_faturamento: number
  cmv_faturamento: number
  lucro_bruto_faturamento: number
  qtd_notas: number
}
```

Uso:

- cards consolidados
- comparativos `PA`
- totalização da tabela

### `FaturamentoPorFilial`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L152)

```ts
interface FaturamentoPorFilial {
  filial_id: number
  receita_faturamento: number
  cmv_faturamento: number
  lucro_bruto_faturamento: number
}
```

Uso:

- mesclagem linha a linha na tabela por filial

### `EntradasPerdasData`

Fonte:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L159)

```ts
interface EntradasPerdasData {
  total_entradas: number
  total_perdas: number
}
```

Uso:

- cards operacionais
- comparativos MTD e anual

---

## Mapas Derivados

### `faturamentoPorFilialMap`

Transforma `FaturamentoPorFilial[]` em `Map<number, FaturamentoPorFilial>` para lookup por `filial_id`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L749)

### `faturamentoPorFilialComparativoMap`

Mesmo padrão do mapa principal, mas para o período comparativo da tabela.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L758)

### `sortedVendasPorFilial`

Array derivado com ordenação controlada por:

- `sortColumn`
- `sortDirection`

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1204)
