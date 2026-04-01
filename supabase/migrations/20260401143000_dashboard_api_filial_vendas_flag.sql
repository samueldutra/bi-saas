-- Dashboard 360 com fonte PDV baseada em /filial/vendas
-- Mantém as funções legadas intactas e cria versões paralelas para uso
-- quando enable_api_filial_vendas = true.

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
  v_total_vendas NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_total_lucro NUMERIC := 0;
  v_total_clientes NUMERIC := 0;
  v_ticket_medio NUMERIC := 0;
  v_margem_lucro NUMERIC := 0;

  v_pa_vendas NUMERIC := 0;
  v_pa_custo NUMERIC := 0;
  v_pa_lucro NUMERIC := 0;
  v_pa_clientes NUMERIC := 0;
  v_pa_ticket_medio NUMERIC := 0;
  v_pa_margem_lucro NUMERIC := 0;

  v_paa_vendas NUMERIC := 0;
  v_paa_custo NUMERIC := 0;
  v_paa_lucro NUMERIC := 0;
  v_paa_clientes NUMERIC := 0;
  v_paa_ticket_medio NUMERIC := 0;
  v_paa_margem_lucro NUMERIC := 0;

  v_ytd_vendas NUMERIC := 0;
  v_ytd_vendas_ano_anterior NUMERIC := 0;
  v_ytd_variacao_percent NUMERIC := 0;

  v_variacao_vendas_mes NUMERIC := 0;
  v_variacao_lucro_mes NUMERIC := 0;
  v_variacao_ticket_mes NUMERIC := 0;
  v_variacao_margem_mes NUMERIC := 0;

  v_variacao_vendas_ano NUMERIC := 0;
  v_variacao_lucro_ano NUMERIC := 0;
  v_variacao_ticket_ano NUMERIC := 0;
  v_variacao_margem_ano NUMERIC := 0;

  v_grafico_vendas JSON := '[]'::JSON;

  v_data_inicio_pa DATE;
  v_data_fim_pa DATE;
  v_data_inicio_paa DATE;
  v_data_fim_paa DATE;
  v_data_inicio_ytd DATE;
  v_data_fim_ytd DATE;
  v_data_inicio_ytd_ano_anterior DATE;
  v_data_fim_ytd_ano_anterior DATE;

  v_descontos_periodo NUMERIC := 0;
  v_descontos_pa NUMERIC := 0;
  v_descontos_paa NUMERIC := 0;
  v_descontos_ytd NUMERIC := 0;
  v_descontos_ytd_ano_anterior NUMERIC := 0;
  v_table_exists BOOLEAN;
