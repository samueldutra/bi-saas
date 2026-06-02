# Funcoes RPC: Metas por Setor

## Fonte Legada

- `get_metas_setor_report_optimized`
- `get_metas_setor_summary_by_filial`
- `atualizar_valores_realizados_todos_setores`
- `atualizar_valores_realizados_todos_setores_com_faturamento`

Essas funcoes continuam sendo usadas quando `enable_api_filial_vendas = false`.

## Fonte API `/filial/vendas`

### `refresh_vendas_setores_snapshot_api_filial_vendas`

Materializa `{schema}.vendas_setores_snapshot` para um periodo.

Parametros:

- `p_schema text`
- `p_data_inicio date`
- `p_data_fim date`
- `p_setor_id bigint default null`
- `p_filial_ids bigint[] default null`

Quando chamados pela tela, `p_setor_id` e `p_filial_ids` devem ser preenchidos a partir dos filtros atuais. `null` permanece suportado para rotinas administrativas que precisem recalcular o periodo completo.

Retorno:

- `success`
- `rows_deleted`
- `rows_updated`
- `sales_source = api_filial_vendas`
- `profit_source = vendas_setores_snapshot`

### `get_metas_setor_report_api_filial_vendas`

Retorna a listagem diaria no mesmo contrato da RPC otimizada legada, mas substitui os realizados pelos campos da snapshot setorizada.

Campos relevantes por filial:

- `valor_realizado`
- `custo_realizado`
- `lucro_realizado`
- `margem_realizada`
- `sales_source`
- `profit_source`

### `get_metas_setor_summary_by_filial_api_filial_vendas`

Retorna o resumo mensal por filial. O contrato mantem os nomes `lucro_bruto` e `margem_bruta` para compatibilidade com o frontend, mas a tela exibe esses valores como Lucro Liquido e Margem Realizada no modelo novo.

## Garantia de Legado

As RPCs antigas nao foram alteradas. A escolha da fonte acontece nas API routes por meio de `isApiFilialVendasEnabled(schema)`.
