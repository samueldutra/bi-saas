# Dashboard 360 - RPCs e Integrações de Dados

## Índice

1. [Visão Geral](#visão-geral)
2. [Resumo Principal](#resumo-principal)
3. [Comparativos](#comparativos)
4. [Tabela por Filial](#tabela-por-filial)
5. [Faturamento](#faturamento)
6. [Gráfico Mensal](#gráfico-mensal)
7. [Queries Diretas sem RPC](#queries-diretas-sem-rpc)
8. [Observações de Manutenção](#observações-de-manutenção)

---

## Visão Geral

O módulo usa uma combinação de:

- **RPCs Supabase**
- **queries diretas em tabelas**
- **merge e consolidação no frontend**

As APIs aplicam controle de acesso antes de executar qualquer RPC.

Quando `enable_api_filial_vendas = true`, as APIs do módulo trocam as RPCs legadas por versões paralelas com sufixo `_api_filial_vendas`, baseadas em `vendas_filiais_snapshot`.

As respostas das rotas HTTP do Dashboard adicionam `sales_source` como metadado de origem. Esse campo não vem das RPCs; ele é definido na camada Next.js para orientar a renderização do frontend.

Mapeamento vigente da fonte `/filial/vendas`:

- `valor` -> Receita Bruta
- `custo_total_ajustado` -> Custo
- `lucro_ajustado` -> Lucro Bruto
- `margem_ajustada_percentual` -> Margem Bruta
- `quantidade_clientes` -> Cupons e denominador do Ticket Médio
- `vendas.id_produto` -> SKU da listagem pela regra legada `COUNT(DISTINCT id_produto)`

---

## Resumo Principal

### API: `/api/dashboard`

Arquivo:

- [`src/app/api/dashboard/route.ts`](../../../src/app/api/dashboard/route.ts#L19)

### RPC usada: `get_dashboard_data`

Parâmetros enviados:

```ts
{
  schema_name: requestedSchema,
  p_data_inicio: data_inicio,
  p_data_fim: data_fim,
  p_filiais_ids: finalFiliais
}
```

Responsabilidade:

- receita PDV
- lucro PDV
- ticket médio
- margem
- valores do período comparativo

### RPC alternativa: `get_dashboard_data_api_filial_vendas`

Base PDV:

- `{schema}.vendas_filiais_snapshot`

Regra adicional:

- `ticket_medio = vendas / quantidade_clientes`
- `total_lucro = SUM(lucro_ajustado)`
- `margem_lucro` usa `margem_ajustada_percentual` ponderada por `valor`

---

## Comparativos

### API: `/api/dashboard/ytd-metrics`

Arquivo:

- [`src/app/api/dashboard/ytd-metrics/route.ts`](../../../src/app/api/dashboard/ytd-metrics/route.ts#L17)

### RPC usada: `get_dashboard_ytd_metrics`

Parâmetros:

```ts
{
  schema_name: requestedSchema,
  p_data_inicio: data_inicio,
  p_data_fim: data_fim,
  p_filiais_ids: finalFiliais
}
```

Responsabilidade:

- vendas YTD
- lucro YTD
- margem YTD
- comparação com ano anterior

### RPC alternativa: `get_dashboard_ytd_metrics_api_filial_vendas`

Usa `vendas_filiais_snapshot` como base PDV do acumulado anual, com `valor`, `lucro_ajustado` e `margem_ajustada_percentual`.

Quando a resposta da API traz `sales_source = api_filial_vendas`, os cards tratam esses valores como fonte PDV principal para o acumulado e para o comparativo com o ano anterior.

### API: `/api/dashboard/mtd-metrics`

Arquivo:

- [`src/app/api/dashboard/mtd-metrics/route.ts`](../../../src/app/api/dashboard/mtd-metrics/route.ts#L17)

### RPC usada: `get_dashboard_mtd_metrics`

Parâmetros:

```ts
{
  schema_name: requestedSchema,
  p_data_inicio: data_inicio,
  p_data_fim: data_fim,
  p_filiais_ids: finalFiliais
}
```

Responsabilidade:

- comparativo com mês anterior
- comparativo com mesmo mês do ano anterior

### RPC alternativa: `get_dashboard_mtd_metrics_api_filial_vendas`

Usa `vendas_filiais_snapshot` como base PDV dos comparativos MTD, com `valor`, `lucro_ajustado` e `margem_ajustada_percentual`.

Quando a resposta da API traz `sales_source = api_filial_vendas`, os cards usam esses valores para o mês atual, mês anterior e mesmo mês do ano anterior sem recompor os indicadores pela fonte legada.

---

## Tabela por Filial

### API: `/api/dashboard/vendas-por-filial`

Arquivo:

- [`src/app/api/dashboard/vendas-por-filial/route.ts`](../../../src/app/api/dashboard/vendas-por-filial/route.ts#L10)

### RPC principal: `get_vendas_por_filial`

Parâmetros:

```ts
{
  p_schema: schema,
  p_data_inicio: dataInicio,
  p_data_fim: dataFim,
  p_filiais: finalFiliais,
  p_filter_type: filterType
}
```

Responsabilidade:

- dataset principal da tabela
- métricas PDV por filial
- comparativos por filial
- métricas operacionais agregadas por filial

### RPC alternativa: `get_vendas_por_filial_api_filial_vendas`

Base PDV:

- `{schema}.vendas_filiais_snapshot`

Mapeamento principal:

- `valor` -> receita PDV
- `custo_total_ajustado` -> custo PDV
- `lucro_ajustado` -> lucro bruto PDV
- `margem_ajustada_percentual` -> margem bruta PDV
- `quantidade_unidades_vendidas` -> quantidade total
- `vendas.id_produto` -> SKU da listagem pela regra legada `COUNT(DISTINCT id_produto)`
- `quantidade_clientes` -> cupons/transações PDV

### RPC auxiliar: `get_total_sku_distinct`

Usada apenas quando a fonte legada está ativa.

Parâmetros:

```ts
{
  p_schema: schema,
  p_data_inicio: dataInicio,
  p_data_fim: dataFim,
  p_filiais: finalFiliais
}
```

Responsabilidade:

- total de SKU distinto do período atual

### RPC auxiliar: `get_total_sku_distinct_pa`

Usada apenas quando a fonte legada está ativa.

Parâmetros:

```ts
{
  p_schema: schema,
  p_data_inicio: dataInicio,
  p_data_fim: dataFim,
  p_filiais: finalFiliais,
  p_filter_type: filterType
}
```

Responsabilidade:

- total de SKU distinto do período comparativo da tabela

Mesmo com `enable_api_filial_vendas = true`, a rota usa `get_total_sku_distinct` e `get_total_sku_distinct_pa`, pois SKU mantém a regra legada em `vendas`.

---

## Faturamento

### API: `/api/faturamento`

Arquivo:

- [`src/app/api/faturamento/route.ts`](../../../src/app/api/faturamento/route.ts#L20)

### RPC: `get_faturamento_data`

Executada quando `por_filial !== 'true'`.

Responsabilidade:

- receita de faturamento
- CMV de faturamento
- lucro bruto de faturamento
- quantidade de notas

### RPC: `get_faturamento_por_filial`

Executada quando `por_filial === 'true'`.

Responsabilidade:

- mesmas métricas de faturamento, mas segregadas por `filial_id`

### Comportamento especial

Se a estrutura de faturamento não existir no tenant, a API retorna zeros ou array vazio para não quebrar a tela.

Referência:

- [`src/app/api/faturamento/route.ts`](../../../src/app/api/faturamento/route.ts#L91)

---

## Gráfico Mensal

### API: `/api/charts/sales-by-month`

Arquivo:

- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L21)

### RPCs usadas

#### `get_sales_by_month_chart`

Base da série mensal. Hoje ela define o conjunto-base de meses do merge.

#### `get_sales_by_month_chart_api_filial_vendas`

Versão paralela baseada em `vendas_filiais_snapshot`.

#### `get_expenses_by_month_chart`

Alimenta a barra de despesas.

#### `get_lucro_by_month_chart`

Alimenta o lucro PDV do gráfico.

#### `get_lucro_by_month_chart_api_filial_vendas`

Versão paralela baseada em `vendas_filiais_snapshot.lucro_ajustado`.

#### `get_faturamento_by_month_chart`

Alimenta receita e lucro de faturamento do gráfico.

### Parâmetros padrão

Todas usam:

```ts
{
  schema_name: requestedSchema,
  p_filiais: finalFiliais || 'all',
  p_data_inicio: dataInicio,
  p_data_fim: dataFim,
  p_filter_type: filterType
}
```

### Observação importante

O merge final é baseado em `salesData`, então meses sem registro PDV podem desaparecer mesmo com dados em outras fontes.

Referência:

- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L170)

---

## Queries Diretas sem RPC

### API: `/api/dashboard/entradas-perdas`

Arquivo:

- [`src/app/api/dashboard/entradas-perdas/route.ts`](../../../src/app/api/dashboard/entradas-perdas/route.ts#L15)

### Tabelas consultadas

- `entradas`
- `perdas`

### Regras aplicadas

- `entradas`: filtra `transacao IN ('P', 'V')`
- período por `data_entrada`
- perdas por `data_perda`
- filtragem opcional por `filial_id`

---

## Observações de Manutenção

### Ao alterar o módulo, validar impacto em:

1. `DashboardPage`
2. APIs do módulo
3. RPCs listadas acima
4. comparativos temporais
5. documentação oficial em `docs/modules/dashboard-360/`

### Ao alterar Supabase

Se alguma mudança envolver tabela, view ou função usada por estas APIs/RPCs, é obrigatório revisar:

- assinatura da função
- filtro de filiais
- regra de período
- compatibilidade com `salesType`