BEGIN
  v_data_inicio_pa := (p_data_inicio - INTERVAL '1 month')::DATE;
  v_data_fim_pa := (p_data_fim - INTERVAL '1 month')::DATE;

  v_data_inicio_paa := (p_data_inicio - INTERVAL '1 year')::DATE;
  v_data_fim_paa := (p_data_fim - INTERVAL '1 year')::DATE;

  v_data_inicio_ytd := DATE_TRUNC('year', p_data_inicio)::DATE;
  v_data_fim_ytd := p_data_fim;
  v_data_inicio_ytd_ano_anterior := (v_data_inicio_ytd - INTERVAL '1 year')::DATE;
  v_data_fim_ytd_ano_anterior := (v_data_fim_ytd - INTERVAL '1 year')::DATE;

  EXECUTE format(
    'SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = %L
        AND table_name = ''descontos_venda''
    )',
    schema_name
  ) INTO v_table_exists;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0),
      COALESCE(SUM(quantidade_clientes), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING p_data_inicio, p_data_fim, p_filiais_ids
  INTO v_total_vendas, v_total_custo, v_total_clientes;

  v_total_lucro := v_total_vendas - v_total_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING p_data_inicio, p_data_fim, p_filiais_ids
    INTO v_descontos_periodo;

    v_total_vendas := v_total_vendas - v_descontos_periodo;
    v_total_lucro := v_total_lucro - v_descontos_periodo;
  END IF;

  IF v_total_clientes > 0 THEN
    v_ticket_medio := v_total_vendas / v_total_clientes;
  END IF;

  IF v_total_vendas > 0 THEN
    v_margem_lucro := (v_total_lucro / v_total_vendas) * 100;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0),
      COALESCE(SUM(quantidade_clientes), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_pa, v_data_fim_pa, p_filiais_ids
  INTO v_pa_vendas, v_pa_custo, v_pa_clientes;

  v_pa_lucro := v_pa_vendas - v_pa_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_pa, v_data_fim_pa, p_filiais_ids
    INTO v_descontos_pa;

    v_pa_vendas := v_pa_vendas - v_descontos_pa;
    v_pa_lucro := v_pa_lucro - v_descontos_pa;
  END IF;

  IF v_pa_clientes > 0 THEN
    v_pa_ticket_medio := v_pa_vendas / v_pa_clientes;
  END IF;

  IF v_pa_vendas > 0 THEN
    v_pa_margem_lucro := (v_pa_lucro / v_pa_vendas) * 100;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0),
      COALESCE(SUM(quantidade_clientes), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_paa, v_data_fim_paa, p_filiais_ids
  INTO v_paa_vendas, v_paa_custo, v_paa_clientes;

  v_paa_lucro := v_paa_vendas - v_paa_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_paa, v_data_fim_paa, p_filiais_ids
    INTO v_descontos_paa;

    v_paa_vendas := v_paa_vendas - v_descontos_paa;
    v_paa_lucro := v_paa_lucro - v_descontos_paa;
  END IF;

  IF v_paa_clientes > 0 THEN
    v_paa_ticket_medio := v_paa_vendas / v_paa_clientes;
  END IF;

  IF v_paa_vendas > 0 THEN
    v_paa_margem_lucro := (v_paa_lucro / v_paa_vendas) * 100;
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
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
  INTO v_ytd_vendas;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
    INTO v_descontos_ytd;

    v_ytd_vendas := v_ytd_vendas - v_descontos_ytd;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(SUM(valor), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
  INTO v_ytd_vendas_ano_anterior;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
    INTO v_descontos_ytd_ano_anterior;

    v_ytd_vendas_ano_anterior := v_ytd_vendas_ano_anterior - v_descontos_ytd_ano_anterior;
  END IF;

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
        COALESCE(sc.total_vendas, 0) - COALESCE(dc.total_descontos, 0) AS vendas_atual,
        COALESCE(sp.total_vendas, 0) - COALESCE(dp.total_descontos, 0) AS vendas_anterior
      FROM generate_series($1::date, $2::date, interval ''1 day'') gs
      LEFT JOIN (
        SELECT data_referencia, SUM(valor) AS total_vendas
        FROM %I.vendas_filiais_snapshot
        WHERE data_referencia BETWEEN $1 AND $2
          AND ($3 IS NULL OR filial_id::TEXT = ANY($3))
        GROUP BY data_referencia
      ) sc ON sc.data_referencia = gs::date
      LEFT JOIN (
        SELECT data_desconto, SUM(valor_desconto) AS total_descontos
        FROM %I.descontos_venda
        WHERE data_desconto BETWEEN $1 AND $2
          AND ($3 IS NULL OR filial_id::TEXT = ANY($3))
        GROUP BY data_desconto
      ) dc ON dc.data_desconto = gs::date
      LEFT JOIN (
        SELECT data_referencia, SUM(valor) AS total_vendas
        FROM %I.vendas_filiais_snapshot
        WHERE data_referencia BETWEEN ($1 - INTERVAL ''1 year'')::date AND ($2 - INTERVAL ''1 year'')::date
          AND ($3 IS NULL OR filial_id::TEXT = ANY($3))
        GROUP BY data_referencia
      ) sp ON sp.data_referencia = (gs::date - INTERVAL ''1 year'')::date
      LEFT JOIN (
        SELECT data_desconto, SUM(valor_desconto) AS total_descontos
        FROM %I.descontos_venda
        WHERE data_desconto BETWEEN ($1 - INTERVAL ''1 year'')::date AND ($2 - INTERVAL ''1 year'')::date
          AND ($3 IS NULL OR filial_id::TEXT = ANY($3))
        GROUP BY data_desconto
      ) dp ON dp.data_desconto = (gs::date - INTERVAL ''1 year'')::date
    ) dados',
    schema_name,
    schema_name,
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
    NULL::TEXT;
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
  v_reference_day INTEGER;
  v_mtd_end_day INTEGER;
  v_is_full_past_month BOOLEAN;

  v_data_inicio_mtd DATE;
  v_data_fim_mtd DATE;
  v_data_inicio_mtd_mes_anterior DATE;
  v_data_fim_mtd_mes_anterior DATE;
  v_data_inicio_mtd_ano_anterior DATE;
  v_data_fim_mtd_ano_anterior DATE;

  v_mtd_vendas NUMERIC := 0;
  v_mtd_custo NUMERIC := 0;
  v_mtd_lucro NUMERIC := 0;
  v_mtd_margem NUMERIC := 0;

  v_mtd_mes_anterior_vendas NUMERIC := 0;
  v_mtd_mes_anterior_custo NUMERIC := 0;
  v_mtd_mes_anterior_lucro NUMERIC := 0;
  v_mtd_mes_anterior_margem NUMERIC := 0;

  v_mtd_ano_anterior_vendas NUMERIC := 0;
  v_mtd_ano_anterior_custo NUMERIC := 0;
  v_mtd_ano_anterior_lucro NUMERIC := 0;
  v_mtd_ano_anterior_margem NUMERIC := 0;

  v_mtd_variacao_mes_anterior_vendas_percent NUMERIC := 0;
  v_mtd_variacao_mes_anterior_lucro_percent NUMERIC := 0;
  v_mtd_variacao_mes_anterior_margem NUMERIC := 0;
  v_mtd_variacao_ano_anterior_vendas_percent NUMERIC := 0;
  v_mtd_variacao_ano_anterior_lucro_percent NUMERIC := 0;
  v_mtd_variacao_ano_anterior_margem NUMERIC := 0;

  v_descontos_mtd NUMERIC := 0;
  v_descontos_mtd_mes_anterior NUMERIC := 0;
  v_descontos_mtd_ano_anterior NUMERIC := 0;
  v_table_exists BOOLEAN;

  v_last_day_mes_anterior INTEGER;
  v_last_day_ano_anterior INTEGER;
  v_is_first_day_of_month BOOLEAN;
  v_last_day_of_filter_month INTEGER;
  v_is_last_day_of_month BOOLEAN;
  v_is_past_month BOOLEAN;
BEGIN
  v_is_first_day_of_month := EXTRACT(DAY FROM p_data_inicio) = 1;
  v_last_day_of_filter_month := EXTRACT(DAY FROM (DATE_TRUNC('month', p_data_inicio) + INTERVAL '1 month' - INTERVAL '1 day')::DATE);
  v_is_last_day_of_month := EXTRACT(DAY FROM p_data_fim) = v_last_day_of_filter_month;
  v_is_past_month := p_data_fim < CURRENT_DATE;
  v_is_full_past_month := v_is_first_day_of_month AND v_is_last_day_of_month AND v_is_past_month;

  IF p_data_fim >= CURRENT_DATE THEN
    v_reference_day := EXTRACT(DAY FROM CURRENT_DATE);
  ELSE
    v_reference_day := EXTRACT(DAY FROM p_data_fim);
  END IF;

  v_data_inicio_mtd := DATE_TRUNC('month', p_data_inicio)::DATE;
  v_data_fim_mtd := LEAST(
    (DATE_TRUNC('month', p_data_inicio) + (v_reference_day - 1) * INTERVAL '1 day')::DATE,
    p_data_fim
  );

  v_data_inicio_mtd_mes_anterior := (DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 month')::DATE;
  v_last_day_mes_anterior := EXTRACT(DAY FROM (DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 day')::DATE);

  IF v_is_full_past_month THEN
    v_data_fim_mtd_mes_anterior := (v_data_inicio_mtd_mes_anterior + (v_last_day_mes_anterior - 1) * INTERVAL '1 day')::DATE;
  ELSE
    v_mtd_end_day := LEAST(v_reference_day, v_last_day_mes_anterior);
    v_data_fim_mtd_mes_anterior := (v_data_inicio_mtd_mes_anterior + (v_mtd_end_day - 1) * INTERVAL '1 day')::DATE;
  END IF;

  v_data_inicio_mtd_ano_anterior := (DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 year')::DATE;
  v_last_day_ano_anterior := EXTRACT(DAY FROM ((DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 year') + INTERVAL '1 month' - INTERVAL '1 day')::DATE);

  IF v_is_full_past_month THEN
    v_data_fim_mtd_ano_anterior := (v_data_inicio_mtd_ano_anterior + (v_last_day_ano_anterior - 1) * INTERVAL '1 day')::DATE;
  ELSE
    v_mtd_end_day := LEAST(v_reference_day, v_last_day_ano_anterior);
    v_data_fim_mtd_ano_anterior := (v_data_inicio_mtd_ano_anterior + (v_mtd_end_day - 1) * INTERVAL '1 day')::DATE;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = %L
        AND table_name = ''descontos_venda''
    )',
    schema_name
  ) INTO v_table_exists;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_mtd, v_data_fim_mtd, p_filiais_ids
  INTO v_mtd_vendas, v_mtd_custo;

  v_mtd_lucro := v_mtd_vendas - v_mtd_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_mtd, v_data_fim_mtd, p_filiais_ids
    INTO v_descontos_mtd;

    v_mtd_vendas := v_mtd_vendas - v_descontos_mtd;
    v_mtd_lucro := v_mtd_lucro - v_descontos_mtd;
  END IF;

  IF v_mtd_vendas > 0 THEN
    v_mtd_margem := (v_mtd_lucro / v_mtd_vendas) * 100;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_mtd_mes_anterior, v_data_fim_mtd_mes_anterior, p_filiais_ids
  INTO v_mtd_mes_anterior_vendas, v_mtd_mes_anterior_custo;

  v_mtd_mes_anterior_lucro := v_mtd_mes_anterior_vendas - v_mtd_mes_anterior_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_mtd_mes_anterior, v_data_fim_mtd_mes_anterior, p_filiais_ids
    INTO v_descontos_mtd_mes_anterior;

    v_mtd_mes_anterior_vendas := v_mtd_mes_anterior_vendas - v_descontos_mtd_mes_anterior;
    v_mtd_mes_anterior_lucro := v_mtd_mes_anterior_lucro - v_descontos_mtd_mes_anterior;
  END IF;

  IF v_mtd_mes_anterior_vendas > 0 THEN
    v_mtd_mes_anterior_margem := (v_mtd_mes_anterior_lucro / v_mtd_mes_anterior_vendas) * 100;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_mtd_ano_anterior, v_data_fim_mtd_ano_anterior, p_filiais_ids
  INTO v_mtd_ano_anterior_vendas, v_mtd_ano_anterior_custo;

  v_mtd_ano_anterior_lucro := v_mtd_ano_anterior_vendas - v_mtd_ano_anterior_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_mtd_ano_anterior, v_data_fim_mtd_ano_anterior, p_filiais_ids
    INTO v_descontos_mtd_ano_anterior;

    v_mtd_ano_anterior_vendas := v_mtd_ano_anterior_vendas - v_descontos_mtd_ano_anterior;
    v_mtd_ano_anterior_lucro := v_mtd_ano_anterior_lucro - v_descontos_mtd_ano_anterior;
  END IF;

  IF v_mtd_ano_anterior_vendas > 0 THEN
    v_mtd_ano_anterior_margem := (v_mtd_ano_anterior_lucro / v_mtd_ano_anterior_vendas) * 100;
  END IF;

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
  v_data_inicio_ytd DATE;
  v_data_fim_ytd DATE;
  v_data_inicio_ytd_ano_anterior DATE;
  v_data_fim_ytd_ano_anterior DATE;

  v_ytd_vendas NUMERIC := 0;
  v_ytd_custo NUMERIC := 0;
  v_ytd_lucro NUMERIC := 0;
  v_ytd_margem NUMERIC := 0;

  v_ytd_vendas_ano_anterior NUMERIC := 0;
  v_ytd_custo_ano_anterior NUMERIC := 0;
  v_ytd_lucro_ano_anterior NUMERIC := 0;
  v_ytd_margem_ano_anterior NUMERIC := 0;

  v_ytd_variacao_vendas_percent NUMERIC := 0;
  v_ytd_variacao_lucro_percent NUMERIC := 0;
  v_ytd_variacao_margem NUMERIC := 0;

  v_descontos_ytd NUMERIC := 0;
  v_descontos_ytd_ano_anterior NUMERIC := 0;
  v_table_exists BOOLEAN;
BEGIN
  v_data_inicio_ytd := DATE_TRUNC('year', p_data_inicio)::DATE;

  IF EXTRACT(YEAR FROM p_data_inicio) = EXTRACT(YEAR FROM CURRENT_DATE) THEN
    v_data_fim_ytd := LEAST(p_data_fim, CURRENT_DATE);
  ELSE
    v_data_fim_ytd := p_data_fim;
  END IF;

  v_data_inicio_ytd_ano_anterior := (v_data_inicio_ytd - INTERVAL '1 year')::DATE;
  v_data_fim_ytd_ano_anterior := (v_data_fim_ytd - INTERVAL '1 year')::DATE;

  EXECUTE format(
    'SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = %L
        AND table_name = ''descontos_venda''
    )',
    schema_name
  ) INTO v_table_exists;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
  INTO v_ytd_vendas, v_ytd_custo;

  v_ytd_lucro := v_ytd_vendas - v_ytd_custo;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
    INTO v_descontos_ytd;

    v_ytd_vendas := v_ytd_vendas - v_descontos_ytd;
    v_ytd_lucro := v_ytd_lucro - v_descontos_ytd;
  END IF;

  IF v_ytd_vendas > 0 THEN
    v_ytd_margem := (v_ytd_lucro / v_ytd_vendas) * 100;
  END IF;

  EXECUTE format(
    'SELECT
      COALESCE(SUM(valor), 0),
      COALESCE(SUM(custo_real), 0)
     FROM %I.vendas_filiais_snapshot
     WHERE data_referencia BETWEEN $1 AND $2
       AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
    schema_name
  )
  USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
  INTO v_ytd_vendas_ano_anterior, v_ytd_custo_ano_anterior;

  v_ytd_lucro_ano_anterior := v_ytd_vendas_ano_anterior - v_ytd_custo_ano_anterior;

  IF v_table_exists THEN
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_desconto), 0)
       FROM %I.descontos_venda
       WHERE data_desconto BETWEEN $1 AND $2
         AND ($3 IS NULL OR filial_id::TEXT = ANY($3))',
      schema_name
    )
    USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
    INTO v_descontos_ytd_ano_anterior;

    v_ytd_vendas_ano_anterior := v_ytd_vendas_ano_anterior - v_descontos_ytd_ano_anterior;
    v_ytd_lucro_ano_anterior := v_ytd_lucro_ano_anterior - v_descontos_ytd_ano_anterior;
  END IF;

  IF v_ytd_vendas_ano_anterior > 0 THEN
    v_ytd_margem_ano_anterior := (v_ytd_lucro_ano_anterior / v_ytd_vendas_ano_anterior) * 100;
  END IF;

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
    ),
    descontos_current as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_desconto)::date as period_date,
        sum(valor_desconto) as total_descontos
      from %I.descontos_venda
      where data_desconto between $2 and $3
      %s
      group by 1
    ),
    descontos_prev as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_desconto)::date as period_date,
        sum(valor_desconto) as total_descontos
      from %I.descontos_venda
      where data_desconto between $4 and $5
      %s
      group by 1
    )
    select json_agg(t)
    from (
      select
        p.mes,
        (coalesce(sc.total_vendas, 0) - coalesce(dc.total_descontos, 0))::numeric(15,2) as total_vendas,
        (coalesce(sp.total_vendas, 0) - coalesce(dp.total_descontos, 0))::numeric(15,2) as total_vendas_ano_anterior
      from periods p
      left join sales_current sc on sc.period_date = p.period_date
      left join descontos_current dc on dc.period_date = p.period_date
      left join sales_prev sp on sp.period_date = (p.period_date - interval '1 year')::date
      left join descontos_prev dp on dp.period_date = (p.period_date - interval '1 year')::date
      order by p.period_date
    ) t
  $sql$,
    schema_name, filial_filter,
    schema_name, filial_filter,
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
    filial_filter := format('and vfs.filial_id in (%s)', p_filiais);
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
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, vfs.data_referencia)::date as period_date,
        coalesce(sum(vfs.valor - vfs.custo_real), 0) as total
      from %I.vendas_filiais_snapshot vfs
      where vfs.data_referencia between $2 and $3
      %s
      group by 1
    ),
    lucro_anterior as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, vfs.data_referencia)::date as period_date,
        coalesce(sum(vfs.valor - vfs.custo_real), 0) as total
      from %I.vendas_filiais_snapshot vfs
      where vfs.data_referencia between $4 and $5
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
  total_sku bigint,
  pa_total_sku bigint,
  delta_sku bigint,
  delta_sku_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_pa_data_inicio DATE;
  v_pa_data_fim DATE;
  v_filiais_array BIGINT[];
