-- Atualiza a regra de SKU da listagem do Dashboard 360.
-- Mesmo com enable_api_filial_vendas ativo, SKU deve usar a regra legada:
-- COUNT(DISTINCT id_produto) em <schema>.vendas.

DROP FUNCTION IF EXISTS public.get_vendas_por_filial_api_filial_vendas(text, date, date, text, text);

CREATE OR REPLACE FUNCTION public.get_vendas_por_filial_api_filial_vendas(
  p_schema text,
  p_data_inicio date,
  p_data_fim date,
  p_filiais text DEFAULT 'all'::text,
  p_filter_type text DEFAULT 'year'::text
)
RETURNS TABLE(
  filial_id bigint,
  valor_total numeric,
  custo_total numeric,
  total_lucro numeric,
  quantidade_total numeric,
  total_transacoes numeric,
  ticket_medio numeric,
  margem_lucro numeric,
  pa_valor_total numeric,
  pa_custo_total numeric,
  pa_total_lucro numeric,
  pa_total_transacoes numeric,
  pa_ticket_medio numeric,
  pa_margem_lucro numeric,
  delta_valor numeric,
  delta_valor_percent numeric,
  delta_custo numeric,
  delta_custo_percent numeric,
  delta_lucro numeric,
  delta_lucro_percent numeric,
  delta_margem numeric,
  total_entradas numeric,
  pa_total_entradas numeric,
  delta_entradas numeric,
  delta_entradas_percent numeric,
  total_cupons bigint,
  pa_total_cupons bigint,
  delta_cupons bigint,
  delta_cupons_percent numeric,
  total_sku numeric,
  pa_total_sku numeric,
  delta_sku numeric,
  delta_sku_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_pa_data_inicio date;
  v_pa_data_fim date;
  v_filiais_array bigint[];
BEGIN
  IF p_filter_type = 'month' THEN
    v_pa_data_inicio := p_data_inicio - interval '1 year';
    v_pa_data_fim := p_data_fim - interval '1 year';
  ELSIF p_filter_type = 'year' THEN
    v_pa_data_inicio := p_data_inicio - interval '1 year';
    v_pa_data_fim := p_data_fim - interval '1 year';
  ELSE
    v_pa_data_inicio := p_data_inicio - (p_data_fim - p_data_inicio + 1);
    v_pa_data_fim := p_data_inicio - interval '1 day';
  END IF;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    v_filiais_array := string_to_array(p_filiais, ',')::bigint[];
  ELSE
    v_filiais_array := NULL;
  END IF;

  RETURN QUERY EXECUTE format(
    'WITH
    periodo_atual AS (
      SELECT
        v.filial_id,
        SUM(v.valor) AS valor_total,
        SUM(v.custo_total_ajustado) AS custo_total,
        SUM(v.lucro_ajustado) AS total_lucro,
        SUM(v.quantidade_unidades_vendidas) AS quantidade_total,
        SUM(v.quantidade_clientes)::numeric AS total_transacoes,
        SUM(v.quantidade_clientes)::bigint AS total_cupons,
        COALESCE(
          SUM(COALESCE(v.margem_ajustada_percentual, 0) * COALESCE(v.valor, 0))
            / NULLIF(SUM(CASE WHEN v.margem_ajustada_percentual IS NOT NULL THEN COALESCE(v.valor, 0) ELSE 0 END), 0),
          CASE
            WHEN COALESCE(SUM(v.valor), 0) > 0
              THEN COALESCE(SUM(v.lucro_ajustado), 0) / COALESCE(SUM(v.valor), 0) * 100
            ELSE 0
          END
        ) AS margem_lucro
      FROM %I.vendas_filiais_snapshot v
      WHERE v.data_referencia BETWEEN $1 AND $2
        AND ($5::bigint[] IS NULL OR v.filial_id = ANY($5))
      GROUP BY v.filial_id
    ),
    entradas_periodo_atual AS (
      SELECT
        e.filial_id,
        COALESCE(SUM(e.valor_total), 0) AS total_entradas
      FROM %I.entradas e
      WHERE e.transacao IN (''P'', ''V'')
        AND e.data_entrada BETWEEN $1 AND $2
        AND ($5::bigint[] IS NULL OR e.filial_id = ANY($5))
      GROUP BY e.filial_id
    ),
    sku_periodo_atual AS (
      SELECT
        v.filial_id,
        COUNT(DISTINCT v.id_produto)::bigint AS total_sku
      FROM %I.vendas v
      WHERE v.data_venda BETWEEN $1 AND $2
        AND ($5::bigint[] IS NULL OR v.filial_id = ANY($5))
      GROUP BY v.filial_id
    ),
    periodo_anterior AS (
      SELECT
        v.filial_id,
        SUM(v.valor) AS pa_valor_total,
        SUM(v.custo_total_ajustado) AS pa_custo_total,
        SUM(v.lucro_ajustado) AS pa_total_lucro,
        SUM(v.quantidade_clientes)::numeric AS pa_total_transacoes,
        SUM(v.quantidade_clientes)::bigint AS pa_total_cupons,
        COALESCE(
          SUM(COALESCE(v.margem_ajustada_percentual, 0) * COALESCE(v.valor, 0))
            / NULLIF(SUM(CASE WHEN v.margem_ajustada_percentual IS NOT NULL THEN COALESCE(v.valor, 0) ELSE 0 END), 0),
          CASE
            WHEN COALESCE(SUM(v.valor), 0) > 0
              THEN COALESCE(SUM(v.lucro_ajustado), 0) / COALESCE(SUM(v.valor), 0) * 100
            ELSE 0
          END
        ) AS pa_margem_lucro
      FROM %I.vendas_filiais_snapshot v
      WHERE v.data_referencia BETWEEN $3 AND $4
        AND ($5::bigint[] IS NULL OR v.filial_id = ANY($5))
      GROUP BY v.filial_id
    ),
    entradas_periodo_anterior AS (
      SELECT
        e.filial_id,
        COALESCE(SUM(e.valor_total), 0) AS pa_total_entradas
      FROM %I.entradas e
      WHERE e.transacao IN (''P'', ''V'')
        AND e.data_entrada BETWEEN $3 AND $4
        AND ($5::bigint[] IS NULL OR e.filial_id = ANY($5))
      GROUP BY e.filial_id
    ),
    sku_periodo_anterior AS (
      SELECT
        v.filial_id,
        COUNT(DISTINCT v.id_produto)::bigint AS pa_total_sku
      FROM %I.vendas v
      WHERE v.data_venda BETWEEN $3 AND $4
        AND ($5::bigint[] IS NULL OR v.filial_id = ANY($5))
      GROUP BY v.filial_id
    ),
    todas_filiais AS (
      SELECT DISTINCT filial_id FROM periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM sku_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM sku_periodo_anterior
    )
    SELECT
      tf.filial_id AS filial_id,
      COALESCE(pc.valor_total, 0)::numeric(15,2) AS valor_total,
      COALESCE(pc.custo_total, 0)::numeric(15,2) AS custo_total,
      COALESCE(pc.total_lucro, 0)::numeric(15,2) AS total_lucro,
      COALESCE(pc.quantidade_total, 0)::numeric(15,2) AS quantidade_total,
      COALESCE(pc.total_transacoes, 0)::numeric AS total_transacoes,
      CASE
        WHEN COALESCE(pc.total_transacoes, 0) > 0 THEN (COALESCE(pc.valor_total, 0) / pc.total_transacoes)::numeric(15,2)
        ELSE 0
      END AS ticket_medio,
      COALESCE(pc.margem_lucro, 0)::numeric(10,2) AS margem_lucro,
      COALESCE(pa.pa_valor_total, 0)::numeric(15,2) AS pa_valor_total,
      COALESCE(pa.pa_custo_total, 0)::numeric(15,2) AS pa_custo_total,
      COALESCE(pa.pa_total_lucro, 0)::numeric(15,2) AS pa_total_lucro,
      COALESCE(pa.pa_total_transacoes, 0)::numeric AS pa_total_transacoes,
      CASE
        WHEN COALESCE(pa.pa_total_transacoes, 0) > 0 THEN (COALESCE(pa.pa_valor_total, 0) / pa.pa_total_transacoes)::numeric(15,2)
        ELSE 0
      END AS pa_ticket_medio,
      COALESCE(pa.pa_margem_lucro, 0)::numeric(10,2) AS pa_margem_lucro,
      (COALESCE(pc.valor_total, 0) - COALESCE(pa.pa_valor_total, 0))::numeric(15,2) AS delta_valor,
      CASE
        WHEN COALESCE(pa.pa_valor_total, 0) > 0 THEN LEAST(((COALESCE(pc.valor_total, 0) - COALESCE(pa.pa_valor_total, 0)) / pa.pa_valor_total * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_valor_percent,
      (COALESCE(pc.custo_total, 0) - COALESCE(pa.pa_custo_total, 0))::numeric(15,2) AS delta_custo,
      CASE
        WHEN COALESCE(pa.pa_custo_total, 0) > 0 THEN LEAST(((COALESCE(pc.custo_total, 0) - COALESCE(pa.pa_custo_total, 0)) / pa.pa_custo_total * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_custo_percent,
      (COALESCE(pc.total_lucro, 0) - COALESCE(pa.pa_total_lucro, 0))::numeric(15,2) AS delta_lucro,
      CASE
        WHEN COALESCE(pa.pa_total_lucro, 0) > 0 THEN LEAST(((COALESCE(pc.total_lucro, 0) - COALESCE(pa.pa_total_lucro, 0)) / pa.pa_total_lucro * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_lucro_percent,
      (COALESCE(pc.margem_lucro, 0) - COALESCE(pa.pa_margem_lucro, 0))::numeric(10,2) AS delta_margem,
      COALESCE(epa.total_entradas, 0)::numeric(15,2) AS total_entradas,
      COALESCE(epan.pa_total_entradas, 0)::numeric(15,2) AS pa_total_entradas,
      (COALESCE(epa.total_entradas, 0) - COALESCE(epan.pa_total_entradas, 0))::numeric(15,2) AS delta_entradas,
      CASE
        WHEN COALESCE(epan.pa_total_entradas, 0) > 0 THEN LEAST(((COALESCE(epa.total_entradas, 0) - COALESCE(epan.pa_total_entradas, 0)) / epan.pa_total_entradas * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_entradas_percent,
      COALESCE(pc.total_cupons, 0)::bigint AS total_cupons,
      COALESCE(pa.pa_total_cupons, 0)::bigint AS pa_total_cupons,
      (COALESCE(pc.total_cupons, 0) - COALESCE(pa.pa_total_cupons, 0))::bigint AS delta_cupons,
      CASE
        WHEN COALESCE(pa.pa_total_cupons, 0) > 0 THEN LEAST(((COALESCE(pc.total_cupons, 0) - COALESCE(pa.pa_total_cupons, 0))::numeric / pa.pa_total_cupons * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_cupons_percent,
      COALESCE(spa.total_sku, 0)::numeric(15,3) AS total_sku,
      COALESCE(span.pa_total_sku, 0)::numeric(15,3) AS pa_total_sku,
      (COALESCE(spa.total_sku, 0) - COALESCE(span.pa_total_sku, 0))::numeric(15,3) AS delta_sku,
      CASE
        WHEN COALESCE(span.pa_total_sku, 0) > 0 THEN LEAST(((COALESCE(spa.total_sku, 0) - COALESCE(span.pa_total_sku, 0))::numeric / span.pa_total_sku * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_sku_percent
    FROM todas_filiais tf
    LEFT JOIN periodo_atual pc ON tf.filial_id = pc.filial_id
    LEFT JOIN periodo_anterior pa ON tf.filial_id = pa.filial_id
    LEFT JOIN entradas_periodo_atual epa ON tf.filial_id = epa.filial_id
    LEFT JOIN entradas_periodo_anterior epan ON tf.filial_id = epan.filial_id
    LEFT JOIN sku_periodo_atual spa ON tf.filial_id = spa.filial_id
    LEFT JOIN sku_periodo_anterior span ON tf.filial_id = span.filial_id
    WHERE COALESCE(pc.valor_total, 0) > 0
       OR COALESCE(epa.total_entradas, 0) > 0
       OR COALESCE(pc.total_cupons, 0) > 0
       OR COALESCE(spa.total_sku, 0) > 0
    ORDER BY COALESCE(pc.valor_total, 0) DESC NULLS LAST',
    p_schema, p_schema, p_schema, p_schema, p_schema, p_schema
  )
  USING p_data_inicio, p_data_fim, v_pa_data_inicio, v_pa_data_fim, v_filiais_array;
END;
$function$;

COMMENT ON FUNCTION public.get_vendas_por_filial_api_filial_vendas(text, date, date, text, text) IS
'Dashboard 360 vendas por filial - Fonte /filial/vendas usando snapshot para valores e regra legada de SKU por COUNT(DISTINCT id_produto) em vendas.';
