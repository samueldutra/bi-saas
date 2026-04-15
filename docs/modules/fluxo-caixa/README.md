# Fluxo de Caixa - Documentação Técnica

**Versão**: 0.1.0  
**Última Atualização**: 2026-04-14  
**Status**: 🚧 Beta funcional com APIs reais e saldo inicial mockado

> Esta pasta é a documentação oficial do módulo `Fluxo de Caixa`.
> A integração real com Supabase deve evoluir esta documentação no mesmo ciclo de mudança.

## Visão Geral

O módulo `Fluxo de Caixa` foi planejado para consolidar a posição de caixa por tenant, filial e período a partir de:

- Vendas PDV
- Faturamento
- Contas a Receber
- Contas a Pagar
- Ajustes manuais
- Saldos inicial e final

Nesta primeira entrega, o projeto já contém:

- Rota visual do módulo em `src/app/(dashboard)/fluxo-caixa/page.tsx`
- Filtros de período, filial, origem, status, visão e agrupamento
- Cards executivos
- Tabela do fluxo por período
- APIs reais para resumo e tabela
- Integração frontend via SWR
- Regra temporária de saldo inicial mockado

## Referência Validada no Schema `okilao`

Com base na inspeção do schema `okilao`, as fontes reais identificadas até agora são:

- `contas_receber`
- `contas_pagar`
- `entradas`
- `faturamento`
- `resumo_vendas_caixa`

Leitura funcional dessas fontes:

- `contas_receber` é a principal base para entradas financeiras realizadas e previstas.
- `contas_pagar` é a principal base para saídas financeiras realizadas e previstas.
- `faturamento` existe em granularidade operacional/fiscal e precisa de agregação para uso analítico.
- `entradas` representa entradas fiscais/compras e não deve ser tratada automaticamente como saída de caixa liquidada.
- `resumo_vendas_caixa` consolida vendas PDV por `filial`, `caixa` e `data`, mas não representa saldo de caixa.

## Arquivos Principais

### Frontend

- `src/app/(dashboard)/fluxo-caixa/page.tsx`
- `src/components/fluxo-caixa/filters.tsx`
- `src/components/fluxo-caixa/summary-cards.tsx`
- `src/components/fluxo-caixa/cash-flow-table.tsx`
- `src/components/fluxo-caixa/types.ts`

### APIs

- `src/app/api/fluxo-caixa/resumo/route.ts`
- `src/app/api/fluxo-caixa/tabela/route.ts`

### Camada de cálculo

- `src/lib/fluxo-caixa/server.ts`
- `src/lib/fluxo-caixa/transform.ts`

### Navegação

- `src/components/dashboard/app-sidebar.tsx`

## Escopo Funcional Planejado

O módulo deve suportar três visões:

- `realizado`: apenas movimentos efetivados no caixa
- `projetado`: posição final considerando títulos previstos
- `consolidado`: combinação entre realizado e previsto

Também deve suportar:

- Consolidação por filial ou visão consolidada
- Agrupamento diário, semanal e mensal
- Filtros por origem do movimento
- Identificação de períodos e filiais críticas

## Pendências para Integração Real

Antes de implementar backend real, é necessário confirmar a estrutura atual no Supabase de:

- origem de `saldo inicial`
- origem de `ajustes de caixa`
- RPCs ou views financeiras já existentes

As tabelas `contas_pagar`, `contas_receber`, `entradas`, `faturamento` e `resumo_vendas_caixa` já foram confirmadas no schema `okilao`.

O principal gap remanescente é a ausência de uma estrutura identificada para:

- saldo inicial por filial/período
- saldo atual consolidado
- ajustes manuais de caixa
- extrato de tesouraria

## Próximas Entregas Recomendadas

1. Identificar a origem oficial de saldo inicial e saldo atual de tesouraria.
2. Mapear ajustes financeiros manuais no schema dos tenants.
3. Implementar `/api/fluxo-caixa/projecao` se houver necessidade de horizonte D+N separado da tabela.
4. Evoluir controle de permissão do módulo com enum/authorized modules quando o backend estiver pronto.
5. Refinar tratamento de `entradas` e outras saídas não liquidadas, caso o negócio queira visão operacional adicional.
