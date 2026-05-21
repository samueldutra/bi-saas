# Changelog: Configurações > Parâmetros

## 2026-05-19

### Versão documental

- `1.4.0`

### Alterações

- atualizado o comportamento documentado de `enable_api_filial_vendas`
- a fonte ativa do `Dashboard 360` passa a usar `valor`, `custo_total_ajustado`, `lucro_ajustado`, `margem_ajustada_percentual` e `quantidade_clientes` de `vendas_filiais_snapshot`
- `SKU` permanece na regra legada, com `COUNT(DISTINCT id_produto)` sobre a tabela `vendas`
- as APIs do `Dashboard 360` passam a retornar `sales_source`, e o frontend usa tipo efetivo `pdv` quando a fonte é `/filial/vendas`

### Impacto

- médio

## 2026-05-19

### Versão documental

- `1.3.0`

### Alterações

- adicionado o parâmetro numérico `margem_perda`
- criada persistência em `tenant_parameters.parameter_numeric_value`
- criado campo decimal `Margem de perda default` na tela de `Configurações > Parâmetros`
- criado helper server-side `getMargemPerdaDefault(schema)` com fallback `0.00`
- documentado o intervalo aceito de `0.00` a `99.99`

### Impacto

- médio

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
