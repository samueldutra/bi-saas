-- Metas com Faturamento (isolado por novas funções)
-- Não altera funções legadas existentes.

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
        valor_referencia = COALESCE(mm.valor_referencia, 0) + COALESCE(fr.receita_ref, 0),
        valor_meta = (COALESCE(mm.valor_referencia, 0) + COALESCE(fr.receita_ref, 0))
          * (1 + (COALESCE(mm.meta_percentual, $4) / 100)),
        valor_realizado = COALESCE(mm.valor_realizado, 0) + COALESCE(fa.receita_real, 0),
        custo_realizado = COALESCE(mm.custo_realizado, 0) + COALESCE(fa.custo_real, 0),
        lucro_realizado =
          (COALESCE(mm.valor_realizado, 0) + COALESCE(fa.receita_real, 0))
          - (COALESCE(mm.custo_realizado, 0) + COALESCE(fa.custo_real, 0)),
        diferenca =
          (COALESCE(mm.valor_realizado, 0) + COALESCE(fa.receita_real, 0))
          - (
            (COALESCE(mm.valor_referencia, 0) + COALESCE(fr.receita_ref, 0))
            * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
          ),
        diferenca_percentual = CASE
          WHEN (
            (COALESCE(mm.valor_referencia, 0) + COALESCE(fr.receita_ref, 0))
            * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
          ) > 0 THEN
            (
              (
                (COALESCE(mm.valor_realizado, 0) + COALESCE(fa.receita_real, 0))
                - (
                  (COALESCE(mm.valor_referencia, 0) + COALESCE(fr.receita_ref, 0))
                  * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
                )
              )
              / (
                (COALESCE(mm.valor_referencia, 0) + COALESCE(fr.receita_ref, 0))
                * (1 + (COALESCE(mm.meta_percentual, $4) / 100))
              )
            ) * 100
          ELSE 0
        END,
        updated_at = NOW()
      FROM LATERAL (
        SELECT
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita_ref
        FROM %I.faturamento f
        WHERE f.filial_id::bigint = mm.filial_id
          AND f.data_saida = mm.data_referencia
      ) fr,
      LATERAL (
        SELECT
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita_real,
          COALESCE(SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0)), 0) AS custo_real
        FROM %I.faturamento f
        WHERE f.filial_id::bigint = mm.filial_id
          AND f.data_saida = mm.data
      ) fa
      WHERE mm.filial_id = $1
        AND mm.data >= $2
        AND mm.data <= $3
    $sql$,
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


