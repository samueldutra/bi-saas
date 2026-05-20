# Dashboard 360 - Regras de Negócio

## Índice

1. [Regras de Acesso](#regras-de-acesso)
2. [Regras de Filtros](#regras-de-filtros)
3. [Regras de Comparação Temporal](#regras-de-comparação-temporal)
4. [Regras de Consolidação por Tipo de Venda](#regras-de-consolidação-por-tipo-de-venda)
5. [Regras da Tabela por Filial](#regras-da-tabela-por-filial)
6. [Regras de Exibição](#regras-de-exibição)

---

## Regras de Acesso

### RN-ACCESS-001: o módulo depende de tenant ativo

O `Dashboard 360` só opera quando o tenant atual estiver resolvido no `TenantProvider`.

Referências:

- [`src/app/(dashboard)/layout.tsx`](../../../src/app/(dashboard)/layout.tsx#L6)
- [`src/contexts/tenant-context.tsx`](../../../src/contexts/tenant-context.tsx#L13)

### RN-ACCESS-002: toda API valida schema e usuário

Antes de buscar qualquer dado, as APIs do módulo validam:

- usuário autenticado
- acesso ao `schema` do tenant
- conjunto de filiais autorizadas

Referências:

- [`src/app/api/dashboard/route.ts`](../../../src/app/api/dashboard/route.ts#L21)
- [`src/app/api/dashboard/vendas-por-filial/route.ts`](../../../src/app/api/dashboard/vendas-por-filial/route.ts#L12)
- [`src/app/api/faturamento/route.ts`](../../../src/app/api/faturamento/route.ts#L22)

### RN-ACCESS-003: restrição de filiais é fail-safe

Quando o usuário não informa filiais ou informa filiais fora do escopo permitido, as APIs usam:

- todas as filiais autorizadas, se houver restrição
- todas as filiais do tenant, se não houver restrição

Referência:

- [`src/lib/authorized-branches.ts`](../../../src/lib/authorized-branches.ts#L55)

### RN-ACCESS-004: origem PDV pode mudar por tenant

As APIs do módulo escolhem entre RPCs legadas e RPCs baseadas em `vendas_filiais_snapshot` conforme o valor de `enable_api_filial_vendas` para o schema corrente.

Referências:

- [`src/lib/tenant-parameters-server.ts`](../../../src/lib/tenant-parameters-server.ts#L1)
- [`src/app/api/dashboard/route.ts`](../../../src/app/api/dashboard/route.ts#L64)

---

## Regras de Filtros

### RN-FILTER-001: filtros centrais do módulo

Os filtros funcionais do módulo são:

- intervalo de datas
- tipo de período (`month`, `year`, `custom`)
- filiais
- tipo de venda (`complete`, `pdv`, `faturamento`)

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L182)

### RN-FILTER-002: filtro `month` é sempre mês do ano atual

Ao trocar para `month`, o componente reseta para o mês e ano correntes. Não existe seleção de mês em anos passados dentro desse modo.

Referência:

- [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L134)

### RN-FILTER-003: mês atual vai até ontem

Quando o período selecionado é o mês atual, o fim padrão do intervalo é `ontem`, nunca o dia corrente.

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L171)
- [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L66)

### RN-FILTER-004: filtro `year` usa ano fechado

No modo `year`, o intervalo sempre é `01/01` a `31/12` do ano selecionado.

Referência:

- [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L109)

### RN-FILTER-005: filtro `custom` aplica datas literais

No modo `custom`, o período utilizado é exatamente o par de datas informado pelo usuário.

Referência:

- [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L121)

---

## Regras de Comparação Temporal

### RN-COMP-001: cards principais usam `PA`

Os cards principais usam o período anterior (`PA`) como base de comparação principal, com duas regras:

- ano completo: compara com ano anterior completo
- demais cenários: compara com o mesmo período deslocado um mês para trás

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L575)

### RN-COMP-002: `MTD` só existe no modo `month`

As comparações `Month-to-Date` só são exibidas quando `filterType === 'month'`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L306)

### RN-COMP-003: `YTD` do card é restrito ao ano atual

O bloco `YTD` dos cards só é exibido quando o frontend entende que o filtro representa o ano atual no padrão esperado pela tela.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L252)

### RN-COMP-004: comparação da tabela por filial é diferente da dos cards

Para a tabela por filial:

- `custom`: compara com o período imediatamente anterior de mesmo tamanho
- `month` e `year`: compara com o mesmo intervalo do ano anterior

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L615)

### RN-COMP-005: cards de Entradas e Perdas têm regras próprias

Entradas e perdas usam datas auxiliares específicas para `MTD` e para comparação anual, calculadas localmente antes das chamadas de API.

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L477)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L523)

---

## Regras de Consolidação por Tipo de Venda

### RN-SALES-001: `complete` soma PDV + faturamento

Quando `salesType === 'complete'`, o frontend soma:

- receita PDV + receita faturamento
- lucro PDV + lucro faturamento
- custo PDV + CMV faturamento

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L776)

### RN-SALES-002: `pdv` usa apenas dados do dashboard base

Quando `salesType === 'pdv'`, os totais e comparativos usam exclusivamente a resposta de `get_dashboard_data` e derivados.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L796)

### RN-SALES-003: `faturamento` usa apenas APIs de faturamento

Quando `salesType === 'faturamento'`, os totais e comparativos de receita/lucro/custo dependem das APIs `/api/faturamento`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L803)

### RN-SALES-004: ticket médio da fonte `/filial/vendas`

Quando `enable_api_filial_vendas = true`, o ticket médio PDV deve usar:

```text
ticket_medio = vendas / quantidade_clientes
```

### RN-SALES-005: campos ajustados da fonte `/filial/vendas`

Quando `enable_api_filial_vendas = true`, indicadores PDV, comparativos e gráfico devem usar os campos ajustados de `vendas_filiais_snapshot`:

- Receita Bruta: `valor`
- Custo: `custo_total_ajustado`
- Lucro Bruto: `lucro_ajustado`
- Margem Bruta: `margem_ajustada_percentual`

A margem agregada deve preservar a coluna de margem da fonte usando ponderação por `valor`; se não houver margem válida, o fallback é `SUM(lucro_ajustado) / SUM(valor) * 100`.

### RN-SALES-006: frontend efetivo na fonte `/filial/vendas`

Quando as APIs do Dashboard retornam `sales_source = api_filial_vendas`, o frontend deve renderizar cards, gráfico e tabela com `salesType` efetivo igual a `pdv`, mesmo que o estado anterior da tela fosse `complete`.

Essa regra impede que a tela some dados de Faturamento por cima dos campos definidos pela fonte `vendas_filiais_snapshot`.

---

## Regras da Tabela por Filial

### RN-TABLE-001: a tabela base vem da RPC `get_vendas_por_filial`

A listagem principal da tabela é sempre construída a partir da resposta `vendas` retornada por `/api/dashboard/vendas-por-filial`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1204)

### RN-TABLE-002: colunas de receita, custo, lucro e margem respeitam o tipo de venda efetivo

Cada linha recalcula esses campos com base no tipo de venda efetivo, usando dados de PDV, faturamento ou ambos. Com `sales_source = api_filial_vendas`, o tipo efetivo é sempre `pdv`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1829)

### RN-TABLE-003: `Ticket Médio` depende da fonte PDV ativa

Na implementação atual, o `ticket_medio` continua ancorado em PDV, mas a fórmula depende da família de RPCs em uso:

- fonte legada: segue a regra da base `vendas_diarias_por_filial`
- fonte `/filial/vendas`: usa `vendas / quantidade_clientes`

Referências:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1814)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L2126)

### RN-TABLE-004: `SKU` total depende da fonte PDV ativa

Com a fonte legada, o total de `SKU` na linha de totalização usa valores distintos vindos de APIs auxiliares.

Com `enable_api_filial_vendas = true`, `SKU` deve vir de `vendas_filiais_snapshot.quantidade_unidades_vendidas`, incluindo a totalização retornada pela própria rota `/api/dashboard/vendas-por-filial`.

Referências:

- [`src/app/api/dashboard/vendas-por-filial/route.ts`](../../../src/app/api/dashboard/vendas-por-filial/route.ts#L89)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L2078)

---

## Regras de Exibição

### RN-VIEW-001: a página registra auditoria de acesso

Ao carregar o módulo com tenant e perfil válidos, a página dispara `logModuleAccess`.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L342)

### RN-VIEW-002: exportação PDF depende da tabela ordenada

A exportação PDF usa exatamente o dataset `sortedVendasPorFilial`, preservando ordenação, período e totalização da tela.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L927)

### RN-VIEW-003: `Trocas` é placeholder

O card `Trocas` é apenas visual e ainda não possui integração de dados.

Referência:

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1610)
