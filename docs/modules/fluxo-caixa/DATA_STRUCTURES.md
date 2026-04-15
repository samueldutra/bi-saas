# Fluxo de Caixa - Estruturas de Dados

## Contrato lógico recomendado

O backend deve convergir para uma estrutura única de movimentação:

```ts
type CashFlowMovement = {
  data_movimento: string
  filial_id: string | number
  tipo: 'entrada' | 'saida'
  origem: 'pdv' | 'faturamento' | 'contas_receber' | 'contas_pagar' | 'ajuste' | 'saldo_inicial'
  status: 'realizado' | 'previsto' | 'vencido' | 'parcial'
  valor: number
  descricao?: string | null
  documento?: string | null
}
```

## Estruturas atuais do starter

### Linha base

Arquivo: `src/components/fluxo-caixa/types.ts`

- `CashFlowBaseRow`
- `CashFlowFiltersState`
- `CashFlowTableRow`
- `CashFlowSummary`

### Campos da tabela

- `saldoInicial`
- `entradasPdv`
- `entradasFaturamento`
- `recebimentosRealizados`
- `recebimentosPrevistos`
- `outrasEntradas`
- `pagamentosRealizados`
- `pagamentosPrevistos`
- `outrasSaidas`
- `saldoFinal`
- `saldoProjetado`

## Observação de modelagem

Para agrupamentos semanais e mensais, a regra sugerida é:

- `saldo inicial`: primeiro saldo do grupo
- `entradas/saídas`: soma dos movimentos do grupo
- `saldo final`: saldo inicial + movimentos realizados + ajustes
- `saldo projetado`: saldo final + previstos líquidos

## Mapeamento inicial para o schema `okilao`

### `okilao.contas_receber`

Campos mais relevantes já confirmados:

- `data_emissao`
- `data_recebimento`
- `data_vencimento`
- `filial_id`
- `status`
- `saldo`
- `valor_recebido`
- `total_documento`
- `total_recebido`
- `total_saldo`

### `okilao.contas_pagar`

Campos mais relevantes já confirmados:

- `data_emissao`
- `data_pagamento`
- `data_vencimento`
- `filial_id`
- `status`
- `saldo`
- `valor_pago`
- `total_documento`
- `total_pago`
- `total_saldo`

### `okilao.faturamento`

Campos mais relevantes já confirmados:

- `filial_id`
- `data_saida`
- `valor_contabil`
- `preco_final`
- `quantidade`
- `custo_unitario`
- `custo_medio`
- `cancelado`

### `okilao.entradas`

Campos mais relevantes já confirmados:

- `filial_id`
- `numero`
- `data_emissao`
- `data_entrada`
- `valor_total`
- `transacao`

### `okilao.resumo_vendas_caixa`

Campos confirmados:

- `filial_id`
- `caixa`
- `data`
- `qtde_cupons`
- `qtde_produtos`
- `valor_total_vendas`
- `valor_total_vendas_canceladas`
- `valor_total_produtos_cancelados`
- `valor_total_descontos`

Uso recomendado:

- origem operacional de PDV
- detalhamento por caixa
- apoio a conciliação

Uso não recomendado:

- saldo inicial
- saldo atual de tesouraria
- posição final de caixa consolidado
