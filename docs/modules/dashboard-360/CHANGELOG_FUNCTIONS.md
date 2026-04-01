# Dashboard 360 - Changelog da Documentação

## 2026-04-01 - v1.0.0

### Adicionado

- documentação oficial inicial do módulo `Dashboard 360`
- visão geral do módulo
- regras de negócio
- estruturas de dados
- fluxo de integração
- mapa de APIs e RPCs
- análise priorizada de riscos e refatorações

### Arquivos criados

- [README.md](./README.md)
- [BUSINESS_RULES.md](./BUSINESS_RULES.md)
- [DATA_STRUCTURES.md](./DATA_STRUCTURES.md)
- [INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md)
- [RPC_FUNCTIONS.md](./RPC_FUNCTIONS.md)
- [RISKS_AND_REFACTORING.md](./RISKS_AND_REFACTORING.md)

### Objetivo

Estabelecer uma referência oficial para entender:

- lógica funcional do módulo
- composição de dados PDV e faturamento
- regras temporais
- dependências de API e RPC
- pontos sensíveis para futuras alterações

## 2026-04-01 - v1.1.0

### Alterado

- adicionada documentação do parâmetro `enable_api_filial_vendas`
- documentada a nova origem PDV baseada em `vendas_filiais_snapshot`
- mapeadas as RPCs paralelas `_api_filial_vendas`
- registrada a regra `ticket médio = vendas / quantidade_clientes`
