# Estruturas de Dados: Metas por Setor

## `{schema}.metas_setor`

Tabela principal de metas diarias por setor e filial.

Campos consumidos pela tela:

- `setor_id`
- `filial_id`
- `data`
- `dia_semana`
- `data_referencia`
- `dia_semana_ref`
- `valor_referencia`
- `meta_percentual`
- `meta_margem_percentual`
- `valor_meta`
- `valor_realizado`
- `custo_realizado`
- `lucro_realizado`
- `diferenca`
- `diferenca_percentual`

## `{schema}.setores`

Define o recorte departamental do setor:

- `id`
- `nome`
- `ativo`
- `departamento_nivel`
- `departamento_ids`

## `{schema}.vendas_setores_snapshot`

Tabela criada para o modelo `enable_api_filial_vendas`.

Chave primaria:

- `setor_id`
- `filial_id`
- `data_referencia`

Campos principais:

- `valor`: receita realizada ajustada do setor
- `valor_origem`: receita bruta do setor antes da alocacao da snapshot filial
- `custo_total_ajustado`: custo ajustado alocado da snapshot filial
- `lucro_ajustado`: lucro liquido do setor
- `margem_ajustada_percentual`: margem realizada do setor
- `participacao_receita`: participacao usada para alocar os valores da filial
- `quantidade_unidades_vendidas`: quantidade vendida do setor

Campos auxiliares:

- `custo_real`
- `custo_sem_icms`
- `custo_com_encargos`
- `custo_medio`
- `custo_fiscal_medio`
- `percentual_quebra`
- `valor_icms`
- `valor_piscofins`
- `valor_quebra`
- `snapshot_filial_gravado_em`
- `created_at`
- `updated_at`
