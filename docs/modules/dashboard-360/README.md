# Dashboard 360 - Documentação Técnica

**Versão**: 1.2.2
**Última Atualização**: 2026-06-11
**Status**: ✅ Produção

> Esta pasta é a documentação oficial do módulo `Dashboard 360`.
> Toda alteração funcional, estrutural ou de integração neste módulo deve atualizar esta documentação no mesmo ciclo de mudança.

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquivos Principais](#arquivos-principais)
3. [Fluxo de Dados Resumido](#fluxo-de-dados-resumido)
4. [Mapa de APIs e RPCs](#mapa-de-apis-e-rpcs)
5. [Análise Prioritária de Riscos](#análise-prioritária-de-riscos)
6. [Documentos Detalhados](#documentos-detalhados)

---

## Visão Geral

O módulo **Dashboard 360** consolida indicadores comerciais e operacionais por tenant, combinando:

- **Vendas PDV**
- **Faturamento**
- **Entradas**
- **Perdas**
- **Comparações temporais** (`PA`, `MTD`, `YTD`)
- **Análise detalhada por filial**

### Seleção de origem PDV por tenant

Quando o parâmetro `enable_api_filial_vendas` está ativo para o tenant, o módulo usa versões paralelas das RPCs baseadas em `vendas_filiais_snapshot`, que espelha a API `/filial/vendas`. Nessa fonte:

- Receita Bruta vem de `vendas_filiais_snapshot.valor`
- Custo vem de `vendas_filiais_snapshot.custo_total_ajustado`
- Lucro Bruto vem de `vendas_filiais_snapshot.lucro_ajustado`
- Margem Bruta vem de `vendas_filiais_snapshot.margem_ajustada_percentual`
- Ticket Médio usa `valor / quantidade_clientes`
- Cupons vêm de `quantidade_clientes`
- SKU da listagem permanece na regra legada: `COUNT(DISTINCT id_produto)` sobre a tabela `vendas`

Quando o parâmetro está desativado, o módulo segue usando a origem legada baseada em `vendas_diarias_por_filial`.

Quando a resposta das APIs indica `sales_source = api_filial_vendas`, o frontend trata o Dashboard como `pdv` para cards, gráfico e tabela. Isso evita que o modo `complete` some Faturamento aos valores já definidos pela fonte `/filial/vendas`.

O frontend da rota [`/dashboard`](../../../src/app/(dashboard)/dashboard/page.tsx#L179) atua como orquestrador do módulo. Ele mantém os filtros, dispara múltiplas consultas paralelas via `useSWR`, consolida PDV e faturamento localmente conforme o tipo de venda efetivo e renderiza cards, gráfico e tabela.

### Tipos de venda suportados

- `complete`: soma PDV + faturamento
- `pdv`: usa apenas dados de PDV
- `faturamento`: usa apenas dados de faturamento

### Tipos de período suportados

- `month`
- `year`
- `custom`

---

## Arquivos Principais

### Frontend

- **Página principal**: [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L179)
- **Filtro de período**: [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L48)
- **Card de métrica**: [`src/components/dashboard/card-metric.tsx`](../../../src/components/dashboard/card-metric.tsx#L1)
- **Gráfico principal**: [`src/components/dashboard/chart-vendas.tsx`](../../../src/components/dashboard/chart-vendas.tsx#L43)

### Contexto e acesso

- **Layout protegido**: [`src/app/(dashboard)/layout.tsx`](../../../src/app/(dashboard)/layout.tsx#L6)
- **Tenant atual**: [`src/contexts/tenant-context.tsx`](../../../src/contexts/tenant-context.tsx#L13)
- **Filiais disponíveis**: [`src/hooks/use-branches.ts`](../../../src/hooks/use-branches.ts#L16)

### APIs do módulo

- **Resumo principal**: [`src/app/api/dashboard/route.ts`](../../../src/app/api/dashboard/route.ts#L19)
- **YTD**: [`src/app/api/dashboard/ytd-metrics/route.ts`](../../../src/app/api/dashboard/ytd-metrics/route.ts#L17)
- **MTD**: [`src/app/api/dashboard/mtd-metrics/route.ts`](../../../src/app/api/dashboard/mtd-metrics/route.ts#L17)
- **Vendas por filial**: [`src/app/api/dashboard/vendas-por-filial/route.ts`](../../../src/app/api/dashboard/vendas-por-filial/route.ts#L10)
- **Entradas e perdas**: [`src/app/api/dashboard/entradas-perdas/route.ts`](../../../src/app/api/dashboard/entradas-perdas/route.ts#L15)
- **Faturamento**: [`src/app/api/faturamento/route.ts`](../../../src/app/api/faturamento/route.ts#L20)
- **Gráfico mensal**: [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L21)

---

## Fluxo de Dados Resumido

```mermaid
flowchart TD
    A[Usuário acessa /dashboard] --> B[TenantProvider resolve tenant atual]
    B --> C[DashboardPage inicializa filtros]
    C --> D[apiParams]
    D --> E1[/api/dashboard]
    D --> E2[/api/dashboard/ytd-metrics]
    D --> E3[/api/dashboard/mtd-metrics]
    D --> E4[/api/dashboard/vendas-por-filial]
    D --> E5[/api/dashboard/entradas-perdas]
    D --> E6[/api/faturamento]
    D --> E7[/api/charts/sales-by-month]
    E1 --> F[RPC get_dashboard_data]
    E2 --> G[RPC get_dashboard_ytd_metrics]
    E3 --> H[RPC get_dashboard_mtd_metrics]
    E4 --> I[RPC get_vendas_por_filial + totalização de SKU]
    E5 --> J[Queries diretas nas tabelas entradas e perdas]
    E6 --> K[RPCs get_faturamento_data / get_faturamento_por_filial]
    E7 --> L[RPCs de vendas, despesas, lucro e faturamento por mês]
    F --> M[Consolidação local por salesType]
    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    M --> N[Cards]
    M --> O[Gráfico]
    M --> P[Tabela por filial]
```

### Etapas principais

1. O tenant atual define `schema` e contexto de autorização.
2. Os filtros locais alimentam `apiParams`.
3. Cada API valida usuário, acesso ao schema e filiais autorizadas.
4. As APIs escolhem a família de RPCs com base em `enable_api_filial_vendas`.
5. As APIs consultam RPCs Supabase ou tabelas diretas.
6. Quando qualquer resposta principal, MTD, YTD ou de vendas por filial informa `sales_source = api_filial_vendas`, a tela consolida os cards como PDV e usa a família de RPCs baseada em `{schema}.vendas_filiais_snapshot`.
7. O frontend reconcilia PDV e faturamento de acordo com o tipo de venda efetivo.
8. Os componentes visuais exibem comparativos por período.

### Dependência do PostgREST no Dashboard em Tempo Real

Os endpoints de vendas por faixa de hora e venda acumulada por loja consultam
diretamente `vendas_hoje`, `vendas_hoje_itens` e `metas_mensais` no schema do
tenant. O schema precisa estar em `pgrst.db_schemas`; caso contrário, o
PostgREST retorna `PGRST106` e a API responde HTTP 500.

As leituras de `vendas_hoje` e `vendas_hoje_itens` são paginadas em lotes de
1.000 registros para evitar totalizações parciais quando o volume diário
ultrapassa o limite padrão do PostgREST.

---

## Mapa de APIs e RPCs

| Camada | Origem | Destino | Responsabilidade |
|---|---|---|---|
| Frontend | `DashboardPage` | `/api/dashboard` | Indicadores principais de PDV |
| Frontend | `DashboardPage` | `/api/dashboard/ytd-metrics` | Comparativo YTD |
| Frontend | `DashboardPage` | `/api/dashboard/mtd-metrics` | Comparativos MTD |
| Frontend | `DashboardPage` | `/api/dashboard/vendas-por-filial` | Tabela detalhada por filial |
| Frontend | `DashboardPage` | `/api/dashboard/entradas-perdas` | Totais de entradas e perdas |
| Frontend | `DashboardPage` | `/api/faturamento` | Totais e detalhamento de faturamento |
| Frontend | `DashboardPage` | `/api/charts/sales-by-month` | Série mensal do gráfico |

As RPCs e queries exatas estão detalhadas em [RPC_FUNCTIONS.md](./RPC_FUNCTIONS.md).

---

## Análise Prioritária de Riscos

### Risco 1: regra de `Ticket Médio` não acompanha totalmente `salesType`

Na tabela por filial, `Receita`, `Custo`, `Lucro` e `Margem` mudam conforme `complete/pdv/faturamento`, mas o `Ticket Médio` da linha continua vindo de `venda.ticket_medio`, que é PDV puro. No total, o cálculo comparativo mistura `paReceitaTotal` com cupons PDV. Isso torna a coluna parcialmente inconsistente quando `salesType !== 'pdv'`.

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1813)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L2126)

### Risco 2: gráfico perde meses sem PDV base

O merge do gráfico é baseado na lista retornada por `get_sales_by_month_chart`. Se houver mês com faturamento, despesa ou lucro sem registro de PDV, esse mês não aparece porque a junção parte apenas de `salesData`.

Referência:

- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L170)

### Risco 3: regra de comparação varia entre cards e tabela

Os cards usam `PA` com mês anterior ou ano anterior em alguns cenários, enquanto a tabela por filial usa ano anterior para `month/year` e período imediatamente anterior para `custom`. A lógica atual pode ser correta por contexto, mas exige cuidado porque não é uniforme.

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L575)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L615)

### Risco 4: alto acoplamento em um único componente

A página principal concentra estado, regras temporais, composição de dados, exportação PDF e renderização em um único arquivo grande. Isso eleva risco de regressão, dificulta testes e encarece manutenção.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1)

---

## Documentos Detalhados

- [BUSINESS_RULES.md](./BUSINESS_RULES.md)
- [DATA_STRUCTURES.md](./DATA_STRUCTURES.md)
- [INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md)
- [RPC_FUNCTIONS.md](./RPC_FUNCTIONS.md)
- [RISKS_AND_REFACTORING.md](./RISKS_AND_REFACTORING.md)
- [CHANGELOG_FUNCTIONS.md](./CHANGELOG_FUNCTIONS.md)
