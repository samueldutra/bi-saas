# Dashboard 360 - Riscos Reais e Refatorações Prioritárias

## Índice

1. [Prioridade Alta](#prioridade-alta)
2. [Prioridade Média](#prioridade-média)
3. [Prioridade Baixa](#prioridade-baixa)

---

## Prioridade Alta

### 1. Corrigir a coerência do `Ticket Médio` por `salesType`

**Problema atual**

- As colunas principais da tabela respeitam `complete`, `pdv` e `faturamento`.
- O `Ticket Médio` não acompanha a mesma regra nas linhas.
- No total, o cálculo mistura denominador PDV com receita que pode incluir faturamento.

**Impacto**

- leitura inconsistente da tabela
- comparativos potencialmente incorretos fora do modo `pdv`

**Referências**

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1904)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L2126)

**Direção de refatoração**

- decidir semanticamente o que é `Ticket Médio` em `complete`
- separar `Ticket Médio PDV` de um eventual indicador próprio para faturamento
- alinhar cards, tabela e exportação PDF

### 2. Reduzir divergência entre regras de comparação

**Problema atual**

- cards usam uma regra de `PA`
- tabela por filial usa outra lógica para `custom` vs `month/year`

**Impacto**

- dificulta suporte
- aumenta chance de “bug visual” que na verdade é regra diferente

**Referências**

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L575)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L615)

**Direção de refatoração**

- centralizar um serviço de comparação temporal
- documentar explicitamente quando a regra é global e quando é exclusiva da tabela

---

## Prioridade Média

### 3. Refatorar `dashboard/page.tsx` em hooks e blocos de domínio

**Problema atual**

- a página concentra estado, IO, cálculos de data, composição financeira, renderização e exportação PDF

**Impacto**

- manutenção cara
- teste difícil
- alto risco de regressão por efeito colateral

**Referência**

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L1)

**Direção de refatoração**

- extrair `use-dashboard-filters`
- extrair `use-dashboard-comparisons`
- extrair `use-dashboard-consolidation`
- extrair tabela e cards para componentes de domínio

### 4. Tornar o gráfico independente da base PDV

**Problema atual**

- o merge mensal depende da lista-base de `salesData`

**Impacto**

- meses sem PDV podem sumir mesmo havendo despesa ou faturamento

**Referência**

- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L170)

**Direção de refatoração**

- gerar união de meses entre todas as fontes antes do merge
- normalizar a série temporal no backend

### 5. Centralizar lógica de datas auxiliares

**Problema atual**

- datas de `PA`, `MTD`, `YTD` e comparativo da tabela são calculadas em vários blocos separados

**Impacto**

- duplicação
- regra difícil de revisar

**Referências**

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L477)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L575)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L615)

---

## Prioridade Baixa

### 6. Remover logs de debug permanentes

**Problema atual**

- há `console.log` de debug para YTD, MTD e APIs

**Impacto**

- ruído em debug
- maior dificuldade para identificar logs relevantes

**Referências**

- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L391)
- [`src/app/(dashboard)/dashboard/page.tsx`](../../../src/app/(dashboard)/dashboard/page.tsx#L412)
- [`src/app/api/charts/sales-by-month/route.ts`](../../../src/app/api/charts/sales-by-month/route.ts#L81)

### 7. Revisar semântica de `custom` no mês atual

**Problema atual**

- `month` no mês atual vai até ontem
- `custom`, ao iniciar no mês atual, usa fim do mês

**Impacto**

- diferença de comportamento entre filtros aparentemente equivalentes

**Referência**

- [`src/components/dashboard/dashboard-filter.tsx`](../../../src/components/dashboard/dashboard-filter.tsx#L153)

**Direção de refatoração**

- definir se `custom` deve herdar a regra de “até ontem” quando cair no mês corrente

