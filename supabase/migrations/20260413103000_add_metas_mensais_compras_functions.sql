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
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_metas_mensais_compras_report(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id bigint DEFAULT NULL::bigint,
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
BEGIN
  IF p_schema IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;

  EXECUTE format($sql$
    WITH metas_base AS (
      SELECT
        mm.data,
        mm.filial_id,
        mm.valor_meta,
        mm.meta_margem_percentual
      FROM %I.metas_mensais mm
      WHERE mm.data >= $1
        AND mm.data <= $2
        AND (
          ($3 IS NULL AND $4 IS NULL)
          OR ($4 IS NOT NULL AND mm.filial_id = ANY($4))
          OR ($4 IS NULL AND $3 IS NOT NULL AND mm.filial_id = $3)
        )
    ),
    compras_base AS (
      SELECT
        e.data_entrada::date AS data,
        e.filial_id,
        ROUND(SUM(COALESCE(e.valor_total, 0))::numeric, 2) AS valor_realizado_compras
      FROM %I.entradas e
      WHERE e.data_entrada >= $1
        AND e.data_entrada <= $2
        AND e.transacao IN ('P', 'V')
        AND (
          ($3 IS NULL AND $4 IS NULL)
          OR ($4 IS NOT NULL AND e.filial_id = ANY($4))
          OR ($4 IS NULL AND $3 IS NOT NULL AND e.filial_id = $3)
        )
      GROUP BY e.data_entrada::date, e.filial_id
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'data', mb.data,
          'filial_id', mb.filial_id,
          'valor_meta_compras',
            CASE
              WHEN mb.meta_margem_percentual IS NULL THEN NULL
              ELSE ROUND((mb.valor_meta - (mb.valor_meta * mb.meta_margem_percentual / 100))::numeric, 2)
            END,
          'valor_realizado_compras', COALESCE(cb.valor_realizado_compras, 0)
        )
        ORDER BY mb.data, mb.filial_id
      ),
      '[]'::jsonb
    )
    FROM metas_base mb
    LEFT JOIN compras_base cb
      ON cb.data = mb.data
     AND cb.filial_id = mb.filial_id
  $sql$, p_schema, p_schema)
  INTO v_result
  USING v_date_start, v_date_end, p_filial_id, p_filial_ids;

  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar compras das metas mensais (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar compras das metas mensais: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metas_mensais_compras_summary_by_filial(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id bigint DEFAULT NULL::bigint,
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
BEGIN
  IF p_schema IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;

  EXECUTE format($sql$
    WITH metas_base AS (
      SELECT
        mm.filial_id,
        CASE
          WHEN mm.meta_margem_percentual IS NULL THEN NULL
          ELSE ROUND((mm.valor_meta - (mm.valor_meta * mm.meta_margem_percentual / 100))::numeric, 2)
        END AS valor_meta_compras
      FROM %I.metas_mensais mm
      WHERE mm.data >= $1
        AND mm.data <= $2
        AND (
          ($3 IS NULL AND $4 IS NULL)
          OR ($4 IS NOT NULL AND mm.filial_id = ANY($4))
          OR ($4 IS NULL AND $3 IS NOT NULL AND mm.filial_id = $3)
        )
    ),
    compras_base AS (
      SELECT
        e.filial_id,
        ROUND(SUM(COALESCE(e.valor_total, 0))::numeric, 2) AS valor_realizado_compras
      FROM %I.entradas e
      WHERE e.data_entrada >= $1
        AND e.data_entrada <= $2
        AND e.transacao IN ('P', 'V')
        AND (
          ($3 IS NULL AND $4 IS NULL)
          OR ($4 IS NOT NULL AND e.filial_id = ANY($4))
          OR ($4 IS NULL AND $3 IS NOT NULL AND e.filial_id = $3)
        )
      GROUP BY e.filial_id
    ),
    metas_resumidas AS (
      SELECT
        mb.filial_id,
        ROUND(SUM(mb.valor_meta_compras)::numeric, 2) AS valor_meta_compras
      FROM metas_base mb
      GROUP BY mb.filial_id
    )
    SELECT jsonb_build_object(
      'resumo',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'filial_id', mr.filial_id,
            'valor_meta_compras', mr.valor_meta_compras,
            'valor_realizado_compras', COALESCE(cb.valor_realizado_compras, 0)
          )
          ORDER BY mr.filial_id
        ),
        '[]'::jsonb
      )
    )
    FROM metas_resumidas mr
    LEFT JOIN compras_base cb
      ON cb.filial_id = mr.filial_id
  $sql$, p_schema, p_schema)
  INTO v_result
  USING v_date_start, v_date_end, p_filial_id, p_filial_ids;

  RETURN COALESCE(v_result, jsonb_build_object('resumo', '[]'::jsonb));
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar resumo de compras das metas mensais (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo de compras das metas mensais: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;
