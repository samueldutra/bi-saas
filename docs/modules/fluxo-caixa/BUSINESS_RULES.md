# Fluxo de Caixa - Regras de Negócio

## Regras funcionais planejadas

### RN-001: visão consolidada

A visão consolidada deve combinar:

- entradas realizadas
- saídas realizadas
- títulos previstos
- saldo final projetado

### RN-002: status da linha

Cada linha do fluxo deve receber status operacional:

- `saudável`: saldo projetado acima da faixa mínima
- `atenção`: saldo projetado baixo, mas positivo
- `crítico`: saldo projetado negativo

No starter atual, os thresholds são visuais e mockados:

- `< 0`: crítico
- `< 25.000`: atenção
- `>= 25.000`: saudável

### RN-003: filtro por origem

O filtro de origem deve permitir analisar separadamente:

- PDV
- faturamento
- contas a receber
- contas a pagar
- ajustes

Regra de interpretação com base no schema `okilao`:

- `PDV` deve usar `resumo_vendas_caixa` como origem operacional.
- `Contas a receber` deve ser a base principal de entrada de caixa.
- `Contas a pagar` deve ser a base principal de saída de caixa.
- `Faturamento` deve entrar como visão operacional/comercial complementar e não como caixa liquidado automático.
- `Entradas` deve entrar como visão de compras/documentos e não como desembolso liquidado automático.

### RN-004: quebra por filial

O usuário deve poder alternar entre:

- visão consolidada
- visão por filial

### RN-005: posição projetada

Saldo projetado = saldo realizado + recebimentos previstos - pagamentos previstos

## Regras dependentes de validação no banco

Estas regras ainda dependem de confirmação estrutural:

- origem oficial do saldo inicial
- política de ajuste manual
- tratamento de títulos vencidos e parcialmente liquidados

As regras de baixa já têm bons indícios no `okilao`:

- `contas_receber`: realizado por `data_recebimento` e `valor_recebido`; previsto por `data_vencimento` e `saldo`
- `contas_pagar`: realizado por `data_pagamento` e `valor_pago`; previsto por `data_vencimento` e `saldo`
