-- Dashboard 360: corrige a fonte alternativa /filial/vendas para usar
-- custo_total_ajustado como custo e lucro_ajustado como lucro bruto.

CREATE OR REPLACE FUNCTION public.get_dashboard_data_api_filial_vendas(
  schema_name text,
  p_data_inicio date,
  p_data_fim date,
  p_filiais_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  total_vendas numeric,
  total_lucro numeric,
  ticket_medio numeric,
  margem_lucro numeric,
  pa_vendas numeric,
  pa_lucro numeric,
  pa_ticket_medio numeric,
  pa_margem_lucro numeric,
  variacao_vendas_mes numeric,
  variacao_lucro_mes numeric,
  variacao_ticket_mes numeric,
  variacao_margem_mes numeric,
  variacao_vendas_ano numeric,
  variacao_lucro_ano numeric,
  variacao_ticket_ano numeric,
  variacao_margem_ano numeric,
  ytd_vendas numeric,
  ytd_vendas_ano_anterior numeric,
  ytd_variacao_percent numeric,
  grafico_vendas json,
  reserved text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_total_vendas numeric := 0;
  v_total_lucro numeric := 0;
  v_total_clientes numeric := 0;
  v_ticket_medio numeric := 0;
  v_margem_lucro numeric := 0;

  v_pa_vendas numeric := 0;
  v_pa_lucro numeric := 0;
  v_pa_clientes numeric := 0;
  v_pa_ticket_medio numeric := 0;
  v_pa_margem_lucro numeric := 0;

  v_paa_vendas numeric := 0;
  v_paa_lucro numeric := 0;
  v_paa_clientes numeric := 0;
  v_paa_ticket_medio numeric := 0;
  v_paa_margem_lucro numeric := 0;

  v_ytd_vendas numeric := 0;
  v_ytd_vendas_ano_anterior numeric := 0;
  v_ytd_variacao_percent numeric := 0;

  v_variacao_vendas_mes numeric := 0;
  v_variacao_lucro_mes numeric := 0;
  v_variacao_ticket_mes numeric := 0;
  v_variacao_margem_mes numeric := 0;

  v_variacao_vendas_ano numeric := 0;
  v_variacao_lucro_ano numeric := 0;
  v_variacao_ticket_ano numeric := 0;
  v_variacao_margem_ano numeric := 0;

  v_grafico_vendas json := '[]'::json;

  v_data_inicio_pa date;
  v_data_fim_pa date;
  v_data_inicio_paa date;
  v_data_fim_paa date;
  v_data_inicio_ytd date;
  v_data_fim_ytd date;
  v_data_inicio_ytd_ano_anterior date;
  v_data_fim_ytd_ano_anterior date;
BEGIN
  v_data_inicio_pa := (p_data_inicio - interval '1 month')::date;
  v_data_fim_pa := (p_data_fim - interval '1 month')::date;

  v_data_inicio_paa := (p_data_inicio - interval '1 year')::date;
  v_data_fim_paa := (p_data_fim - interval '1 year')::date;

  v_data_inicio_ytd := date_trunc('year', p_data_inicio)::date;
  v_data_fim_ytd := p_data_fim;
  v_data_inicio_ytd_ano_anterior := (v_data_inicio_ytd - interval '1 year')::date;
  v_data_fim_ytd_ano_anterior := (v_data_fim_ytd - interval '1 year')::date;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(SUM(quantidade_clientes), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING p_data_inicio, p_data_fim, p_filiais_ids
  INTO v_total_vendas, v_total_lucro, v_total_clientes, v_margem_lucro;

  IF v_total_clientes > 0 THEN
    v_ticket_medio := v_total_vendas / v_total_clientes;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(SUM(quantidade_clientes), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_pa, v_data_fim_pa, p_filiais_ids
  INTO v_pa_vendas, v_pa_lucro, v_pa_clientes, v_pa_margem_lucro;

  IF v_pa_clientes > 0 THEN
    v_pa_ticket_medio := v_pa_vendas / v_pa_clientes;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(SUM(quantidade_clientes), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_paa, v_data_fim_paa, p_filiais_ids
  INTO v_paa_vendas, v_paa_lucro, v_paa_clientes, v_paa_margem_lucro;

  IF v_paa_clientes > 0 THEN
    v_paa_ticket_medio := v_paa_vendas / v_paa_clientes;
  END IF;

  IF v_pa_vendas > 0 THEN
    v_variacao_vendas_mes := ((v_total_vendas - v_pa_vendas) / v_pa_vendas) * 100;
  END IF;

  IF v_pa_lucro > 0 THEN
    v_variacao_lucro_mes := ((v_total_lucro - v_pa_lucro) / v_pa_lucro) * 100;
  END IF;

  IF v_pa_ticket_medio > 0 THEN
    v_variacao_ticket_mes := ((v_ticket_medio - v_pa_ticket_medio) / v_pa_ticket_medio) * 100;
  END IF;

  v_variacao_margem_mes := v_margem_lucro - v_pa_margem_lucro;

  IF v_paa_vendas > 0 THEN
    v_variacao_vendas_ano := ((v_total_vendas - v_paa_vendas) / v_paa_vendas) * 100;
  END IF;

  IF v_paa_lucro > 0 THEN
    v_variacao_lucro_ano := ((v_total_lucro - v_paa_lucro) / v_paa_lucro) * 100;
  END IF;

  IF v_paa_ticket_medio > 0 THEN
    v_variacao_ticket_ano := ((v_ticket_medio - v_paa_ticket_medio) / v_paa_ticket_medio) * 100;
  END IF;

  v_variacao_margem_ano := v_margem_lucro - v_paa_margem_lucro;

  EXECUTE format(
    'SELECT COALESCE(SUM(valor), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
  INTO v_ytd_vendas;

  EXECUTE format(
    'SELECT COALESCE(SUM(valor), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
  INTO v_ytd_vendas_ano_anterior;

  IF v_ytd_vendas_ano_anterior > 0 THEN
    v_ytd_variacao_percent := ((v_ytd_vendas - v_ytd_vendas_ano_anterior) / v_ytd_vendas_ano_anterior) * 100;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(
      json_agg(
        json_build_object(
          ''mes'', TO_CHAR(period_date, ''DD/MM''),
          ''ano_atual'', vendas_atual,
          ''ano_anterior'', vendas_anterior
        )
        ORDER BY period_date
      ),
      ''[]''::json
    )
    FROM (
      SELECT
        gs::date AS period_date,
        COALESCE(sc.total_vendas, 0) AS vendas_atual,
        COALESCE(sp.total_vendas, 0) AS vendas_anterior
      FROM generate_series($1::date, $2::date, interval ''1 day'') gs
      LEFT JOIN (
        SELECT data_referencia, SUM(valor) AS total_vendas
        FROM %I.vendas_filiais_snapshot
        WHERE data_referencia BETWEEN $1 AND $2
          AND ($3 IS NULL OR filial_id::text = ANY($3))
        GROUP BY data_referencia
      ) sc ON sc.data_referencia = gs::date
      LEFT JOIN (
        SELECT data_referencia, SUM(valor) AS total_vendas
        FROM %I.vendas_filiais_snapshot
        WHERE data_referencia BETWEEN ($1 - interval ''1 year'')::date AND ($2 - interval ''1 year'')::date
          AND ($3 IS NULL OR filial_id::text = ANY($3))
        GROUP BY data_referencia
      ) sp ON sp.data_referencia = (gs::date - interval ''1 year'')::date
    ) dados',
    schema_name,
    schema_name
  )
  USING p_data_inicio, p_data_fim, p_filiais_ids
  INTO v_grafico_vendas;

  RETURN QUERY
  SELECT
    v_total_vendas,
    v_total_lucro,
    v_ticket_medio,
    v_margem_lucro,
    v_pa_vendas,
    v_pa_lucro,
    v_pa_ticket_medio,
    v_pa_margem_lucro,
    v_variacao_vendas_mes,
    v_variacao_lucro_mes,
    v_variacao_ticket_mes,
    v_variacao_margem_mes,
    v_variacao_vendas_ano,
    v_variacao_lucro_ano,
    v_variacao_ticket_ano,
    v_variacao_margem_ano,
    v_ytd_vendas,
    v_ytd_vendas_ano_anterior,
    v_ytd_variacao_percent,
    v_grafico_vendas,
    NULL::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_mtd_metrics_api_filial_vendas(
  schema_name text,
  p_data_inicio date,
  p_data_fim date,
  p_filiais_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  mtd_vendas numeric,
  mtd_lucro numeric,
  mtd_margem numeric,
  mtd_mes_anterior_vendas numeric,
  mtd_mes_anterior_lucro numeric,
  mtd_mes_anterior_margem numeric,
  mtd_variacao_mes_anterior_vendas_percent numeric,
  mtd_variacao_mes_anterior_lucro_percent numeric,
  mtd_variacao_mes_anterior_margem numeric,
  mtd_ano_anterior_vendas numeric,
  mtd_ano_anterior_lucro numeric,
  mtd_ano_anterior_margem numeric,
  mtd_variacao_ano_anterior_vendas_percent numeric,
  mtd_variacao_ano_anterior_lucro_percent numeric,
  mtd_variacao_ano_anterior_margem numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_reference_day integer;
  v_mtd_end_day integer;
  v_is_full_past_month boolean;

  v_data_inicio_mtd date;
  v_data_fim_mtd date;
  v_data_inicio_mtd_mes_anterior date;
  v_data_fim_mtd_mes_anterior date;
  v_data_inicio_mtd_ano_anterior date;
  v_data_fim_mtd_ano_anterior date;

  v_mtd_vendas numeric := 0;
  v_mtd_lucro numeric := 0;
  v_mtd_margem numeric := 0;

  v_mtd_mes_anterior_vendas numeric := 0;
  v_mtd_mes_anterior_lucro numeric := 0;
  v_mtd_mes_anterior_margem numeric := 0;

  v_mtd_ano_anterior_vendas numeric := 0;
  v_mtd_ano_anterior_lucro numeric := 0;
  v_mtd_ano_anterior_margem numeric := 0;

  v_mtd_variacao_mes_anterior_vendas_percent numeric := 0;
  v_mtd_variacao_mes_anterior_lucro_percent numeric := 0;
  v_mtd_variacao_mes_anterior_margem numeric := 0;
  v_mtd_variacao_ano_anterior_vendas_percent numeric := 0;
  v_mtd_variacao_ano_anterior_lucro_percent numeric := 0;
  v_mtd_variacao_ano_anterior_margem numeric := 0;

  v_last_day_mes_anterior integer;
  v_last_day_ano_anterior integer;
  v_is_first_day_of_month boolean;
  v_last_day_of_filter_month integer;
  v_is_last_day_of_month boolean;
  v_is_past_month boolean;
BEGIN
  v_is_first_day_of_month := EXTRACT(DAY FROM p_data_inicio) = 1;
  v_last_day_of_filter_month := EXTRACT(DAY FROM (date_trunc('month', p_data_inicio) + interval '1 month' - interval '1 day')::date);
  v_is_last_day_of_month := EXTRACT(DAY FROM p_data_fim) = v_last_day_of_filter_month;
  v_is_past_month := p_data_fim < current_date;
  v_is_full_past_month := v_is_first_day_of_month AND v_is_last_day_of_month AND v_is_past_month;

  IF p_data_fim >= current_date THEN
    v_reference_day := EXTRACT(DAY FROM current_date);
  ELSE
    v_reference_day := EXTRACT(DAY FROM p_data_fim);
  END IF;

  v_data_inicio_mtd := date_trunc('month', p_data_inicio)::date;
  v_data_fim_mtd := LEAST(
    (date_trunc('month', p_data_inicio) + (v_reference_day - 1) * interval '1 day')::date,
    p_data_fim
  );

  v_data_inicio_mtd_mes_anterior := (date_trunc('month', p_data_inicio) - interval '1 month')::date;
  v_last_day_mes_anterior := EXTRACT(DAY FROM (date_trunc('month', p_data_inicio) - interval '1 day')::date);

  IF v_is_full_past_month THEN
    v_data_fim_mtd_mes_anterior := (v_data_inicio_mtd_mes_anterior + (v_last_day_mes_anterior - 1) * interval '1 day')::date;
  ELSE
    v_mtd_end_day := LEAST(v_reference_day, v_last_day_mes_anterior);
    v_data_fim_mtd_mes_anterior := (v_data_inicio_mtd_mes_anterior + (v_mtd_end_day - 1) * interval '1 day')::date;
  END IF;

  v_data_inicio_mtd_ano_anterior := (date_trunc('month', p_data_inicio) - interval '1 year')::date;
  v_last_day_ano_anterior := EXTRACT(DAY FROM ((date_trunc('month', p_data_inicio) - interval '1 year') + interval '1 month' - interval '1 day')::date);

  IF v_is_full_past_month THEN
    v_data_fim_mtd_ano_anterior := (v_data_inicio_mtd_ano_anterior + (v_last_day_ano_anterior - 1) * interval '1 day')::date;
  ELSE
    v_mtd_end_day := LEAST(v_reference_day, v_last_day_ano_anterior);
    v_data_fim_mtd_ano_anterior := (v_data_inicio_mtd_ano_anterior + (v_mtd_end_day - 1) * interval '1 day')::date;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_mtd, v_data_fim_mtd, p_filiais_ids
  INTO v_mtd_vendas, v_mtd_lucro, v_mtd_margem;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_mtd_mes_anterior, v_data_fim_mtd_mes_anterior, p_filiais_ids
  INTO v_mtd_mes_anterior_vendas, v_mtd_mes_anterior_lucro, v_mtd_mes_anterior_margem;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_mtd_ano_anterior, v_data_fim_mtd_ano_anterior, p_filiais_ids
  INTO v_mtd_ano_anterior_vendas, v_mtd_ano_anterior_lucro, v_mtd_ano_anterior_margem;

  IF v_mtd_mes_anterior_vendas > 0 THEN
    v_mtd_variacao_mes_anterior_vendas_percent := ((v_mtd_vendas - v_mtd_mes_anterior_vendas) / v_mtd_mes_anterior_vendas) * 100;
  END IF;

  IF v_mtd_mes_anterior_lucro > 0 THEN
    v_mtd_variacao_mes_anterior_lucro_percent := ((v_mtd_lucro - v_mtd_mes_anterior_lucro) / v_mtd_mes_anterior_lucro) * 100;
  END IF;

  v_mtd_variacao_mes_anterior_margem := v_mtd_margem - v_mtd_mes_anterior_margem;

  IF v_mtd_ano_anterior_vendas > 0 THEN
    v_mtd_variacao_ano_anterior_vendas_percent := ((v_mtd_vendas - v_mtd_ano_anterior_vendas) / v_mtd_ano_anterior_vendas) * 100;
  END IF;

  IF v_mtd_ano_anterior_lucro > 0 THEN
    v_mtd_variacao_ano_anterior_lucro_percent := ((v_mtd_lucro - v_mtd_ano_anterior_lucro) / v_mtd_ano_anterior_lucro) * 100;
  END IF;

  v_mtd_variacao_ano_anterior_margem := v_mtd_margem - v_mtd_ano_anterior_margem;

  RETURN QUERY
  SELECT
    v_mtd_vendas,
    v_mtd_lucro,
    v_mtd_margem,
    v_mtd_mes_anterior_vendas,
    v_mtd_mes_anterior_lucro,
    v_mtd_mes_anterior_margem,
    v_mtd_variacao_mes_anterior_vendas_percent,
    v_mtd_variacao_mes_anterior_lucro_percent,
    v_mtd_variacao_mes_anterior_margem,
    v_mtd_ano_anterior_vendas,
    v_mtd_ano_anterior_lucro,
    v_mtd_ano_anterior_margem,
    v_mtd_variacao_ano_anterior_vendas_percent,
    v_mtd_variacao_ano_anterior_lucro_percent,
    v_mtd_variacao_ano_anterior_margem;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_ytd_metrics_api_filial_vendas(
  schema_name text,
  p_data_inicio date,
  p_data_fim date,
  p_filiais_ids text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  ytd_vendas numeric,
  ytd_vendas_ano_anterior numeric,
  ytd_variacao_vendas_percent numeric,
  ytd_lucro numeric,
  ytd_lucro_ano_anterior numeric,
  ytd_variacao_lucro_percent numeric,
  ytd_margem numeric,
  ytd_margem_ano_anterior numeric,
  ytd_variacao_margem numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_data_inicio_ytd date;
  v_data_fim_ytd date;
  v_data_inicio_ytd_ano_anterior date;
  v_data_fim_ytd_ano_anterior date;

  v_ytd_vendas numeric := 0;
  v_ytd_lucro numeric := 0;
  v_ytd_margem numeric := 0;

  v_ytd_vendas_ano_anterior numeric := 0;
  v_ytd_lucro_ano_anterior numeric := 0;
  v_ytd_margem_ano_anterior numeric := 0;

  v_ytd_variacao_vendas_percent numeric := 0;
  v_ytd_variacao_lucro_percent numeric := 0;
  v_ytd_variacao_margem numeric := 0;
BEGIN
  v_data_inicio_ytd := date_trunc('year', p_data_inicio)::date;

  IF EXTRACT(YEAR FROM p_data_inicio) = EXTRACT(YEAR FROM current_date) THEN
    v_data_fim_ytd := LEAST(p_data_fim, current_date);
  ELSE
    v_data_fim_ytd := p_data_fim;
  END IF;

  v_data_inicio_ytd_ano_anterior := (v_data_inicio_ytd - interval '1 year')::date;
  v_data_fim_ytd_ano_anterior := (v_data_fim_ytd - interval '1 year')::date;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
  INTO v_ytd_vendas, v_ytd_lucro, v_ytd_margem;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(lucro_ajustado), 0),
      COALESCE(
        SUM(COALESCE(margem_ajustada_percentual, 0) * COALESCE(valor, 0))
          / NULLIF(SUM(CASE WHEN margem_ajustada_percentual IS NOT NULL THEN COALESCE(valor, 0) ELSE 0 END), 0),
        CASE
          WHEN COALESCE(SUM(valor), 0) > 0
            THEN COALESCE(SUM(lucro_ajustado), 0) / COALESCE(SUM(valor), 0) * 100
          ELSE 0
        END
      )
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::text = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
  INTO v_ytd_vendas_ano_anterior, v_ytd_lucro_ano_anterior, v_ytd_margem_ano_anterior;

  IF v_ytd_vendas_ano_anterior > 0 THEN
    v_ytd_variacao_vendas_percent := ((v_ytd_vendas - v_ytd_vendas_ano_anterior) / v_ytd_vendas_ano_anterior) * 100;
  END IF;

  IF v_ytd_lucro_ano_anterior > 0 THEN
    v_ytd_variacao_lucro_percent := ((v_ytd_lucro - v_ytd_lucro_ano_anterior) / v_ytd_lucro_ano_anterior) * 100;
  END IF;

  v_ytd_variacao_margem := v_ytd_margem - v_ytd_margem_ano_anterior;

  RETURN QUERY
  SELECT
    v_ytd_vendas,
    v_ytd_vendas_ano_anterior,
    v_ytd_variacao_vendas_percent,
    v_ytd_lucro,
    v_ytd_lucro_ano_anterior,
    v_ytd_variacao_lucro_percent,
    v_ytd_margem,
    v_ytd_margem_ano_anterior,
    v_ytd_variacao_margem;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_by_month_chart_api_filial_vendas(
  schema_name text,
  p_filiais text,
  p_data_inicio date,
  p_data_fim date,
  p_filter_type text
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
  result json;
  filial_filter text := '';
  v_filter_type text := coalesce(p_filter_type, 'year');
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    v_start := make_date(extract(year from current_date)::int, 1, 1);
    v_end := make_date(extract(year from current_date)::int, 12, 31);
    v_filter_type := 'year';
  ELSE
    IF v_filter_type = 'year' THEN
      v_start := make_date(extract(year from p_data_inicio)::int, 1, 1);
      v_end := make_date(extract(year from p_data_inicio)::int, 12, 31);
    ELSIF v_filter_type = 'month' THEN
      v_start := p_data_inicio;
      v_end := p_data_fim;
    ELSE
      v_start := date_trunc('month', p_data_inicio)::date;
      v_end := (date_trunc('month', p_data_fim) + interval '1 month - 1 day')::date;
    END IF;
  END IF;

  v_prev_start := (v_start - interval '1 year')::date;
  v_prev_end := (v_end - interval '1 year')::date;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    filial_filter := format('and filial_id in (%s)', p_filiais);
  END IF;

  EXECUTE format($sql$
    with
    periods as (
      select
        gs::date as period_date,
        case
          when $1 = 'month' then to_char(gs, 'DD')
          when $1 = 'custom' then (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int] || '/' || extract(year from gs)::int
          else (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int]
        end as mes
      from generate_series(
        $2::date,
        $3::date,
        case when $1 = 'month' then interval '1 day' else interval '1 month' end
      ) gs
    ),
    sales_current as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_referencia)::date as period_date,
        sum(valor) as total_vendas
      from %I.vendas_filiais_snapshot
      where data_referencia between $2 and $3
      %s
      group by 1
    ),
    sales_prev as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_referencia)::date as period_date,
        sum(valor) as total_vendas
      from %I.vendas_filiais_snapshot
      where data_referencia between $4 and $5
      %s
      group by 1
    )
    select json_agg(t)
    from (
      select
        p.mes,
        coalesce(sc.total_vendas, 0)::numeric(15,2) as total_vendas,
        coalesce(sp.total_vendas, 0)::numeric(15,2) as total_vendas_ano_anterior
      from periods p
      left join sales_current sc on sc.period_date = p.period_date
      left join sales_prev sp on sp.period_date = (p.period_date - interval '1 year')::date
      order by p.period_date
    ) t
  $sql$,
    schema_name, filial_filter,
    schema_name, filial_filter
  )
  INTO result
  USING v_filter_type, v_start, v_end, v_prev_start, v_prev_end;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_lucro_by_month_chart_api_filial_vendas(
  schema_name text,
  p_filiais text,
  p_data_inicio date,
  p_data_fim date,
  p_filter_type text
)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
  result json;
  filial_filter text := '';
  v_filter_type text := coalesce(p_filter_type, 'year');
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    v_start := make_date(extract(year from current_date)::int, 1, 1);
    v_end := make_date(extract(year from current_date)::int, 12, 31);
    v_filter_type := 'year';
  ELSE
    IF v_filter_type = 'year' THEN
      v_start := make_date(extract(year from p_data_inicio)::int, 1, 1);
      v_end := make_date(extract(year from p_data_inicio)::int, 12, 31);
    ELSIF v_filter_type = 'month' THEN
      v_start := p_data_inicio;
      v_end := p_data_fim;
    ELSE
      v_start := date_trunc('month', p_data_inicio)::date;
      v_end := (date_trunc('month', p_data_fim) + interval '1 month - 1 day')::date;
    END IF;
  END IF;

  v_prev_start := (v_start - interval '1 year')::date;
  v_prev_end := (v_end - interval '1 year')::date;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    filial_filter := format('and filial_id in (%s)', p_filiais);
  END IF;

  EXECUTE format($sql$
    with
    periods as (
      select
        gs::date as period_date,
        case
          when $1 = 'month' then to_char(gs, 'DD')
          when $1 = 'custom' then (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int] || '/' || extract(year from gs)::int
          else (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int]
        end as mes
      from generate_series(
        $2::date,
        $3::date,
        case when $1 = 'month' then interval '1 day' else interval '1 month' end
      ) gs
    ),
    lucro_atual as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_referencia)::date as period_date,
        coalesce(sum(lucro_ajustado), 0) as total
      from %I.vendas_filiais_snapshot
      where data_referencia between $2 and $3
      %s
      group by 1
    ),
    lucro_anterior as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_referencia)::date as period_date,
        coalesce(sum(lucro_ajustado), 0) as total
      from %I.vendas_filiais_snapshot
      where data_referencia between $4 and $5
      %s
      group by 1
    )
    select json_agg(t)
    from (
      select
        p.mes,
        coalesce(la.total, 0)::numeric(15,2) as total_lucro,
        coalesce(lb.total, 0)::numeric(15,2) as total_lucro_ano_anterior
      from periods p
      left join lucro_atual la on la.period_date = p.period_date
      left join lucro_anterior lb on lb.period_date = (p.period_date - interval '1 year')::date
      order by p.period_date
    ) t
  $sql$,
    schema_name, filial_filter,
    schema_name, filial_filter
  )
  INTO result
  USING v_filter_type, v_start, v_end, v_prev_start, v_prev_end;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

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
        SUM(v.quantidade_unidades_vendidas) AS total_sku,
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
    periodo_anterior AS (
      SELECT
        v.filial_id,
        SUM(v.valor) AS pa_valor_total,
        SUM(v.custo_total_ajustado) AS pa_custo_total,
        SUM(v.lucro_ajustado) AS pa_total_lucro,
        SUM(v.quantidade_clientes)::numeric AS pa_total_transacoes,
        SUM(v.quantidade_clientes)::bigint AS pa_total_cupons,
        SUM(v.quantidade_unidades_vendidas) AS pa_total_sku,
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
    todas_filiais AS (
      SELECT DISTINCT filial_id FROM periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_anterior
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
      COALESCE(pc.total_sku, 0)::numeric(15,3) AS total_sku,
      COALESCE(pa.pa_total_sku, 0)::numeric(15,3) AS pa_total_sku,
      (COALESCE(pc.total_sku, 0) - COALESCE(pa.pa_total_sku, 0))::numeric(15,3) AS delta_sku,
      CASE
        WHEN COALESCE(pa.pa_total_sku, 0) > 0 THEN LEAST(((COALESCE(pc.total_sku, 0) - COALESCE(pa.pa_total_sku, 0))::numeric / pa.pa_total_sku * 100), 99999999.99)::numeric(10,2)
        ELSE 0
      END AS delta_sku_percent
    FROM todas_filiais tf
    LEFT JOIN periodo_atual pc ON tf.filial_id = pc.filial_id
    LEFT JOIN periodo_anterior pa ON tf.filial_id = pa.filial_id
    LEFT JOIN entradas_periodo_atual epa ON tf.filial_id = epa.filial_id
    LEFT JOIN entradas_periodo_anterior epan ON tf.filial_id = epan.filial_id
    WHERE COALESCE(pc.valor_total, 0) > 0
       OR COALESCE(epa.total_entradas, 0) > 0
       OR COALESCE(pc.total_cupons, 0) > 0
       OR COALESCE(pc.total_sku, 0) > 0
    ORDER BY COALESCE(pc.valor_total, 0) DESC NULLS LAST',
    p_schema, p_schema, p_schema, p_schema
  )
  USING p_data_inicio, p_data_fim, v_pa_data_inicio, v_pa_data_fim, v_filiais_array;
END;
$function$;

COMMENT ON FUNCTION public.get_dashboard_data_api_filial_vendas(text, date, date, text[]) IS
'Dashboard 360 - Fonte /filial/vendas usando valor, lucro_ajustado e margem_ajustada_percentual de vendas_filiais_snapshot.';

COMMENT ON FUNCTION public.get_dashboard_mtd_metrics_api_filial_vendas(text, date, date, text[]) IS
'Dashboard 360 MTD - Fonte /filial/vendas usando campos ajustados de vendas_filiais_snapshot.';

COMMENT ON FUNCTION public.get_dashboard_ytd_metrics_api_filial_vendas(text, date, date, text[]) IS
'Dashboard 360 YTD - Fonte /filial/vendas usando campos ajustados de vendas_filiais_snapshot.';

COMMENT ON FUNCTION public.get_sales_by_month_chart_api_filial_vendas(text, text, date, date, text) IS
'Dashboard 360 gráfico de vendas - Fonte /filial/vendas usando vendas_filiais_snapshot.valor.';

COMMENT ON FUNCTION public.get_lucro_by_month_chart_api_filial_vendas(text, text, date, date, text) IS
'Dashboard 360 gráfico de lucro - Fonte /filial/vendas usando vendas_filiais_snapshot.lucro_ajustado.';

COMMENT ON FUNCTION public.get_vendas_por_filial_api_filial_vendas(text, date, date, text, text) IS
'Dashboard 360 vendas por filial - Fonte /filial/vendas usando valor, custo_total_ajustado, lucro_ajustado, margem_ajustada_percentual, quantidade_clientes e quantidade_unidades_vendidas.';