CREATE OR REPLACE FUNCTION public.atualizar_valores_realizados_metas_com_faturamento(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id bigint DEFAULT NULL
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
  SELECT public.atualizar_valores_realizados_metas(p_schema, p_mes, p_ano, p_filial_id)
  INTO v_base_result;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  EXECUTE format(
    $sql$
      WITH fat AS (
        SELECT
          f.data_saida::date AS data,
          f.filial_id::bigint AS filial_id,
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita,
          COALESCE(SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0)), 0) AS custo
        FROM %I.faturamento f
        WHERE f.data_saida >= $1
          AND f.data_saida <= $2
          AND ($3 IS NULL OR f.filial_id::bigint = $3)
        GROUP BY f.data_saida, f.filial_id
      )
      UPDATE %I.metas_mensais mm
      SET
        valor_realizado = COALESCE(mm.valor_realizado, 0) + COALESCE(fat.receita, 0),
        custo_realizado = COALESCE(mm.custo_realizado, 0) + COALESCE(fat.custo, 0),
        lucro_realizado =
          (COALESCE(mm.valor_realizado, 0) + COALESCE(fat.receita, 0))
          - (COALESCE(mm.custo_realizado, 0) + COALESCE(fat.custo, 0)),
        diferenca =
          (COALESCE(mm.valor_realizado, 0) + COALESCE(fat.receita, 0))
          - COALESCE(mm.valor_meta, 0),
        diferenca_percentual = CASE
          WHEN COALESCE(mm.valor_meta, 0) > 0 THEN
            (
              (
                (COALESCE(mm.valor_realizado, 0) + COALESCE(fat.receita, 0))
                - COALESCE(mm.valor_meta, 0)
              ) / COALESCE(mm.valor_meta, 0)
            ) * 100
          ELSE 0
        END,
        updated_at = NOW()
      FROM fat
      WHERE mm.data = fat.data
        AND mm.filial_id = fat.filial_id
        AND mm.data >= $1
        AND mm.data <= $2
        AND ($3 IS NULL OR mm.filial_id = $3)
    $sql$,
    p_schema,
    p_schema
  )
  USING v_data_inicio, v_data_fim, p_filial_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'faturamento',
    'base_result', v_base_result,
    'rows_updated_with_faturamento', v_rows_updated
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.generate_metas_setor_com_faturamento(
  p_schema text,
  p_setor_id bigint,
  p_filial_id bigint,
  p_mes integer,
  p_ano integer,
  p_meta_percentual numeric,
  p_data_referencia_inicial date
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    p_data_referencia_inicial
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
$$;


CREATE OR REPLACE FUNCTION public.atualizar_valores_realizados_metas_setor_com_faturamento(
  p_schema text,
  p_setor_id bigint,
  p_mes integer,
  p_ano integer,
  p_filial_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_result jsonb;
  v_departamento_nivel int;
  v_departamento_ids bigint[];
  v_dept_ids_level_1 bigint[];
  v_data_inicio date;
  v_data_fim date;
  v_rows_updated integer := 0;
BEGIN
  SELECT public.atualizar_valores_realizados_metas_setor(
    p_schema,
    p_setor_id,
    p_mes,
    p_ano,
    p_filial_id
  )
  INTO v_base_result;

  EXECUTE format(
    'SELECT departamento_nivel, departamento_ids
       FROM %I.setores
      WHERE id = $1
        AND ativo = true',
    p_schema
  )
  INTO v_departamento_nivel, v_departamento_ids
  USING p_setor_id;

  IF v_departamento_ids IS NULL OR array_length(v_departamento_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
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
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Não foi possível mapear departamentos de nível 1 para o setor',
      'base_result', v_base_result
    );
  END IF;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  EXECUTE format(
    $sql$
      WITH fat AS (
        SELECT
          f.data_saida::date AS data,
          f.filial_id::bigint AS filial_id,
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita,
          COALESCE(SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0)), 0) AS custo
        FROM %I.faturamento f
        INNER JOIN %I.produtos p
          ON p.id = f.id_produto
         AND p.filial_id = f.filial_id
        WHERE f.data_saida >= $1
          AND f.data_saida <= $2
          AND ($4 IS NULL OR f.filial_id::bigint = $4)
          AND p.departamento_id = ANY($5)
        GROUP BY f.data_saida, f.filial_id
      )
      UPDATE %I.metas_setor ms
      SET
        valor_realizado = COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0),
        custo_realizado = COALESCE(ms.custo_realizado, 0) + COALESCE(fat.custo, 0),
        lucro_realizado =
          (COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0))
          - (COALESCE(ms.custo_realizado, 0) + COALESCE(fat.custo, 0)),
        diferenca =
          (COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0))
          - COALESCE(ms.valor_meta, 0),
        diferenca_percentual = CASE
          WHEN COALESCE(ms.valor_meta, 0) > 0 THEN
            (
              (
                (COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0))
                - COALESCE(ms.valor_meta, 0)
              ) / COALESCE(ms.valor_meta, 0)
            ) * 100
          ELSE 0
        END,
        updated_at = NOW()
      FROM fat
      WHERE ms.setor_id = $3
        AND ms.data = fat.data
        AND ms.filial_id = fat.filial_id
        AND ms.data >= $1
        AND ms.data <= $2
        AND ($4 IS NULL OR ms.filial_id = $4)
    $sql$,
    p_schema,
    p_schema,
    p_schema
  )
  USING v_data_inicio, v_data_fim, p_setor_id, p_filial_id, v_dept_ids_level_1;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'faturamento',
    'base_result', v_base_result,
    'rows_updated_with_faturamento', v_rows_updated
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.atualizar_valores_realizados_todos_setores_com_faturamento(
  p_schema text,
  p_mes integer,
  p_ano integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_result json;
  v_data_inicio date;
  v_data_fim date;
  v_rows_updated integer := 0;
BEGIN
  SELECT public.atualizar_valores_realizados_todos_setores(p_schema, p_mes, p_ano)
  INTO v_base_result;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  EXECUTE format(
    $sql$
      WITH setores_ativos AS (
        SELECT
          s.id AS setor_id,
          public.get_departamentos_hierarquia_simples($3, s.departamento_nivel, s.departamento_ids) AS dept_ids_level_1
        FROM %I.setores s
        WHERE s.ativo = true
      ),
      fat AS (
        SELECT
          sa.setor_id,
          f.data_saida::date AS data,
          f.filial_id::bigint AS filial_id,
          COALESCE(SUM(COALESCE(f.preco_final, 0) * COALESCE(f.quantidade, 0)), 0) AS receita,
          COALESCE(SUM(COALESCE(f.custo_unitario, 0) * COALESCE(f.quantidade, 0)), 0) AS custo
        FROM setores_ativos sa
        INNER JOIN %I.faturamento f
          ON f.data_saida >= $1
         AND f.data_saida <= $2
        INNER JOIN %I.produtos p
          ON p.id = f.id_produto
         AND p.filial_id = f.filial_id
        WHERE sa.dept_ids_level_1 IS NOT NULL
          AND array_length(sa.dept_ids_level_1, 1) > 0
          AND p.departamento_id = ANY(sa.dept_ids_level_1)
        GROUP BY sa.setor_id, f.data_saida, f.filial_id
      )
      UPDATE %I.metas_setor ms
      SET
        valor_realizado = COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0),
        custo_realizado = COALESCE(ms.custo_realizado, 0) + COALESCE(fat.custo, 0),
        lucro_realizado =
          (COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0))
          - (COALESCE(ms.custo_realizado, 0) + COALESCE(fat.custo, 0)),
        diferenca =
          (COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0))
          - COALESCE(ms.valor_meta, 0),
        diferenca_percentual = CASE
          WHEN COALESCE(ms.valor_meta, 0) > 0 THEN
            (
              (
                (COALESCE(ms.valor_realizado, 0) + COALESCE(fat.receita, 0))
                - COALESCE(ms.valor_meta, 0)
              ) / COALESCE(ms.valor_meta, 0)
            ) * 100
          ELSE 0
        END,
        updated_at = NOW()
      FROM fat
      WHERE ms.setor_id = fat.setor_id
        AND ms.data = fat.data
        AND ms.filial_id = fat.filial_id
        AND ms.data >= $1
        AND ms.data <= $2
    $sql$,
    p_schema,
    p_schema,
    p_schema,
    p_schema
  )
  USING v_data_inicio, v_data_fim, p_schema;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'mode', 'faturamento',
    'base_result', v_base_result,
    'rows_updated_with_faturamento', v_rows_updated
  );
END;
$$;
