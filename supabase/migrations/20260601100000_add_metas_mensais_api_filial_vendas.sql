-- Metas Mensais: cria RPCs paralelas para leitura de realizados pela
-- snapshot da API /filial/vendas quando enable_api_filial_vendas=true.
--
-- Ordem de execucao:
-- 1. indice de apoio por tenant
-- 2. RPC de relatorio diario/mensal
-- 3. RPC de resumo por filial

-- 1. Indice de apoio na fonte snapshot
DO $$
DECLARE
  tenant_schema text;
BEGIN
  FOR tenant_schema IN
    SELECT supabase_schema
    FROM public.tenants
    WHERE is_active = true
      AND supabase_schema IS NOT NULL
      AND supabase_schema <> ''
  LOOP
    IF to_regclass(format('%I.vendas_filiais_snapshot', tenant_schema)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_vendas_filiais_snapshot_filial_data
         ON %I.vendas_filiais_snapshot (filial_id, data_referencia)',
        tenant_schema
      );
    END IF;
  END LOOP;
END $$;

-- 2. Relatorio mensal/dia usando vendas_filiais_snapshot como realizado
CREATE OR REPLACE FUNCTION public.get_metas_mensais_report_api_filial_vendas(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id integer DEFAULT NULL,
  p_filial_ids integer[] DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result json;
  v_query text;
  v_filial_ids integer[];
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
  END IF;

  IF to_regclass(format('%I.metas_mensais', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.metas_mensais nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.vendas_filiais_snapshot', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.vendas_filiais_snapshot nao encontrada', p_schema;
  END IF;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    v_filial_ids := p_filial_ids;
  ELSIF p_filial_id IS NOT NULL THEN
    v_filial_ids := ARRAY[p_filial_id];
  ELSE
    v_filial_ids := NULL;
  END IF;

  v_query := format($query$
    WITH metas_periodo AS (
      SELECT
        m.id,
        m.filial_id,
        m.data,
        CASE EXTRACT(DOW FROM m.data)
          WHEN 0 THEN 'Domingo'
          WHEN 1 THEN 'Segunda'
          WHEN 2 THEN 'Terca'
          WHEN 3 THEN 'Quarta'
          WHEN 4 THEN 'Quinta'
          WHEN 5 THEN 'Sexta'
          WHEN 6 THEN 'Sabado'
        END as dia_semana,
        m.meta_percentual,
        m.meta_margem_percentual,
        m.data_referencia,
        m.valor_referencia,
        m.valor_meta,
        COALESCE(s.valor, 0) as valor_realizado,
        COALESCE(s.custo_total_ajustado, 0) as custo_realizado,
        COALESCE(s.lucro_ajustado, 0) as lucro_realizado,
        COALESCE(
          s.margem_ajustada_percentual,
          CASE
            WHEN COALESCE(s.valor, 0) > 0 THEN
              COALESCE(s.lucro_ajustado, 0) / COALESCE(s.valor, 0) * 100
            ELSE 0
          END
        ) as margem_realizada,
        (COALESCE(s.valor, 0) - COALESCE(m.valor_meta, 0)) as diferenca,
        CASE
          WHEN COALESCE(m.valor_meta, 0) > 0 THEN
            ((COALESCE(s.valor, 0) - COALESCE(m.valor_meta, 0)) / COALESCE(m.valor_meta, 0) * 100)
          ELSE 0
        END as diferenca_percentual
      FROM %I.metas_mensais m
      LEFT JOIN %I.vendas_filiais_snapshot s
        ON s.filial_id = m.filial_id
       AND s.data_referencia = m.data
      WHERE m.data >= $2
        AND m.data <= $3
        AND ($1 IS NULL OR m.filial_id = ANY($1))
      ORDER BY m.data, m.filial_id
    ),
    totais AS (
      SELECT
        COALESCE(SUM(valor_realizado), 0) as total_realizado,
        COALESCE(SUM(valor_meta), 0) as total_meta,
        COALESCE(SUM(custo_realizado), 0) as total_custo,
        COALESCE(SUM(lucro_realizado), 0) as total_lucro,
        CASE
          WHEN COALESCE(SUM(valor_meta), 0) > 0 THEN
            (COALESCE(SUM(valor_realizado), 0) / COALESCE(SUM(valor_meta), 0) * 100)
          ELSE 0
        END as percentual_atingido,
        COALESCE(
          SUM(COALESCE(margem_realizada, 0) * COALESCE(valor_realizado, 0))
            / NULLIF(SUM(CASE WHEN margem_realizada IS NOT NULL THEN COALESCE(valor_realizado, 0) ELSE 0 END), 0),
          CASE
            WHEN COALESCE(SUM(valor_realizado), 0) > 0 THEN
              COALESCE(SUM(lucro_realizado), 0) / COALESCE(SUM(valor_realizado), 0) * 100
            ELSE 0
          END
        ) as margem_bruta
      FROM metas_periodo
    )
    SELECT json_build_object(
      'metas', COALESCE((SELECT json_agg(row_to_json(metas_periodo)) FROM metas_periodo), '[]'::json),
      'total_realizado', (SELECT total_realizado FROM totais),
      'total_meta', (SELECT total_meta FROM totais),
      'total_custo', (SELECT total_custo FROM totais),
      'total_lucro', (SELECT total_lucro FROM totais),
      'percentual_atingido', (SELECT percentual_atingido FROM totais),
      'margem_bruta', (SELECT margem_bruta FROM totais),
      'sales_source', 'api_filial_vendas',
      'profit_source', 'vendas_filiais_snapshot'
    )
  $query$, p_schema, p_schema);

  EXECUTE v_query INTO v_result USING v_filial_ids, v_data_inicio, v_data_fim;

  RETURN COALESCE(v_result, json_build_object(
    'metas', '[]'::json,
    'total_realizado', 0,
    'total_meta', 0,
    'total_custo', 0,
    'total_lucro', 0,
    'percentual_atingido', 0,
    'margem_bruta', 0,
    'sales_source', 'api_filial_vendas',
    'profit_source', 'vendas_filiais_snapshot'
  ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar metas pela snapshot de vendas por filial: %', SQLERRM;
END;
$function$;

-- 3. Resumo por filial usando vendas_filiais_snapshot como realizado
CREATE OR REPLACE FUNCTION public.get_metas_mensais_summary_by_filial_api_filial_vendas(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id integer DEFAULT NULL,
  p_filial_ids integer[] DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result json;
  v_query text;
  v_filial_ids integer[];
  v_data_inicio date;
  v_data_fim date;
  v_d1_limite date;
  v_mes_atual integer;
  v_ano_atual integer;
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
  END IF;

  IF to_regclass(format('%I.metas_mensais', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.metas_mensais nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.vendas_filiais_snapshot', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.vendas_filiais_snapshot nao encontrada', p_schema;
  END IF;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  v_mes_atual := EXTRACT(MONTH FROM CURRENT_DATE);
  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);

  IF p_mes = v_mes_atual AND p_ano = v_ano_atual THEN
    v_d1_limite := CURRENT_DATE - interval '1 day';
  ELSE
    v_d1_limite := v_data_fim;
  END IF;

  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    v_filial_ids := p_filial_ids;
  ELSIF p_filial_id IS NOT NULL THEN
    v_filial_ids := ARRAY[p_filial_id];
  ELSE
    v_filial_ids := NULL;
  END IF;

  v_query := format($query$
    WITH metas_periodo AS (
      SELECT
        m.filial_id,
        m.data,
        m.valor_meta,
        m.meta_margem_percentual,
        COALESCE(s.valor, 0) as valor_realizado,
        COALESCE(s.lucro_ajustado, 0) as lucro_realizado,
        COALESCE(
          s.margem_ajustada_percentual,
          CASE
            WHEN COALESCE(s.valor, 0) > 0 THEN
              COALESCE(s.lucro_ajustado, 0) / COALESCE(s.valor, 0) * 100
            ELSE 0
          END
        ) as margem_realizada
      FROM %I.metas_mensais m
      LEFT JOIN %I.vendas_filiais_snapshot s
        ON s.filial_id = m.filial_id
       AND s.data_referencia = m.data
      WHERE m.data >= $2
        AND m.data <= $3
        AND ($1 IS NULL OR m.filial_id = ANY($1))
    ),
    resumo AS (
      SELECT
        filial_id,
        COALESCE(SUM(valor_meta), 0) AS valor_meta,
        COALESCE(SUM(CASE WHEN data <= $4 THEN valor_meta ELSE 0 END), 0) AS valor_meta_acumulada_d1,
        COALESCE(SUM(CASE WHEN data <= $4 THEN valor_realizado ELSE 0 END), 0) AS valor_realizado,
        CASE
          WHEN COALESCE(SUM(valor_meta), 0) > 0 THEN
            (COALESCE(SUM(CASE WHEN data <= $4 THEN valor_realizado ELSE 0 END), 0) / COALESCE(SUM(valor_meta), 0)) * 100
          ELSE 0
        END AS percentual_atingido,
        CASE
          WHEN COALESCE(SUM(CASE WHEN data <= $4 THEN valor_meta ELSE 0 END), 0) > 0 THEN
            (COALESCE(SUM(CASE WHEN data <= $4 THEN valor_realizado ELSE 0 END), 0) / COALESCE(SUM(CASE WHEN data <= $4 THEN valor_meta ELSE 0 END), 0)) * 100
          ELSE 0
        END AS percentual_atingido_acumulado_d1,
        MAX(meta_margem_percentual) AS meta_margem_percentual,
        COALESCE(SUM(CASE WHEN data <= $4 THEN lucro_realizado ELSE 0 END), 0) AS lucro_bruto,
        COALESCE(
          SUM(CASE WHEN data <= $4 THEN COALESCE(margem_realizada, 0) * COALESCE(valor_realizado, 0) ELSE 0 END)
            / NULLIF(SUM(CASE WHEN data <= $4 AND margem_realizada IS NOT NULL THEN COALESCE(valor_realizado, 0) ELSE 0 END), 0),
          CASE
            WHEN COALESCE(SUM(CASE WHEN data <= $4 THEN valor_realizado ELSE 0 END), 0) > 0 THEN
              COALESCE(SUM(CASE WHEN data <= $4 THEN lucro_realizado ELSE 0 END), 0)
                / COALESCE(SUM(CASE WHEN data <= $4 THEN valor_realizado ELSE 0 END), 0) * 100
            ELSE 0
          END
        ) AS margem_bruta
      FROM metas_periodo
      GROUP BY filial_id
      ORDER BY filial_id
    )
    SELECT json_build_object(
      'resumo', COALESCE((SELECT json_agg(row_to_json(resumo)) FROM resumo), '[]'::json),
      'sales_source', 'api_filial_vendas',
      'profit_source', 'vendas_filiais_snapshot'
    )
  $query$, p_schema, p_schema);

  EXECUTE v_query INTO v_result USING v_filial_ids, v_data_inicio, v_data_fim, v_d1_limite;

  RETURN COALESCE(v_result, json_build_object(
    'resumo', '[]'::json,
    'sales_source', 'api_filial_vendas',
    'profit_source', 'vendas_filiais_snapshot'
  ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo de metas pela snapshot de vendas por filial: %', SQLERRM;
END;
$function$;