BEGIN
  IF p_filter_type = 'month' THEN
    v_pa_data_inicio := p_data_inicio - INTERVAL '1 year';
    v_pa_data_fim := p_data_fim - INTERVAL '1 year';
  ELSIF p_filter_type = 'year' THEN
    v_pa_data_inicio := p_data_inicio - INTERVAL '1 year';
    v_pa_data_fim := p_data_fim - INTERVAL '1 year';
  ELSE
    v_pa_data_inicio := p_data_inicio - (p_data_fim - p_data_inicio + 1);
    v_pa_data_fim := p_data_inicio - INTERVAL '1 day';
  END IF;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    v_filiais_array := string_to_array(p_filiais, ',')::BIGINT[];
  ELSE
    v_filiais_array := NULL;
  END IF;

  RETURN QUERY EXECUTE format(
    'WITH
    periodo_atual AS (
      SELECT
        v.filial_id,
        SUM(v.valor) AS valor_total_bruto,
        SUM(v.custo_real) AS custo_total_bruto,
        SUM(v.quantidade_unidades_vendidas) AS quantidade_total,
        SUM(v.quantidade_clientes)::NUMERIC AS total_transacoes
      FROM %I.vendas_filiais_snapshot v
      WHERE v.data_referencia BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    descontos_periodo_atual AS (
      SELECT
        d.filial_id,
        COALESCE(SUM(d.valor_desconto), 0) AS total_desconto_venda,
        COALESCE(SUM(d.desconto_custo), 0) AS total_desconto_custo
      FROM %I.descontos_venda d
      WHERE d.data_desconto BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR d.filial_id = ANY($7))
      GROUP BY d.filial_id
    ),
    entradas_periodo_atual AS (
      SELECT
        e.filial_id,
        COALESCE(SUM(e.valor_total), 0) AS total_entradas
      FROM %I.entradas e
      WHERE e.transacao IN (''P'', ''V'')
        AND e.data_entrada BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR e.filial_id = ANY($7))
      GROUP BY e.filial_id
    ),
    cupons_periodo_atual AS (
      SELECT
        v.filial_id,
        COALESCE(SUM(v.quantidade_clientes), 0)::BIGINT AS total_cupons
      FROM %I.vendas_filiais_snapshot v
      WHERE v.data_referencia BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    sku_periodo_atual AS (
      SELECT
        v.filial_id,
        COUNT(DISTINCT v.id_produto) AS total_sku
      FROM %I.vendas v
      WHERE v.data_venda BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    periodo_atual_com_desconto AS (
      SELECT
        pa.filial_id,
        pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0) AS valor_total,
        pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0) AS custo_total,
        (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0))
          - (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)) AS total_lucro,
        pa.quantidade_total,
        pa.total_transacoes,
        CASE
          WHEN pa.total_transacoes > 0 THEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) / pa.total_transacoes
          ELSE 0
        END AS ticket_medio,
        CASE
          WHEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) > 0 THEN
            (((pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0))
              - (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)))::NUMERIC
              / (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) * 100)
          ELSE 0
        END AS margem_lucro
      FROM periodo_atual pa
      LEFT JOIN descontos_periodo_atual dpa ON pa.filial_id = dpa.filial_id
    ),
    periodo_anterior AS (
      SELECT
        v.filial_id,
        SUM(v.valor) AS valor_total_bruto,
        SUM(v.custo_real) AS custo_total_bruto,
        SUM(v.quantidade_clientes)::NUMERIC AS total_transacoes
      FROM %I.vendas_filiais_snapshot v
      WHERE v.data_referencia BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    descontos_periodo_anterior AS (
      SELECT
        d.filial_id,
        COALESCE(SUM(d.valor_desconto), 0) AS total_desconto_venda,
        COALESCE(SUM(d.desconto_custo), 0) AS total_desconto_custo
      FROM %I.descontos_venda d
      WHERE d.data_desconto BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR d.filial_id = ANY($7))
      GROUP BY d.filial_id
    ),
    entradas_periodo_anterior AS (
      SELECT
        e.filial_id,
        COALESCE(SUM(e.valor_total), 0) AS pa_total_entradas
      FROM %I.entradas e
      WHERE e.transacao IN (''P'', ''V'')
        AND e.data_entrada BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR e.filial_id = ANY($7))
      GROUP BY e.filial_id
    ),
    cupons_periodo_anterior AS (
      SELECT
        v.filial_id,
        COALESCE(SUM(v.quantidade_clientes), 0)::BIGINT AS pa_total_cupons
      FROM %I.vendas_filiais_snapshot v
      WHERE v.data_referencia BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    sku_periodo_anterior AS (
      SELECT
        v.filial_id,
        COUNT(DISTINCT v.id_produto) AS pa_total_sku
      FROM %I.vendas v
      WHERE v.data_venda BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    periodo_anterior_com_desconto AS (
      SELECT
        pa.filial_id,
        pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0) AS pa_valor_total,
        pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0) AS pa_custo_total,
        (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0))
          - (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)) AS pa_total_lucro,
        pa.total_transacoes AS pa_total_transacoes,
        CASE
          WHEN pa.total_transacoes > 0 THEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) / pa.total_transacoes
          ELSE 0
        END AS pa_ticket_medio,
        CASE
          WHEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) > 0 THEN
            (((pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0))
              - (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)))::NUMERIC
              / (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) * 100)
          ELSE 0
        END AS pa_margem_lucro
      FROM periodo_anterior pa
      LEFT JOIN descontos_periodo_anterior dpa ON pa.filial_id = dpa.filial_id
    ),
    todas_filiais AS (
      SELECT DISTINCT filial_id FROM periodo_atual_com_desconto
      UNION
      SELECT DISTINCT filial_id FROM periodo_anterior_com_desconto
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM cupons_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM cupons_periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM sku_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM sku_periodo_anterior
    )
    SELECT
      tf.filial_id AS filial_id,
      COALESCE(pc.valor_total, 0)::NUMERIC(15,2) AS valor_total,
      COALESCE(pc.custo_total, 0)::NUMERIC(15,2) AS custo_total,
      COALESCE(pc.total_lucro, 0)::NUMERIC(15,2) AS total_lucro,
      COALESCE(pc.quantidade_total, 0)::NUMERIC(15,2) AS quantidade_total,
      COALESCE(pc.total_transacoes, 0)::NUMERIC AS total_transacoes,
      COALESCE(pc.ticket_medio, 0)::NUMERIC(15,2) AS ticket_medio,
      COALESCE(pc.margem_lucro, 0)::NUMERIC(10,2) AS margem_lucro,
      COALESCE(pa.pa_valor_total, 0)::NUMERIC(15,2) AS pa_valor_total,
      COALESCE(pa.pa_custo_total, 0)::NUMERIC(15,2) AS pa_custo_total,
      COALESCE(pa.pa_total_lucro, 0)::NUMERIC(15,2) AS pa_total_lucro,
      COALESCE(pa.pa_total_transacoes, 0)::NUMERIC AS pa_total_transacoes,
      COALESCE(pa.pa_ticket_medio, 0)::NUMERIC(15,2) AS pa_ticket_medio,
      COALESCE(pa.pa_margem_lucro, 0)::NUMERIC(10,2) AS pa_margem_lucro,
      (COALESCE(pc.valor_total, 0) - COALESCE(pa.pa_valor_total, 0))::NUMERIC(15,2) AS delta_valor,
      CASE
        WHEN COALESCE(pa.pa_valor_total, 0) > 0 THEN LEAST(((COALESCE(pc.valor_total, 0) - COALESCE(pa.pa_valor_total, 0)) / pa.pa_valor_total * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END AS delta_valor_percent,
      (COALESCE(pc.custo_total, 0) - COALESCE(pa.pa_custo_total, 0))::NUMERIC(15,2) AS delta_custo,
      CASE
        WHEN COALESCE(pa.pa_custo_total, 0) > 0 THEN LEAST(((COALESCE(pc.custo_total, 0) - COALESCE(pa.pa_custo_total, 0)) / pa.pa_custo_total * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END AS delta_custo_percent,
      (COALESCE(pc.total_lucro, 0) - COALESCE(pa.pa_total_lucro, 0))::NUMERIC(15,2) AS delta_lucro,
      CASE
        WHEN COALESCE(pa.pa_total_lucro, 0) > 0 THEN LEAST(((COALESCE(pc.total_lucro, 0) - COALESCE(pa.pa_total_lucro, 0)) / pa.pa_total_lucro * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END AS delta_lucro_percent,
      (COALESCE(pc.margem_lucro, 0) - COALESCE(pa.pa_margem_lucro, 0))::NUMERIC(10,2) AS delta_margem,
      COALESCE(epa.total_entradas, 0)::NUMERIC(15,2) AS total_entradas,
      COALESCE(epan.pa_total_entradas, 0)::NUMERIC(15,2) AS pa_total_entradas,
      (COALESCE(epa.total_entradas, 0) - COALESCE(epan.pa_total_entradas, 0))::NUMERIC(15,2) AS delta_entradas,
      CASE
        WHEN COALESCE(epan.pa_total_entradas, 0) > 0 THEN LEAST(((COALESCE(epa.total_entradas, 0) - COALESCE(epan.pa_total_entradas, 0)) / epan.pa_total_entradas * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END AS delta_entradas_percent,
      COALESCE(cpa.total_cupons, 0)::BIGINT AS total_cupons,
      COALESCE(cpan.pa_total_cupons, 0)::BIGINT AS pa_total_cupons,
      (COALESCE(cpa.total_cupons, 0) - COALESCE(cpan.pa_total_cupons, 0))::BIGINT AS delta_cupons,
      CASE
        WHEN COALESCE(cpan.pa_total_cupons, 0) > 0 THEN LEAST(((COALESCE(cpa.total_cupons, 0) - COALESCE(cpan.pa_total_cupons, 0))::NUMERIC / cpan.pa_total_cupons * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END AS delta_cupons_percent,
      COALESCE(spa.total_sku, 0)::BIGINT AS total_sku,
      COALESCE(span.pa_total_sku, 0)::BIGINT AS pa_total_sku,
      (COALESCE(spa.total_sku, 0) - COALESCE(span.pa_total_sku, 0))::BIGINT AS delta_sku,
      CASE
        WHEN COALESCE(span.pa_total_sku, 0) > 0 THEN LEAST(((COALESCE(spa.total_sku, 0) - COALESCE(span.pa_total_sku, 0))::NUMERIC / span.pa_total_sku * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END AS delta_sku_percent
    FROM todas_filiais tf
    LEFT JOIN periodo_atual_com_desconto pc ON tf.filial_id = pc.filial_id
    LEFT JOIN periodo_anterior_com_desconto pa ON tf.filial_id = pa.filial_id
    LEFT JOIN entradas_periodo_atual epa ON tf.filial_id = epa.filial_id
    LEFT JOIN entradas_periodo_anterior epan ON tf.filial_id = epan.filial_id
    LEFT JOIN cupons_periodo_atual cpa ON tf.filial_id = cpa.filial_id
    LEFT JOIN cupons_periodo_anterior cpan ON tf.filial_id = cpan.filial_id
    LEFT JOIN sku_periodo_atual spa ON tf.filial_id = spa.filial_id
    LEFT JOIN sku_periodo_anterior span ON tf.filial_id = span.filial_id
    WHERE COALESCE(pc.valor_total, 0) > 0
       OR COALESCE(epa.total_entradas, 0) > 0
       OR COALESCE(cpa.total_cupons, 0) > 0
       OR COALESCE(spa.total_sku, 0) > 0
    ORDER BY COALESCE(pc.valor_total, 0) DESC NULLS LAST',
    p_schema, p_schema, p_schema, p_schema, p_schema,
    p_schema, p_schema, p_schema, p_schema, p_schema
  )
  USING p_data_inicio, p_data_fim, v_pa_data_inicio, v_pa_data_fim, NULL, NULL, v_filiais_array;
END;
$function$;

COMMENT ON FUNCTION public.get_dashboard_data_api_filial_vendas(text, date, date, text[]) IS
'Dashboard 360 - Versão baseada em vendas_filiais_snapshot (API /filial/vendas).';

COMMENT ON FUNCTION public.get_dashboard_mtd_metrics_api_filial_vendas(text, date, date, text[]) IS
'Dashboard 360 MTD - Versão baseada em vendas_filiais_snapshot (API /filial/vendas).';

COMMENT ON FUNCTION public.get_dashboard_ytd_metrics_api_filial_vendas(text, date, date, text[]) IS
'Dashboard 360 YTD - Versão baseada em vendas_filiais_snapshot (API /filial/vendas).';

COMMENT ON FUNCTION public.get_sales_by_month_chart_api_filial_vendas(text, text, date, date, text) IS
'Dashboard 360 gráfico de vendas - Versão baseada em vendas_filiais_snapshot (API /filial/vendas).';

COMMENT ON FUNCTION public.get_lucro_by_month_chart_api_filial_vendas(text, text, date, date, text) IS
'Dashboard 360 gráfico de lucro - Versão baseada em vendas_filiais_snapshot (API /filial/vendas).';

COMMENT ON FUNCTION public.get_vendas_por_filial_api_filial_vendas(text, date, date, text, text) IS
'Dashboard 360 vendas por filial - Versão baseada em vendas_filiais_snapshot (API /filial/vendas). Ticket médio = vendas / quantidade_clientes.';
