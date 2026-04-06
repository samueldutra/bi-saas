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
      'CREATE INDEX IF NOT EXISTS idx_entradas_compra_data_filial
         ON %I.entradas (data_entrada, filial_id, id)
       WHERE transacao IN (''P'', ''V'')',
      tenant_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_entradas_produtos_entrada_produto
         ON %I.entradas_produtos (entrada_id, produto_id)
       INCLUDE (quantidade, custo_unitario)',
      tenant_schema
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_metas_setor_compras_report(
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
  v_result jsonb;
  v_date_start date;
  v_date_end date;
  v_setor record;
  v_dept_ids_level_1 bigint[];
BEGIN
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  EXECUTE format(
    'SELECT departamento_nivel, departamento_ids
     FROM %I.setores
     WHERE id = $1
       AND (ativo IS NULL OR ativo = true)',
    p_schema
  )
  INTO v_setor
  USING p_setor_id;

  IF v_setor.departamento_ids IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_dept_ids_level_1 := public.get_departamentos_hierarquia_simples(
    p_schema,
    v_setor.departamento_nivel,
    v_setor.departamento_ids
  );

  IF v_dept_ids_level_1 IS NULL OR array_length(v_dept_ids_level_1, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;

  EXECUTE format($sql$
    WITH metas_base AS (
      SELECT
        ms.data,
        ms.filial_id,
        ms.valor_meta,
        ms.meta_margem_percentual
      FROM %I.metas_setor ms
      WHERE ms.setor_id = $1
        AND ms.data >= $2
        AND ms.data <= $3
        AND ($4 IS NULL OR ms.filial_id = ANY($4))
    ),
    compras_base AS (
      SELECT
        e.data_entrada::date AS data,
        e.filial_id,
        ROUND(SUM(COALESCE(ep.quantidade, 0) * COALESCE(ep.custo_unitario, 0))::numeric, 2) AS valor_realizado_compras
      FROM %I.entradas e
      INNER JOIN %I.entradas_produtos ep
        ON ep.entrada_id = e.id
      INNER JOIN %I.produtos p
        ON p.id = ep.produto_id
       AND p.filial_id = e.filial_id
      WHERE e.data_entrada >= $2
        AND e.data_entrada <= $3
        AND e.transacao IN ('P', 'V')
        AND p.departamento_id = ANY($5)
        AND ($4 IS NULL OR e.filial_id = ANY($4))
      GROUP BY e.data_entrada::date, e.filial_id
    ),
    datas AS (
      SELECT DISTINCT mb.data
      FROM metas_base mb
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'data', d.data,
          'filiais', (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'filial_id', mb.filial_id,
                  'valor_meta_compras',
                    CASE
                      WHEN mb.meta_margem_percentual IS NULL THEN NULL
                      ELSE ROUND((mb.valor_meta - (mb.valor_meta * mb.meta_margem_percentual / 100))::numeric, 2)
                    END,
                  'valor_realizado_compras', COALESCE(cb.valor_realizado_compras, 0)
                )
                ORDER BY mb.filial_id
              ),
              '[]'::jsonb
            )
            FROM metas_base mb
            LEFT JOIN compras_base cb
              ON cb.data = mb.data
             AND cb.filial_id = mb.filial_id
            WHERE mb.data = d.data
          )
        )
        ORDER BY d.data
      ),
      '[]'::jsonb
    )
    FROM datas d
  $sql$, p_schema, p_schema, p_schema, p_schema)
  INTO v_result
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids, v_dept_ids_level_1;

  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar compras por setor (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar compras por setor: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metas_setor_compras_summary_by_filial(
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
  v_result jsonb;
  v_date_start date;
  v_date_end date;
  v_setor record;
  v_dept_ids_level_1 bigint[];
BEGIN
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  EXECUTE format(
    'SELECT departamento_nivel, departamento_ids
     FROM %I.setores
     WHERE id = $1
       AND (ativo IS NULL OR ativo = true)',
    p_schema
  )
  INTO v_setor
  USING p_setor_id;

  IF v_setor.departamento_ids IS NULL THEN
    RETURN jsonb_build_object('resumo', '[]'::jsonb);
  END IF;

  v_dept_ids_level_1 := public.get_departamentos_hierarquia_simples(
    p_schema,
    v_setor.departamento_nivel,
    v_setor.departamento_ids
  );

  IF v_dept_ids_level_1 IS NULL OR array_length(v_dept_ids_level_1, 1) IS NULL THEN
    RETURN jsonb_build_object('resumo', '[]'::jsonb);
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;

  EXECUTE format($sql$
    WITH metas_base AS (
      SELECT
        ms.filial_id,
        CASE
          WHEN ms.meta_margem_percentual IS NULL THEN NULL
          ELSE ROUND((ms.valor_meta - (ms.valor_meta * ms.meta_margem_percentual / 100))::numeric, 2)
        END AS valor_meta_compras
      FROM %I.metas_setor ms
      WHERE ms.setor_id = $1
        AND ms.data >= $2
        AND ms.data <= $3
        AND ($4 IS NULL OR ms.filial_id = ANY($4))
    ),
    compras_base AS (
      SELECT
        e.filial_id,
        ROUND(SUM(COALESCE(ep.quantidade, 0) * COALESCE(ep.custo_unitario, 0))::numeric, 2) AS valor_realizado_compras
      FROM %I.entradas e
      INNER JOIN %I.entradas_produtos ep
        ON ep.entrada_id = e.id
      INNER JOIN %I.produtos p
        ON p.id = ep.produto_id
       AND p.filial_id = e.filial_id
      WHERE e.data_entrada >= $2
        AND e.data_entrada <= $3
        AND e.transacao IN ('P', 'V')
        AND p.departamento_id = ANY($5)
        AND ($4 IS NULL OR e.filial_id = ANY($4))
      GROUP BY e.filial_id
    ),
    meta_resumida AS (
      SELECT
        mb.filial_id,
        ROUND(SUM(mb.valor_meta_compras)::numeric, 2) AS valor_meta_compras
      FROM metas_base mb
      GROUP BY mb.filial_id
    ),
    filiais_base AS (
      SELECT DISTINCT mb.filial_id
      FROM metas_base mb
    )
    SELECT jsonb_build_object(
      'resumo',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'filial_id', fb.filial_id,
            'valor_meta_compras', mr.valor_meta_compras,
            'valor_realizado_compras', COALESCE(cb.valor_realizado_compras, 0)
          )
          ORDER BY fb.filial_id
        ),
        '[]'::jsonb
      )
    )
    FROM filiais_base fb
    LEFT JOIN meta_resumida mr
      ON mr.filial_id = fb.filial_id
    LEFT JOIN compras_base cb
      ON cb.filial_id = fb.filial_id
  $sql$, p_schema, p_schema, p_schema, p_schema)
  INTO v_result
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids, v_dept_ids_level_1;

  RETURN COALESCE(v_result, jsonb_build_object('resumo', '[]'::jsonb));
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar resumo de compras por setor (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo de compras por setor: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;
