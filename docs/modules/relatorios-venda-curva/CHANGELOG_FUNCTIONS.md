# Changelog de Funções - Vendas por Curva

> Status: ✅ Implementado

## 2026-01-19 — 1.0.0

- Adicionado arquivo de documentação da função RPC.
- Descrição detalhada da função `get_venda_curva_report`.
- Documentado fluxo de cálculo de lucro e percentuais.

**Impacto**: baixo (documentação)

**Arquivos relacionados**
- `docs/modules/relatorios-venda-curva/RPC_FUNCTIONS.md`
- `docs/modules/relatorios-venda-curva/BUSINESS_RULES.md`
- `docs/modules/relatorios-venda-curva/README.md`
- `docs/modules/relatorios-venda-curva/DATA_STRUCTURES.md`
- `docs/modules/relatorios-venda-curva/INTEGRATION_FLOW.md`

## 2026-02-03 — 1.1.0

- Adicionada função `get_venda_curva_report_fast` com base em agregados mensais.
- Incluída tabela de agregados `vendas_mensal_produto`.
- Comparativo ano anterior passou a ser resolvido dentro da RPC.

**Impacto**: alto (performance e custo)

**Arquivos relacionados**
- `docs/modules/relatorios-venda-curva/RPC_FUNCTIONS.md`
- `docs/modules/relatorios-venda-curva/README.md`
- `docs/modules/relatorios-venda-curva/INTEGRATION_FLOW.md`
