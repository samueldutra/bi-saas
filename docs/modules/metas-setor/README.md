# Metas por Setor

> Status: Implementado | Versao: 1.1.0

## Visao Geral

O modulo de **Metas por Setor** permite acompanhar metas mensais por setor, filial e dia. O setor usa a configuracao de departamentos em `{schema}.setores` e resolve a hierarquia ate departamentos de nivel 1 para cruzar com produtos vendidos.

## Fonte `enable_api_filial_vendas`

Quando `enable_api_filial_vendas = true`, as APIs de leitura deixam de usar os realizados gravados diretamente em `{schema}.metas_setor` e passam a usar a tabela materializada `{schema}.vendas_setores_snapshot`.

Essa tabela e atualizada por:

- `POST /api/metas/setor/update-valores`
- RPC `public.refresh_vendas_setores_snapshot_api_filial_vendas`

Na tela, o refresh automatico envia o setor selecionado e as filiais selecionadas, evitando recalcular todos os setores/filiais a cada leitura.

As leituras usam RPCs paralelas:

- `public.get_metas_setor_report_api_filial_vendas`
- `public.get_metas_setor_summary_by_filial_api_filial_vendas`

Quando o parametro esta inativo, o modulo permanece nas RPCs legadas:

- `public.get_metas_setor_report_optimized`
- `public.get_metas_setor_summary_by_filial`
- `public.atualizar_valores_realizados_todos_setores`

## Campos do Modelo Novo

- `valor_realizado`: `{schema}.vendas_setores_snapshot.valor`
- `custo_realizado`: `{schema}.vendas_setores_snapshot.custo_total_ajustado`
- `lucro_realizado`: `{schema}.vendas_setores_snapshot.lucro_ajustado`
- `margem_realizada`: `{schema}.vendas_setores_snapshot.margem_ajustada_percentual`

Na interface, `lucro_realizado` e exibido como **Lucro Liquido** e a margem como **Margem Realizada**.

## Regra de Alocacao

O setor continua sendo definido por departamentos:

```text
setores.departamento_ids
  -> get_departamentos_hierarquia_simples(schema, nivel, ids)
  -> produtos.departamento_id
  -> vendas
```

Para alinhar ao modelo do Dashboard 360, a snapshot setorizada aplica os campos ajustados da `{schema}.vendas_filiais_snapshot` pela participacao de receita do setor no total bruto da filial/dia.

```text
participacao_receita = valor_origem_setor / valor_origem_filial
valor = vendas_filiais_snapshot.valor * participacao_receita
custo_total_ajustado = vendas_filiais_snapshot.custo_total_ajustado * participacao_receita
lucro_ajustado = valor - custo_total_ajustado
margem_ajustada_percentual = lucro_ajustado / valor * 100
```

Se nao existir snapshot da filial para o dia, a rotina usa os valores brutos de `vendas` como fallback.

## Arquivos de Referencia

- `src/app/(dashboard)/metas/setor/page.tsx`
- `src/app/api/metas/setor/report/route.ts`
- `src/app/api/metas/setor/summary/route.ts`
- `src/app/api/metas/setor/update-valores/route.ts`
- `supabase/migrations/20260601110000_add_metas_setor_api_filial_vendas.sql`
- `docs/modules/configuracoes/parametros/README.md`
