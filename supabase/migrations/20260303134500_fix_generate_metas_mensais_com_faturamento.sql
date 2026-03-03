-- Hotfix: corrige referência inválida ao alias da tabela alvo no UPDATE
-- da função generate_metas_mensais_com_faturamento.

CREATE OR REPLACE FUNCTION public.generate_metas_mensais_com_faturamento(
  p_schema text,
  p_filial_id bigint,
  p_mes integer,
  p_ano integer,
  p_meta_percentual numeric,
  p_data_referencia_inicial date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    p_data_referencia_inicial
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
          - (
            (
              COALESCE(mm.valor_referencia, 0) + COALESCE((
                SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
                FROM %I.faturamento f
                WHERE f.filial_id::bigint = mm.filial_id
                  AND f.data_saida = mm.data_referencia
              ), 0)
            ) * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
          ),
        diferenca_percentual = CASE
          WHEN (
            (
              COALESCE(mm.valor_referencia, 0) + COALESCE((
                SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
                FROM %I.faturamento f
                WHERE f.filial_id::bigint = mm.filial_id
                  AND f.data_saida = mm.data_referencia
              ), 0)
            ) * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
          ) > 0 THEN
            (
              (
                (COALESCE(mm.valor_realizado, 0) + COALESCE((
                  SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
                  FROM %I.faturamento f
                  WHERE f.filial_id::bigint = mm.filial_id
                    AND f.data_saida = mm.data
                ), 0))
                - (
                  (
                    COALESCE(mm.valor_referencia, 0) + COALESCE((
                      SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
                      FROM %I.faturamento f
                      WHERE f.filial_id::bigint = mm.filial_id
                        AND f.data_saida = mm.data_referencia
                    ), 0)
                  ) * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
                )
              )
              / (
                (
                  COALESCE(mm.valor_referencia, 0) + COALESCE((
                    SELECT SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0))
                    FROM %I.faturamento f
                    WHERE f.filial_id::bigint = mm.filial_id
                      AND f.data_saida = mm.data_referencia
                  ), 0)
                ) * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
              )
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
    p_schema,
    p_schema,
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
$$;
