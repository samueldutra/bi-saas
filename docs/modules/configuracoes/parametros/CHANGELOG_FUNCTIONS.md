# Changelog: Configurações > Parâmetros

## 2026-04-01

### Versão documental

- `1.0.0`

### Alterações

- criada a pasta oficial `docs/modules/configuracoes/parametros/`
- consolidada a documentação técnica do submódulo de parâmetros
- definido este diretório como fonte oficial para futuras alterações
- registrada regra permanente de manutenção em `AGENTS.md`
- atualizado o índice de documentação para apontar para esta pasta

### Impacto

- médio

### Observações

- o arquivo legado `docs/PARAMETROS_TENANT.md` passa a ser apenas um ponteiro para a documentação oficial

## 2026-04-01

### Versão documental

- `1.1.0`

### Alterações

- adicionado o parâmetro `enable_api_filial_vendas`
- criado o toggle `Utiliza API /filial/vendas` na tela de `Configurações > Parâmetros`
- mantido o parâmetro sem regra aplicada, apenas com persistência por tenant

### Impacto

- baixo

## 2026-04-01

### Versão documental

- `1.2.0`

### Alterações

- `enable_api_filial_vendas` deixou de ser parâmetro reservado
- o parâmetro passou a controlar a seleção das RPCs do `Dashboard 360`
- documentada a nova base `vendas_filiais_snapshot` como origem PDV derivada da API `/filial/vendas`
- registrada a regra `ticket médio = vendas / quantidade_clientes`

### Impacto

- médio
