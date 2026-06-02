# Changelog: Metas por Setor

## 2026-06-01

### Versao documental

- `1.1.0`

### Alteracoes

- criada a snapshot `{schema}.vendas_setores_snapshot`
- adicionada RPC `refresh_vendas_setores_snapshot_api_filial_vendas`
- adicionadas RPCs paralelas de leitura para `enable_api_filial_vendas`
- APIs `report`, `summary` e `update-valores` passam a selecionar o caminho novo apenas quando o parametro esta ativo
- frontend passa a exibir Lucro Liquido e Margem Realizada

### Impacto

- medio

### Compatibilidade

- tenants sem `enable_api_filial_vendas` continuam usando as RPCs e dados legados
