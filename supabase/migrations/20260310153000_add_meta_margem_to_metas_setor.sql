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
      'ALTER TABLE %I.metas_setor ADD COLUMN IF NOT EXISTS meta_margem_percentual numeric',
      tenant_schema
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.generate_metas_setor(
  p_schema text,
  p_setor_id bigint,
  p_filial_id bigint,
  p_mes integer,
  p_ano integer,
  p_meta_percentual numeric,
  p_data_referencia_inicial date,
  p_meta_margem_percentual numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_setor RECORD;
  v_dias_no_mes INT;
  v_current_date DATE;
  v_data_referencia DATE;
  v_dia_semana TEXT;
  v_dia_semana_ref TEXT;
  v_valor_referencia NUMERIC;
  v_valor_meta NUMERIC;
  v_valor_realizado NUMERIC;
  v_diferenca NUMERIC;
  v_diferenca_percentual NUMERIC;
  v_rows_inserted INT := 0;
  v_dept_ids_level_1 BIGINT[];
BEGIN
  EXECUTE format('SELECT departamento_nivel, departamento_ids FROM %I.setores WHERE id = $1 AND (ativo IS NULL OR ativo = true)', p_schema)
  INTO v_setor USING p_setor_id;

  IF v_setor.departamento_ids IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Setor não encontrado');
  END IF;

  v_dept_ids_level_1 := public.get_departamentos_hierarquia_simples(p_schema, v_setor.departamento_nivel, v_setor.departamento_ids);

  IF v_dept_ids_level_1 IS NULL OR array_length(v_dept_ids_level_1, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Nenhum departamento encontrado na hierarquia');
  END IF;

  v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(p_ano, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day'));

  EXECUTE format('DELETE FROM %I.metas_setor WHERE setor_id = $1 AND filial_id = $2 AND EXTRACT(MONTH FROM data) = $3 AND EXTRACT(YEAR FROM data) = $4', p_schema)
  USING p_setor_id, p_filial_id, p_mes, p_ano;

  FOR i IN 1..v_dias_no_mes LOOP
    v_current_date := MAKE_DATE(p_ano, p_mes, i);
    v_data_referencia := p_data_referencia_inicial + (i - 1);

    v_dia_semana := CASE EXTRACT(DOW FROM v_current_date) WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda-Feira' WHEN 2 THEN 'Terça-Feira' WHEN 3 THEN 'Quarta-Feira' WHEN 4 THEN 'Quinta-Feira' WHEN 5 THEN 'Sexta-Feira' WHEN 6 THEN 'Sábado' END;
    v_dia_semana_ref := CASE EXTRACT(DOW FROM v_data_referencia) WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda-Feira' WHEN 2 THEN 'Terça-Feira' WHEN 3 THEN 'Quarta-Feira' WHEN 4 THEN 'Quinta-Feira' WHEN 5 THEN 'Sexta-Feira' WHEN 6 THEN 'Sábado' END;

    EXECUTE format('
      SELECT COALESCE(SUM(v.valor_vendas), 0)
      FROM %I.vendas v
      JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND v.data_venda = $2
        AND p.departamento_id = ANY($3)
    ', p_schema, p_schema)
    INTO v_valor_referencia
    USING p_filial_id, v_data_referencia, v_dept_ids_level_1;

    v_valor_meta := CASE WHEN v_valor_referencia > 0 THEN v_valor_referencia * (1 + (p_meta_percentual / 100)) ELSE NULL END;

    EXECUTE format('
      SELECT COALESCE(SUM(v.valor_vendas), 0)
      FROM %I.vendas v
      JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND v.data_venda = $2
        AND p.departamento_id = ANY($3)
    ', p_schema, p_schema)
    INTO v_valor_realizado
    USING p_filial_id, v_current_date, v_dept_ids_level_1;

    v_diferenca := CASE WHEN v_valor_meta IS NOT NULL THEN v_valor_realizado - v_valor_meta ELSE NULL END;
    v_diferenca_percentual := CASE WHEN v_valor_meta > 0 THEN (v_diferenca / v_valor_meta) * 100 ELSE 0 END;

    EXECUTE format('INSERT INTO %I.metas_setor (setor_id, filial_id, data, dia_semana, meta_percentual, meta_margem_percentual, data_referencia, dia_semana_ref, valor_referencia, valor_meta, valor_realizado, diferenca, diferenca_percentual) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)', p_schema)
    USING p_setor_id, p_filial_id, v_current_date, v_dia_semana, p_meta_percentual, p_meta_margem_percentual, v_data_referencia, v_dia_semana_ref, v_valor_referencia, v_valor_meta, v_valor_realizado, v_diferenca, v_diferenca_percentual;

    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'rows_inserted', v_rows_inserted,
    'message', format('Metas geradas: %s linhas', v_rows_inserted),
    'meta_margem_percentual', p_meta_margem_percentual,
    'debug', json_build_object(
      'nivel', v_setor.departamento_nivel,
      'dept_ids_config', v_setor.departamento_ids,
      'dept_ids_level_1', v_dept_ids_level_1
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_metas_setor_com_faturamento(
  p_schema text,
  p_setor_id bigint,
  p_filial_id bigint,
  p_mes integer,
  p_ano integer,
  p_meta_percentual numeric,
  p_data_referencia_inicial date,
  p_meta_margem_percentual numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_base_result json;
  v_departamento_nivel int;
  v_departamento_ids bigint[];
  v_dept_ids_level_1 bigint[];
  v_data_inicio date;
  v_data_fim date;
  v_rows_updated integer := 0;
BEGIN
  SELECT public.generate_metas_setor(
    p_schema,
    p_setor_id,
    p_filial_id,
    p_mes,
    p_ano,
    p_meta_percentual,
    p_data_referencia_inicial,
    p_meta_margem_percentual
  )
  INTO v_base_result;

  EXECUTE format(
    'SELECT departamento_nivel, departamento_ids
       FROM %I.setores
      WHERE id = $1
        AND (ativo IS NULL OR ativo = true)',
    p_schema
  )
  INTO v_departamento_nivel, v_departamento_ids
  USING p_setor_id;

  IF v_departamento_ids IS NULL OR array_length(v_departamento_ids, 1) IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Setor sem configuração de departamentos',
      'base_result', v_base_result
    );
  END IF;

  v_dept_ids_level_1 := public.get_departamentos_hierarquia_simples(
    p_schema,
    v_departamento_nivel,
    v_departamento_ids
  );

  IF v_dept_ids_level_1 IS NULL OR array_length(v_dept_ids_level_1, 1) IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Não foi possível mapear departamentos de nível 1 para o setor',
      'base_result', v_base_result
    );
  END IF;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  EXECUTE format(
    $sql$
      UPDATE %I.metas_setor ms
      SET
        valor_referencia =
          COALESCE(vr_ref.receita_vendas, 0) + COALESCE(fr_ref.receita_faturamento, 0),
        valor_meta =
          (COALESCE(vr_ref.receita_vendas, 0) + COALESCE(fr_ref.receita_faturamento, 0))
          * (1 + (COALESCE(ms.meta_percentual, $4) / 100)),
        valor_realizado =
          COALESCE(vr_real.receita_vendas, 0) + COALESCE(fr_real.receita_faturamento, 0),
        custo_realizado =
          COALESCE(vr_real.custo_vendas, 0) + COALESCE(fr_real.custo_faturamento, 0),
        lucro_realizado =
          (COALESCE(vr_real.receita_vendas, 0) + COALESCE(fr_real.receita_faturamento, 0))
          - (COALESCE(vr_real.custo_vendas, 0) + COALESCE(fr_real.custo_faturamento, 0)),
        diferenca =
          (COALESCE(vr_real.receita_vendas, 0) + COALESCE(fr_real.receita_faturamento, 0))
          - (
            (COALESCE(vr_ref.receita_vendas, 0) + COALESCE(fr_ref.receita_faturamento, 0))
            * (1 + (COALESCE(ms.meta_percentual, $4) / 100))
          ),
        diferenca_percentual = CASE
          WHEN (
            (COALESCE(vr_ref.receita_vendas, 0) + COALESCE(fr_ref.receita_faturamento, 0))
            * (1 + (COALESCE(ms.meta_percentual, $4) / 100))
          ) > 0 THEN
            (
              (
                (COALESCE(vr_real.receita_vendas, 0) + COALESCE(fr_real.receita_faturamento, 0))
                - (
                  (COALESCE(vr_ref.receita_vendas, 0) + COALESCE(fr_ref.receita_faturamento, 0))
                  * (1 + (COALESCE(ms.meta_percentual, $4) / 100))
                )
              )
              / (
                (COALESCE(vr_ref.receita_vendas, 0) + COALESCE(fr_ref.receita_faturamento, 0))
                * (1 + (COALESCE(ms.meta_percentual, $4) / 100))
              )
            ) * 100
          ELSE 0
        END,
        updated_at = NOW()
      FROM LATERAL (
        SELECT
          COALESCE(SUM(COALESCE(v.valor_vendas, 0)), 0) AS receita_vendas
        FROM %I.vendas v
        INNER JOIN %I.produtos p
          ON p.id = v.id_produto
         AND p.filial_id = v.filial_id
        WHERE v.filial_id = ms.filial_id
          AND v.data_venda = ms.data_referencia
          AND p.departamento_id = ANY($5)
      ) vr_ref,
      LATERAL (
        SELECT
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita_faturamento
        FROM %I.faturamento f
        INNER JOIN %I.produtos p
          ON p.id = f.id_produto
         AND p.filial_id = f.filial_id
        WHERE f.filial_id::bigint = ms.filial_id
          AND f.data_saida = ms.data_referencia
          AND p.departamento_id = ANY($5)
      ) fr_ref,
      LATERAL (
        SELECT
          COALESCE(SUM(COALESCE(v.valor_vendas, 0)), 0) AS receita_vendas,
          COALESCE(SUM(COALESCE(v.quantidade, 0) * COALESCE(v.custo_compra, 0)), 0) AS custo_vendas
        FROM %I.vendas v
        INNER JOIN %I.produtos p
          ON p.id = v.id_produto
         AND p.filial_id = v.filial_id
        WHERE v.filial_id = ms.filial_id
          AND v.data_venda = ms.data
          AND p.departamento_id = ANY($5)
      ) vr_real,
      LATERAL (
        SELECT
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita_faturamento,
          COALESCE(SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0)), 0) AS custo_faturamento
        FROM %I.faturamento f
        INNER JOIN %I.produtos p
          ON p.id = f.id_produto
         AND p.filial_id = f.filial_id
        WHERE f.filial_id::bigint = ms.filial_id
          AND f.data_saida = ms.data
          AND p.departamento_id = ANY($5)
      ) fr_real
      WHERE ms.setor_id = $1
        AND ms.filial_id = $2
        AND ms.data >= $3
        AND ms.data <= $6
    $sql$,
    p_schema,
    p_schema, p_schema,
    p_schema, p_schema,
    p_schema, p_schema,
    p_schema, p_schema
  )
  USING p_setor_id, p_filial_id, v_data_inicio, p_meta_percentual, v_dept_ids_level_1, v_data_fim;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'mode', 'faturamento',
    'base_result', v_base_result,
    'rows_updated_with_faturamento', v_rows_updated
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metas_setor_report_optimized(
  p_schema text,
  p_setor_id bigint,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '45s'
SET work_mem TO '64MB'
AS $function$
DECLARE
  v_result JSONB;
  v_date_start DATE;
  v_date_end DATE;
  v_query_start TIMESTAMP;
  v_query_duration INTERVAL;
BEGIN
  v_query_start := clock_timestamp();

  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := v_date_start + INTERVAL '1 month' - INTERVAL '1 day';

  EXECUTE format('
    SELECT COALESCE(json_agg(
      json_build_object(
        ''data'', ms.data,
        ''dia_semana'', ms.dia_semana,
        ''filiais'', (
          SELECT json_agg(
            json_build_object(
              ''filial_id'', msf.filial_id,
              ''filial_nome'', COALESCE(b.descricao, ''Filial '' || msf.filial_id),
              ''data_referencia'', msf.data_referencia,
              ''dia_semana_ref'', msf.dia_semana_ref,
              ''valor_referencia'', COALESCE(msf.valor_referencia, 0),
              ''meta_percentual'', COALESCE(msf.meta_percentual, 0),
              ''meta_margem_percentual'', msf.meta_margem_percentual,
              ''valor_meta'', COALESCE(msf.valor_meta, 0),
              ''valor_realizado'', COALESCE(msf.valor_realizado, 0),
              ''custo_realizado'', COALESCE(msf.custo_realizado, 0),
              ''lucro_realizado'', COALESCE(msf.lucro_realizado, 0),
              ''diferenca'', COALESCE(msf.diferenca, 0),
              ''diferenca_percentual'', COALESCE(msf.diferenca_percentual, 0),
              ''percentual_atingido'', CASE
                WHEN COALESCE(msf.valor_meta, 0) > 0 THEN
                  ROUND((COALESCE(msf.valor_realizado, 0) / msf.valor_meta * 100)::numeric, 2)
                ELSE 0
              END
            ) ORDER BY COALESCE(b.descricao, ''Filial '' || msf.filial_id)
          )
          FROM %I.metas_setor msf
          LEFT JOIN public.branches b
            ON b.branch_code = msf.filial_id::text
            AND b.tenant_id = (SELECT id FROM public.tenants WHERE supabase_schema = %L LIMIT 1)
          WHERE msf.setor_id = ms.setor_id
            AND msf.data = ms.data
            AND ($3 IS NULL OR msf.filial_id = ANY($3))
        )
      ) ORDER BY ms.data
    ), ''[]''::json)
    FROM (
      SELECT DISTINCT ms.data, ms.setor_id, ms.dia_semana
      FROM %I.metas_setor ms
      WHERE ms.setor_id = $1
        AND ms.data >= $4
        AND ms.data <= $5
        AND ($3 IS NULL OR ms.filial_id = ANY($3))
    ) ms
  ',
    p_schema,
    p_schema,
    p_schema
  )
  INTO v_result
  USING p_setor_id, p_mes, p_filial_ids, v_date_start, v_date_end;

  v_query_duration := clock_timestamp() - v_query_start;

  RAISE NOTICE 'Query executada em: %', v_query_duration;
  RAISE NOTICE 'Registros retornados: %', COALESCE(jsonb_array_length(v_result), 0);

  RETURN v_result;
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar metas (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar metas: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metas_setor_summary_by_filial(
  p_schema text,
  p_setor_id bigint,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '45s'
SET work_mem TO '64MB'
AS $function$
DECLARE
  v_result jsonb;
  v_date_start date;
  v_date_end date;
  v_today date;
  v_current_month boolean;
BEGIN
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;
  v_today := current_date;
  v_current_month := extract(year from v_today) = p_ano AND extract(month from v_today) = p_mes;

  EXECUTE format($sql$
    WITH base AS (
      SELECT
        ms.filial_id,
        COALESCE(b.descricao, 'Filial ' || ms.filial_id) AS filial_nome,
        COALESCE(ms.valor_meta, 0) AS valor_meta,
        COALESCE(ms.valor_realizado, 0) AS valor_realizado,
        COALESCE(ms.lucro_realizado, 0) AS lucro_realizado,
        COALESCE(ms.meta_margem_percentual, NULL) AS meta_margem_percentual,
        ms.data
      FROM %I.metas_setor ms
      LEFT JOIN public.branches b
        ON b.branch_code = ms.filial_id::text
       AND b.tenant_id = (
         SELECT id
         FROM public.tenants
         WHERE supabase_schema = %L
         LIMIT 1
       )
      WHERE ms.setor_id = $1
        AND ms.data >= $2
        AND ms.data <= $3
        AND ($4 IS NULL OR ms.filial_id = ANY($4))
    ),
    resumido AS (
      SELECT
        filial_id,
        MAX(filial_nome) AS filial_nome,
        SUM(valor_meta) AS valor_meta,
        SUM(valor_realizado) AS valor_realizado,
        SUM(lucro_realizado) AS lucro_bruto,
        AVG(meta_margem_percentual) FILTER (WHERE meta_margem_percentual IS NOT NULL) AS meta_margem_percentual,
        SUM(
          CASE
            WHEN $5 = true AND data < $6 THEN valor_meta
            ELSE 0
          END
        ) AS valor_meta_acumulada_d1
      FROM base
      GROUP BY filial_id
    )
    SELECT jsonb_build_object(
      'resumo',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'filial_id', filial_id,
            'filial_nome', filial_nome,
            'valor_meta', ROUND(valor_meta::numeric, 2),
            'valor_meta_acumulada_d1', ROUND(valor_meta_acumulada_d1::numeric, 2),
            'valor_realizado', ROUND(valor_realizado::numeric, 2),
            'percentual_atingido',
              CASE
                WHEN valor_meta > 0 THEN ROUND(((valor_realizado / valor_meta) * 100)::numeric, 2)
                ELSE 0
              END,
            'percentual_atingido_acumulado_d1',
              CASE
                WHEN valor_meta_acumulada_d1 > 0 THEN ROUND(((valor_realizado / valor_meta_acumulada_d1) * 100)::numeric, 2)
                ELSE 0
              END,
            'lucro_bruto', ROUND(lucro_bruto::numeric, 2),
            'meta_margem_percentual', ROUND(meta_margem_percentual::numeric, 2),
            'margem_bruta',
              CASE
                WHEN valor_realizado > 0 THEN ROUND(((lucro_bruto / valor_realizado) * 100)::numeric, 2)
                ELSE 0
              END
          )
          ORDER BY filial_nome
        ),
        '[]'::jsonb
      )
    )
    FROM resumido
  $sql$, p_schema, p_schema)
  INTO v_result
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids, v_current_month, v_today;

  RETURN COALESCE(v_result, jsonb_build_object('resumo', '[]'::jsonb));
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar resumo mensal de metas por setor (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo mensal de metas por setor: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;
