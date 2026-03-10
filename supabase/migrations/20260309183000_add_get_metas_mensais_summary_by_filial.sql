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
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
  END IF;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

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
        COALESCE(SUM(m.valor_realizado), 0) AS valor_realizado,
        CASE
          WHEN COALESCE(SUM(m.valor_meta), 0) > 0 THEN
            (COALESCE(SUM(m.valor_realizado), 0) / COALESCE(SUM(m.valor_meta), 0)) * 100
          ELSE 0
        END AS percentual_atingido,
        COALESCE(SUM(m.lucro_realizado), 0) AS lucro_bruto,
        CASE
          WHEN COALESCE(SUM(m.valor_realizado), 0) > 0 THEN
            (COALESCE(SUM(m.lucro_realizado), 0) / COALESCE(SUM(m.valor_realizado), 0)) * 100
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
    EXECUTE v_query INTO v_result USING p_filial_ids, v_data_inicio, v_data_fim;
  ELSE
    EXECUTE v_query INTO v_result USING v_data_inicio, v_data_fim;
  END IF;

  RETURN COALESCE(v_result, json_build_object('resumo', '[]'::json));
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo de metas: %', SQLERRM;
END;
$function$;
