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
    EXECUTE format(
      'ALTER TABLE %I.metas_mensais ADD COLUMN IF NOT EXISTS meta_margem_percentual numeric',
      tenant_schema
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.generate_metas_mensais(
  p_schema text,
  p_filial_id bigint,
  p_mes integer,
  p_ano integer,
  p_meta_percentual numeric,
  p_data_referencia_inicial date,
  p_meta_margem_percentual numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_data_meta date;
  v_data_referencia date;
  v_dia_semana text;
  v_valor_referencia numeric(15, 2);
  v_desconto_referencia numeric(15, 2);
  v_valor_meta numeric(15, 2);
  v_valor_realizado numeric(15, 2);
  v_desconto_realizado numeric(15, 2);
  v_diferenca numeric(15, 2);
  v_diferenca_percentual numeric(5, 2);
  v_records_created integer := 0;
  v_first_day date;
  v_last_day date;
BEGIN
  v_first_day := make_date(p_ano, p_mes, 1);
  v_last_day := (v_first_day + interval '1 month - 1 day')::date;

  EXECUTE format('
    DELETE FROM %I.metas_mensais
    WHERE filial_id = $1
      AND EXTRACT(YEAR FROM data) = $2
      AND EXTRACT(MONTH FROM data) = $3
  ', p_schema)
  USING p_filial_id, p_ano, p_mes;

  v_data_referencia := p_data_referencia_inicial;

  FOR v_data_meta IN
    SELECT generate_series(v_first_day, v_last_day, '1 day'::interval)::date
  LOOP
    v_dia_semana := CASE EXTRACT(DOW FROM v_data_meta)
      WHEN 0 THEN 'Domingo'
      WHEN 1 THEN 'Segunda-Feira'
      WHEN 2 THEN 'Terça-Feira'
      WHEN 3 THEN 'Quarta-Feira'
      WHEN 4 THEN 'Quinta-Feira'
      WHEN 5 THEN 'Sexta-Feira'
      WHEN 6 THEN 'Sábado'
    END;

    EXECUTE format('
      SELECT COALESCE(valor_total, 0)
      FROM %I.vendas_diarias_por_filial
      WHERE filial_id = $1 AND data_venda = $2
    ', p_schema)
    INTO v_valor_referencia
    USING p_filial_id, v_data_referencia;

    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE filial_id = $1 AND data_desconto = $2
    ', p_schema)
    INTO v_desconto_referencia
    USING p_filial_id, v_data_referencia;

    v_valor_referencia := v_valor_referencia - v_desconto_referencia;
    v_valor_meta := v_valor_referencia * (1 + (p_meta_percentual / 100));

    EXECUTE format('
      SELECT COALESCE(valor_total, 0)
      FROM %I.vendas_diarias_por_filial
      WHERE filial_id = $1 AND data_venda = $2
    ', p_schema)
    INTO v_valor_realizado
    USING p_filial_id, v_data_meta;

    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE filial_id = $1 AND data_desconto = $2
    ', p_schema)
    INTO v_desconto_realizado
    USING p_filial_id, v_data_meta;

    v_valor_realizado := v_valor_realizado - v_desconto_realizado;
    v_diferenca := v_valor_realizado - v_valor_meta;

    IF v_valor_meta > 0 THEN
      v_diferenca_percentual := (v_diferenca / v_valor_meta) * 100;
    ELSE
      v_diferenca_percentual := 0;
    END IF;

    EXECUTE format('
      INSERT INTO %I.metas_mensais (
        filial_id, data, dia_semana, meta_percentual,
        meta_margem_percentual, data_referencia, valor_referencia, valor_meta,
        valor_realizado, diferenca, diferenca_percentual
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ', p_schema)
    USING
      p_filial_id, v_data_meta, v_dia_semana, p_meta_percentual,
      p_meta_margem_percentual, v_data_referencia, v_valor_referencia, v_valor_meta,
      v_valor_realizado, v_diferenca, v_diferenca_percentual;

    v_records_created := v_records_created + 1;
    v_data_referencia := v_data_referencia + interval '1 day';
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'records_created', v_records_created,
    'filial_id', p_filial_id,
    'mes', p_mes,
    'ano', p_ano,
    'meta_margem_percentual', p_meta_margem_percentual
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_metas_mensais_com_faturamento(
  p_schema text,
  p_filial_id bigint,
  p_mes integer,
  p_ano integer,
  p_meta_percentual numeric,
  p_data_referencia_inicial date,
  p_meta_margem_percentual numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_base_result jsonb;
  v_data_inicio date;
  v_data_fim date;
  v_rows_updated integer := 0;
BEGIN
  SELECT public.generate_metas_mensais(
    p_schema,
    p_filial_id,
    p_mes,
    p_ano,
    p_meta_percentual,
    p_data_referencia_inicial,
    p_meta_margem_percentual
  )
  INTO v_base_result;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  EXECUTE format(
    $sql$
      UPDATE %I.metas_mensais mm
      SET
        valor_referencia = COALESCE(mm.valor_referencia, 0) + COALESCE((
          SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
          FROM %I.faturamento f
          WHERE f.filial_id::bigint = mm.filial_id
            AND f.data_saida = mm.data_referencia
        ), 0),
        valor_meta = (
          COALESCE(mm.valor_referencia, 0) + COALESCE((
            SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
            FROM %I.faturamento f
            WHERE f.filial_id::bigint = mm.filial_id
              AND f.data_saida = mm.data_referencia
          ), 0)
        ) * (1 + (COALESCE(mm.meta_percentual, $4) / 100)),
        valor_realizado = COALESCE(mm.valor_realizado, 0) + COALESCE((
          SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
          FROM %I.faturamento f
          WHERE f.filial_id::bigint = mm.filial_id
            AND f.data_saida = mm.data
        ), 0),
        custo_realizado = COALESCE(mm.custo_realizado, 0) + COALESCE((
          SELECT SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0))
          FROM %I.faturamento f
          WHERE f.filial_id::bigint = mm.filial_id
            AND f.data_saida = mm.data
        ), 0),
        lucro_realizado =
          (COALESCE(mm.valor_realizado, 0) + COALESCE((
            SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
            FROM %I.faturamento f
            WHERE f.filial_id::bigint = mm.filial_id
              AND f.data_saida = mm.data
          ), 0))
          - (COALESCE(mm.custo_realizado, 0) + COALESCE((
            SELECT SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0))
            FROM %I.faturamento f
            WHERE f.filial_id::bigint = mm.filial_id
              AND f.data_saida = mm.data
          ), 0)),
        diferenca =
          (COALESCE(mm.valor_realizado, 0) + COALESCE((
            SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
            FROM %I.faturamento f
            WHERE f.filial_id::bigint = mm.filial_id
              AND f.data_saida = mm.data
          ), 0))
          - COALESCE(mm.valor_meta, 0),
        diferenca_percentual = CASE
          WHEN COALESCE(mm.valor_meta, 0) > 0 THEN
            (
              (
                (COALESCE(mm.valor_realizado, 0) + COALESCE((
                  SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
                  FROM %I.faturamento f
                  WHERE f.filial_id::bigint = mm.filial_id
                    AND f.data_saida = mm.data
                ), 0))
                - COALESCE(mm.valor_meta, 0)
              ) / COALESCE(mm.valor_meta, 0)
            ) * 100
          ELSE 0
        END,
        updated_at = NOW()
      WHERE mm.filial_id = $1
        AND mm.data >= $2
        AND mm.data <= $3
    $sql$,
    p_schema,
    p_schema,
    p_schema,
    p_schema,
    p_schema,
    p_schema
  )
  USING p_filial_id, v_data_inicio, v_data_fim, p_meta_percentual;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'faturamento',
    'base_result', v_base_result,
    'rows_updated_with_faturamento', v_rows_updated
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metas_mensais_report(
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
  v_filial_filter text;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
  END IF;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date;

  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    v_filial_filter := format('AND m.filial_id = ANY($1)');
  ELSIF p_filial_id IS NOT NULL THEN
    v_filial_filter := format('AND m.filial_id = %s', p_filial_id);
  ELSE
    v_filial_filter := '';
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
        COALESCE(m.valor_realizado, 0) as valor_realizado,
        COALESCE(m.custo_realizado, 0) as custo_realizado,
        COALESCE(m.lucro_realizado, 0) as lucro_realizado,
        CASE
          WHEN COALESCE(m.valor_realizado, 0) > 0 THEN
            (COALESCE(m.lucro_realizado, 0) / COALESCE(m.valor_realizado, 0)) * 100
          ELSE 0
        END as margem_realizada,
        (COALESCE(m.valor_realizado, 0) - m.valor_meta) as diferenca,
        CASE
          WHEN m.valor_meta > 0 THEN
            ((COALESCE(m.valor_realizado, 0) - m.valor_meta) / m.valor_meta * 100)
          ELSE 0
        END as diferenca_percentual
      FROM %I.metas_mensais m
      WHERE m.data >= $2
        AND m.data <= $3
        %s
      ORDER BY m.data, m.filial_id
    ),
    totais AS (
      SELECT
        COALESCE(SUM(valor_realizado), 0) as total_realizado,
        COALESCE(SUM(valor_meta), 0) as total_meta,
        COALESCE(SUM(custo_realizado), 0) as total_custo,
        COALESCE(SUM(lucro_realizado), 0) as total_lucro,
        CASE
          WHEN SUM(valor_meta) > 0 THEN
            (SUM(valor_realizado) / SUM(valor_meta) * 100)
          ELSE 0
        END as percentual_atingido,
        CASE
          WHEN SUM(valor_realizado) > 0 THEN
            (SUM(lucro_realizado) / SUM(valor_realizado) * 100)
          ELSE 0
        END as margem_bruta
      FROM metas_periodo
    )
    SELECT json_build_object(
      'metas', COALESCE((SELECT json_agg(row_to_json(metas_periodo)) FROM metas_periodo), '[]'::json),
      'total_realizado', (SELECT total_realizado FROM totais),
      'total_meta', (SELECT total_meta FROM totais),
      'total_custo', (SELECT total_custo FROM totais),
      'total_lucro', (SELECT total_lucro FROM totais),
      'percentual_atingido', (SELECT percentual_atingido FROM totais),
      'margem_bruta', (SELECT margem_bruta FROM totais)
    )
  $query$, p_schema, v_filial_filter);

  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    EXECUTE v_query INTO v_result USING p_filial_ids, v_data_inicio, v_data_fim;
  ELSE
    EXECUTE v_query INTO v_result USING v_data_inicio, v_data_fim;
  END IF;

  RETURN COALESCE(v_result, json_build_object(
    'metas', '[]'::json,
    'total_realizado', 0,
    'total_meta', 0,
    'total_custo', 0,
    'total_lucro', 0,
    'percentual_atingido', 0,
    'margem_bruta', 0
  ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar metas: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metas_mensais_summary_by_filial(
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
  v_filial_filter text;
  v_data_inicio date;
  v_data_fim date;
  v_d1_limite date;
  v_mes_atual integer;
  v_ano_atual integer;
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
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
    v_filial_filter := 'AND m.filial_id = ANY($1)';
  ELSIF p_filial_id IS NOT NULL THEN
    v_filial_filter := format('AND m.filial_id = %s', p_filial_id);
  ELSE
    v_filial_filter := '';
  END IF;

  v_query := format($query$
    WITH resumo AS (
      SELECT
        m.filial_id,
        COALESCE(SUM(m.valor_meta), 0) AS valor_meta,
        COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_meta ELSE 0 END), 0) AS valor_meta_acumulada_d1,
        COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_realizado ELSE 0 END), 0) AS valor_realizado,
        CASE
          WHEN COALESCE(SUM(m.valor_meta), 0) > 0 THEN
            (COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_realizado ELSE 0 END), 0) / COALESCE(SUM(m.valor_meta), 0)) * 100
          ELSE 0
        END AS percentual_atingido,
        CASE
          WHEN COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_meta ELSE 0 END), 0) > 0 THEN
            (COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_realizado ELSE 0 END), 0) / COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_meta ELSE 0 END), 0)) * 100
          ELSE 0
        END AS percentual_atingido_acumulado_d1,
        MAX(m.meta_margem_percentual) AS meta_margem_percentual,
        COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.lucro_realizado ELSE 0 END), 0) AS lucro_bruto,
        CASE
          WHEN COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_realizado ELSE 0 END), 0) > 0 THEN
            (COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.lucro_realizado ELSE 0 END), 0) / COALESCE(SUM(CASE WHEN m.data <= $4 THEN m.valor_realizado ELSE 0 END), 0)) * 100
          ELSE 0
        END AS margem_bruta
      FROM %I.metas_mensais m
      WHERE m.data >= $2
        AND m.data <= $3
        %s
      GROUP BY m.filial_id
      ORDER BY m.filial_id
    )
    SELECT json_build_object(
      'resumo', COALESCE((SELECT json_agg(row_to_json(resumo)) FROM resumo), '[]'::json)
    )
  $query$, p_schema, v_filial_filter);

  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    EXECUTE v_query INTO v_result USING p_filial_ids, v_data_inicio, v_data_fim, v_d1_limite;
  ELSE
    EXECUTE v_query INTO v_result USING v_data_inicio, v_data_fim, v_d1_limite;
  END IF;

  RETURN COALESCE(v_result, json_build_object('resumo', '[]'::json));
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo de metas: %', SQLERRM;
END;
$function$;
