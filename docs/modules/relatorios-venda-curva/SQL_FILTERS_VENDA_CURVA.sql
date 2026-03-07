-- Atualiza as RPCs de Vendas por Curva para suportar:
-- - filtro por departamentos (nível 1)
-- - filtro por setores
-- - filtro por produto (código/descrição)

CREATE OR REPLACE FUNCTION public.get_venda_curva_report_fast(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date,
  p_departamento_ids bigint[] DEFAULT NULL::bigint[],
  p_setor_ids bigint[] DEFAULT NULL::bigint[],
  p_busca text DEFAULT NULL::text
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text,
  qtde_ano_anterior numeric,
  valor_vendas_ano_anterior numeric,
  valor_lucro_ano_anterior numeric,
  percentual_lucro_ano_anterior numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_offset integer;
  v_data_inicio date;
  v_data_fim date;
  v_prev_inicio date;
  v_prev_fim date;
  v_prev_sql text;
BEGIN
  PERFORM set_config('statement_timeout', '10min', true);
  PERFORM set_config('work_mem', '256MB', true);

  v_offset := (p_page - 1) * p_page_size;
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := coalesce(p_data_fim_override, (v_data_inicio + interval '1 month')::date);
  v_prev_inicio := make_date(p_ano - 1, p_mes, 1);
  v_prev_fim := (v_prev_inicio + interval '1 month')::date;

  IF p_data_fim_override IS NOT NULL THEN
    v_prev_fim := (p_data_fim_override - interval '1 year')::date;
    v_prev_sql := '
      SELECT
        v.id_produto,
        v.filial_id,
        SUM(v.quantidade) as total_qtde,
        SUM(v.valor_vendas) as total_valor_vendas,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
      FROM %I.vendas v
      WHERE v.data_venda >= $7
        AND v.data_venda < $6
        AND v.valor_vendas > 0
        AND ($3 IS NULL OR v.filial_id = ANY($3))
      GROUP BY v.id_produto, v.filial_id
    ';
  ELSE
    v_prev_sql := '
      SELECT
        vmp.id_produto,
        vmp.filial_id,
        vmp.total_qtde,
        vmp.total_valor_vendas,
        vmp.total_lucro
      FROM %I.vendas_mensal_produto vmp
      WHERE vmp.ano = $1 - 1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
    ';
  END IF;

  RETURN QUERY EXECUTE format('
    WITH base_atual AS (
      SELECT
        vmp.id_produto,
        vmp.filial_id,
        vmp.total_qtde,
        vmp.total_valor_vendas,
        vmp.total_lucro
      FROM %1$I.vendas_mensal_produto vmp
      WHERE vmp.ano = $1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
    ),
    base_prev AS (
      ' || format(v_prev_sql, p_schema) || '
    ),
    vendas_agregadas AS (
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        p.id as produto_id,
        p.descricao as produto_nome,
        b.filial_id,
        COALESCE(p.curva_abcd, ''D'') as curva_venda,
        COALESCE(p.curva_lucro, ''D'') as curva_lucro,
        b.total_qtde,
        b.total_valor_vendas,
        b.total_lucro,
        COALESCE(bp.total_qtde, 0) as total_qtde_prev,
        COALESCE(bp.total_valor_vendas, 0) as total_valor_vendas_prev,
        COALESCE(bp.total_lucro, 0) as total_lucro_prev
      FROM base_atual b
      INNER JOIN %1$I.produtos p
        ON p.id = b.id_produto
        AND p.filial_id = b.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      LEFT JOIN base_prev bp
        ON bp.id_produto = b.id_produto
        AND bp.filial_id = b.filial_id
      WHERE ($8 IS NULL OR d1.departamento_id = ANY($8))
        AND (
          $9 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($9)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $10 IS NULL
          OR p.id::text ILIKE $10
          OR p.descricao ILIKE $10
        )
    ),
    dept3_totais AS (
      SELECT
        dept3_nome,
        SUM(total_valor_vendas) as total_vendas
      FROM vendas_agregadas
      GROUP BY dept3_nome
      ORDER BY total_vendas DESC
      LIMIT $4 OFFSET $5
    )
    SELECT
      va.dept3_nome::text,
      va.dept2_nome::text,
      va.dept1_nome::text,
      va.produto_id,
      va.produto_nome::text,
      va.filial_id,
      ROUND(va.total_qtde::numeric, 2),
      ROUND(va.total_valor_vendas::numeric, 2),
      ROUND(va.total_lucro::numeric, 2),
      CASE
        WHEN va.total_valor_vendas > 0 THEN ROUND((va.total_lucro / va.total_valor_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      va.curva_venda::text,
      va.curva_lucro::text,
      ROUND(va.total_qtde_prev::numeric, 2),
      ROUND(va.total_valor_vendas_prev::numeric, 2),
      ROUND(va.total_lucro_prev::numeric, 2),
      CASE
        WHEN va.total_valor_vendas_prev > 0 THEN ROUND((va.total_lucro_prev / va.total_valor_vendas_prev) * 100, 2)
        ELSE 0
      END as percentual_lucro_ano_anterior
    FROM vendas_agregadas va
    INNER JOIN dept3_totais dt
      ON va.dept3_nome = dt.dept3_nome
    ORDER BY
      va.dept3_nome,
      va.dept2_nome,
      va.dept1_nome,
      CASE va.curva_venda
        WHEN ''A'' THEN 1
        WHEN ''B'' THEN 2
        WHEN ''C'' THEN 3
        WHEN ''D'' THEN 4
        ELSE 5
      END,
      va.total_valor_vendas DESC
  ', p_schema)
  USING p_ano, p_mes, p_filial_ids, p_page_size, v_offset, v_prev_fim, v_prev_inicio, p_departamento_ids, p_setor_ids, p_busca;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_venda_curva_totais(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date,
  p_departamento_ids bigint[] DEFAULT NULL::bigint[],
  p_setor_ids bigint[] DEFAULT NULL::bigint[],
  p_busca text DEFAULT NULL::text
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  total_qtde numeric,
  total_vendas numeric,
  total_lucro numeric,
  percentual_lucro numeric,
  total_qtde_ano_anterior numeric,
  total_vendas_ano_anterior numeric,
  total_lucro_ano_anterior numeric,
  percentual_lucro_ano_anterior numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_prev_inicio date;
  v_prev_fim date;
  v_prev_sql text;
BEGIN
  PERFORM set_config('statement_timeout', '15min', true);
  PERFORM set_config('work_mem', '256MB', true);

  v_offset := (p_page - 1) * p_page_size;
  v_prev_inicio := make_date(p_ano - 1, p_mes, 1);
  v_prev_fim := (v_prev_inicio + interval '1 month')::date;

  IF p_data_fim_override IS NOT NULL THEN
    v_prev_fim := (p_data_fim_override - interval '1 year')::date;
    v_prev_sql := '
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        SUM(v.quantidade) as total_qtde,
        SUM(v.valor_vendas) as total_valor_vendas,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
      FROM %1$I.vendas v
      INNER JOIN %1$I.produtos p
        ON p.id = v.id_produto
        AND p.filial_id = v.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      WHERE v.data_venda >= $7::date
        AND v.data_venda < $6::date
        AND v.valor_vendas > 0
        AND ($3 IS NULL OR v.filial_id = ANY($3))
        AND ($8 IS NULL OR d1.departamento_id = ANY($8))
        AND (
          $9 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($9)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $10 IS NULL
          OR p.id::text ILIKE $10
          OR p.descricao ILIKE $10
        )
      GROUP BY 1,2,3
    ';
  ELSE
    v_prev_sql := '
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        SUM(vmp.total_qtde) as total_qtde,
        SUM(vmp.total_valor_vendas) as total_valor_vendas,
        SUM(vmp.total_lucro) as total_lucro
      FROM %1$I.vendas_mensal_produto vmp
      INNER JOIN %1$I.produtos p
        ON p.id = vmp.id_produto
        AND p.filial_id = vmp.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      WHERE vmp.ano = $1 - 1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
        AND ($8 IS NULL OR d1.departamento_id = ANY($8))
        AND (
          $9 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($9)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $10 IS NULL
          OR p.id::text ILIKE $10
          OR p.descricao ILIKE $10
        )
      GROUP BY 1,2,3
    ';
  END IF;

  RETURN QUERY EXECUTE format('
    WITH base_atual AS (
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        SUM(vmp.total_qtde) as total_qtde,
        SUM(vmp.total_valor_vendas) as total_valor_vendas,
        SUM(vmp.total_lucro) as total_lucro
      FROM %1$I.vendas_mensal_produto vmp
      INNER JOIN %1$I.produtos p
        ON p.id = vmp.id_produto
        AND p.filial_id = vmp.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      WHERE vmp.ano = $1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
        AND ($8 IS NULL OR d1.departamento_id = ANY($8))
        AND (
          $9 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($9)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $10 IS NULL
          OR p.id::text ILIKE $10
          OR p.descricao ILIKE $10
        )
      GROUP BY 1,2,3
    ),
    base_prev AS (
      ' || format(v_prev_sql, p_schema) || '
    ),
    base_comparada AS (
      SELECT
        a.dept3_nome,
        a.dept2_nome,
        a.dept1_nome,
        a.total_qtde,
        a.total_valor_vendas as total_vendas,
        a.total_lucro,
        COALESCE(p.total_qtde, 0) as total_qtde_prev,
        COALESCE(p.total_valor_vendas, 0) as total_vendas_prev,
        COALESCE(p.total_lucro, 0) as total_lucro_prev
      FROM base_atual a
      LEFT JOIN base_prev p
        ON p.dept3_nome = a.dept3_nome
        AND p.dept2_nome = a.dept2_nome
        AND p.dept1_nome = a.dept1_nome
    ),
    dept3_totais AS (
      SELECT
        dept3_nome,
        SUM(total_vendas) as total_vendas
      FROM base_comparada
      GROUP BY dept3_nome
      ORDER BY total_vendas DESC
      LIMIT $4 OFFSET $5
    )
    SELECT
      b.dept3_nome::text,
      b.dept2_nome::text,
      b.dept1_nome::text,
      b.total_qtde::numeric,
      b.total_vendas::numeric,
      b.total_lucro::numeric,
      CASE
        WHEN b.total_vendas > 0 THEN ROUND((b.total_lucro / b.total_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      b.total_qtde_prev::numeric,
      b.total_vendas_prev::numeric,
      b.total_lucro_prev::numeric,
      CASE
        WHEN b.total_vendas_prev > 0 THEN ROUND((b.total_lucro_prev / b.total_vendas_prev) * 100, 2)
        ELSE 0
      END as percentual_lucro_ano_anterior
    FROM base_comparada b
    INNER JOIN dept3_totais dt
      ON b.dept3_nome = dt.dept3_nome
    ORDER BY
      b.dept3_nome,
      b.dept2_nome,
      b.dept1_nome
  ', p_schema)
  USING p_ano, p_mes, p_filial_ids, p_page_size, v_offset, v_prev_fim, v_prev_inicio, p_departamento_ids, p_setor_ids, p_busca;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_venda_curva_produtos(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_dept_nivel3 text DEFAULT NULL::text,
  p_dept_nivel2 text DEFAULT NULL::text,
  p_dept_nivel1 text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date,
  p_departamento_ids bigint[] DEFAULT NULL::bigint[],
  p_setor_ids bigint[] DEFAULT NULL::bigint[],
  p_search text DEFAULT NULL::text
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text,
  qtde_ano_anterior numeric,
  valor_vendas_ano_anterior numeric,
  valor_lucro_ano_anterior numeric,
  percentual_lucro_ano_anterior numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_prev_inicio date;
  v_prev_fim date;
  v_prev_sql text;
BEGIN
  PERFORM set_config('statement_timeout', '10min', true);
  PERFORM set_config('work_mem', '256MB', true);

  v_offset := (p_page - 1) * p_page_size;
  v_prev_inicio := make_date(p_ano - 1, p_mes, 1);
  v_prev_fim := (v_prev_inicio + interval '1 month')::date;

  IF p_data_fim_override IS NOT NULL THEN
    v_prev_fim := (p_data_fim_override - interval '1 year')::date;
    v_prev_sql := '
      SELECT
        v.id_produto,
        v.filial_id,
        SUM(v.quantidade) as total_qtde,
        SUM(v.valor_vendas) as total_valor_vendas,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
      FROM %I.vendas v
      WHERE v.data_venda >= $8
        AND v.data_venda < $7
        AND v.valor_vendas > 0
        AND ($3 IS NULL OR v.filial_id = ANY($3))
      GROUP BY v.id_produto, v.filial_id
    ';
  ELSE
    v_prev_sql := '
      SELECT
        vmp.id_produto,
        vmp.filial_id,
        vmp.total_qtde,
        vmp.total_valor_vendas,
        vmp.total_lucro
      FROM %I.vendas_mensal_produto vmp
      WHERE vmp.ano = $1 - 1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
    ';
  END IF;

  RETURN QUERY EXECUTE format('
    WITH base_atual AS (
      SELECT
        vmp.id_produto,
        vmp.filial_id,
        vmp.total_qtde,
        vmp.total_valor_vendas,
        vmp.total_lucro
      FROM %1$I.vendas_mensal_produto vmp
      WHERE vmp.ano = $1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
    ),
    base_prev AS (
      ' || format(v_prev_sql, p_schema) || '
    ),
    produtos AS (
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        p.id as produto_id,
        p.descricao as produto_nome,
        b.filial_id,
        COALESCE(p.curva_abcd, ''D'') as curva_venda,
        COALESCE(p.curva_lucro, ''D'') as curva_lucro,
        b.total_qtde,
        b.total_valor_vendas,
        b.total_lucro,
        COALESCE(bp.total_qtde, 0) as total_qtde_prev,
        COALESCE(bp.total_valor_vendas, 0) as total_valor_vendas_prev,
        COALESCE(bp.total_lucro, 0) as total_lucro_prev
      FROM base_atual b
      INNER JOIN %1$I.produtos p
        ON p.id = b.id_produto
        AND p.filial_id = b.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      LEFT JOIN base_prev bp
        ON bp.id_produto = b.id_produto
        AND bp.filial_id = b.filial_id
      WHERE ($4 IS NULL OR COALESCE(d3.descricao, ''Sem Nível 3'') = $4)
        AND ($5 IS NULL OR COALESCE(d2.descricao, ''Sem Nível 2'') = $5)
        AND ($6 IS NULL OR d1.descricao = $6)
        AND ($9 IS NULL OR d1.departamento_id = ANY($9))
        AND (
          $10 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($10)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $11 IS NULL
          OR p.id::text ILIKE $11
          OR p.descricao ILIKE $11
        )
    )
    SELECT
      pr.dept3_nome::text,
      pr.dept2_nome::text,
      pr.dept1_nome::text,
      pr.produto_id,
      pr.produto_nome::text,
      pr.filial_id,
      ROUND(pr.total_qtde::numeric, 2),
      ROUND(pr.total_valor_vendas::numeric, 2),
      ROUND(pr.total_lucro::numeric, 2),
      CASE
        WHEN pr.total_valor_vendas > 0 THEN ROUND((pr.total_lucro / pr.total_valor_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      pr.curva_venda::text,
      pr.curva_lucro::text,
      ROUND(pr.total_qtde_prev::numeric, 2),
      ROUND(pr.total_valor_vendas_prev::numeric, 2),
      ROUND(pr.total_lucro_prev::numeric, 2),
      CASE
        WHEN pr.total_valor_vendas_prev > 0 THEN ROUND((pr.total_lucro_prev / pr.total_valor_vendas_prev) * 100, 2)
        ELSE 0
      END as percentual_lucro_ano_anterior
    FROM produtos pr
    ORDER BY
      pr.dept3_nome,
      pr.dept2_nome,
      pr.dept1_nome,
      CASE pr.curva_venda
        WHEN ''A'' THEN 1
        WHEN ''B'' THEN 2
        WHEN ''C'' THEN 3
        WHEN ''D'' THEN 4
        ELSE 5
      END,
      pr.total_valor_vendas DESC
    LIMIT $12 OFFSET $13
  ', p_schema)
  USING p_ano, p_mes, p_filial_ids, p_dept_nivel3, p_dept_nivel2, p_dept_nivel1, v_prev_fim, v_prev_inicio, p_departamento_ids, p_setor_ids, p_search, p_page_size, v_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_venda_curva_report_v3(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date,
  p_departamento_ids bigint[] DEFAULT NULL::bigint[],
  p_setor_ids bigint[] DEFAULT NULL::bigint[],
  p_busca text DEFAULT NULL::text
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset integer;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  PERFORM set_config('statement_timeout', '10min', true);
  PERFORM set_config('work_mem', '256MB', true);

  v_offset := (p_page - 1) * p_page_size;
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := coalesce(p_data_fim_override, (v_data_inicio + interval '1 month')::date);

  RETURN QUERY EXECUTE format('
    WITH vendas_base AS (
      SELECT
        v.id_produto,
        v.filial_id,
        SUM(v.quantidade) as total_qtde,
        SUM(v.valor_vendas) as total_valor_vendas,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
      FROM %1$I.vendas v
      WHERE v.data_venda >= $1
        AND v.data_venda < $2
        AND v.valor_vendas > 0
        AND ($3 IS NULL OR v.filial_id = ANY($3))
      GROUP BY v.id_produto, v.filial_id
    ),
    vendas_agregadas AS (
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        p.id as produto_id,
        p.descricao as produto_nome,
        vb.filial_id,
        COALESCE(p.curva_abcd, ''D'') as curva_venda,
        COALESCE(p.curva_lucro, ''D'') as curva_lucro,
        vb.total_qtde,
        vb.total_valor_vendas,
        vb.total_lucro
      FROM vendas_base vb
      INNER JOIN %1$I.produtos p
        ON p.id = vb.id_produto
        AND p.filial_id = vb.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      WHERE ($6 IS NULL OR d1.departamento_id = ANY($6))
        AND (
          $7 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($7)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $8 IS NULL
          OR p.id::text ILIKE $8
          OR p.descricao ILIKE $8
        )
    ),
    dept3_totais AS (
      SELECT
        dept3_nome,
        SUM(total_valor_vendas) as total_vendas
      FROM vendas_agregadas
      GROUP BY dept3_nome
      ORDER BY total_vendas DESC
      LIMIT $4 OFFSET $5
    )
    SELECT
      va.dept3_nome::text,
      va.dept2_nome::text,
      va.dept1_nome::text,
      va.produto_id,
      va.produto_nome::text,
      va.filial_id,
      ROUND(va.total_qtde::numeric, 2),
      ROUND(va.total_valor_vendas::numeric, 2),
      ROUND(va.total_lucro::numeric, 2),
      CASE
        WHEN va.total_valor_vendas > 0 THEN ROUND((va.total_lucro / va.total_valor_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      va.curva_venda::text,
      va.curva_lucro::text
    FROM vendas_agregadas va
    INNER JOIN dept3_totais dt
      ON va.dept3_nome = dt.dept3_nome
    ORDER BY
      va.dept3_nome,
      va.dept2_nome,
      va.dept1_nome,
      CASE va.curva_venda
        WHEN ''A'' THEN 1
        WHEN ''B'' THEN 2
        WHEN ''C'' THEN 3
        WHEN ''D'' THEN 4
        ELSE 5
      END,
      va.total_valor_vendas DESC
  ', p_schema)
  USING v_data_inicio, v_data_fim, p_filial_ids, p_page_size, v_offset, p_departamento_ids, p_setor_ids, p_busca;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_venda_curva_report_v2(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date,
  p_departamento_ids bigint[] DEFAULT NULL::bigint[],
  p_setor_ids bigint[] DEFAULT NULL::bigint[],
  p_busca text DEFAULT NULL::text
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset integer;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := coalesce(p_data_fim_override, (v_data_inicio + interval '1 month')::date);

  RETURN QUERY EXECUTE format('
    WITH vendas_agregadas AS (
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        p.id as produto_id,
        p.descricao as produto_nome,
        v.filial_id,
        COALESCE(p.curva_abcd, ''D'') as curva_venda,
        COALESCE(p.curva_lucro, ''D'') as curva_lucro,
        SUM(v.quantidade) as total_qtde,
        SUM(v.valor_vendas) as total_valor_vendas,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
      FROM %1$I.vendas v
      INNER JOIN %1$I.produtos p
        ON p.id = v.id_produto
        AND p.filial_id = v.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      WHERE v.data_venda >= $1
        AND v.data_venda < $2
        AND v.valor_vendas > 0
        AND ($3 IS NULL OR v.filial_id = ANY($3))
        AND ($6 IS NULL OR d1.departamento_id = ANY($6))
        AND (
          $7 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($7)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $8 IS NULL
          OR p.id::text ILIKE $8
          OR p.descricao ILIKE $8
        )
      GROUP BY
        d3.descricao,
        d2.descricao,
        d1.descricao,
        p.id,
        p.descricao,
        v.filial_id,
        p.curva_abcd,
        p.curva_lucro
    ),
    dept3_totais AS (
      SELECT
        dept3_nome,
        SUM(total_valor_vendas) as total_vendas
      FROM vendas_agregadas
      GROUP BY dept3_nome
      ORDER BY total_vendas DESC
      LIMIT $4 OFFSET $5
    )
    SELECT
      va.dept3_nome::text,
      va.dept2_nome::text,
      va.dept1_nome::text,
      va.produto_id,
      va.produto_nome::text,
      va.filial_id,
      ROUND(va.total_qtde::numeric, 2),
      ROUND(va.total_valor_vendas::numeric, 2),
      ROUND(va.total_lucro::numeric, 2),
      CASE
        WHEN va.total_valor_vendas > 0 THEN ROUND((va.total_lucro / va.total_valor_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      va.curva_venda::text,
      va.curva_lucro::text
    FROM vendas_agregadas va
    INNER JOIN dept3_totais dt
      ON va.dept3_nome = dt.dept3_nome
    ORDER BY
      va.dept3_nome,
      va.dept2_nome,
      va.dept1_nome,
      CASE va.curva_venda
        WHEN ''A'' THEN 1
        WHEN ''B'' THEN 2
        WHEN ''C'' THEN 3
        WHEN ''D'' THEN 4
        ELSE 5
      END,
      va.total_valor_vendas DESC
  ', p_schema)
  USING v_data_inicio, v_data_fim, p_filial_ids, p_page_size, v_offset, p_departamento_ids, p_setor_ids, p_busca;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_venda_curva_report(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id bigint DEFAULT NULL::bigint,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date,
  p_departamento_ids bigint[] DEFAULT NULL::bigint[],
  p_setor_ids bigint[] DEFAULT NULL::bigint[],
  p_busca text DEFAULT NULL::text
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset integer;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := coalesce(p_data_fim_override, (v_data_inicio + interval '1 month')::date);

  RETURN QUERY EXECUTE format('
    WITH vendas_agregadas AS (
      SELECT
        COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
        COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
        d1.descricao as dept1_nome,
        p.id as produto_id,
        p.descricao as produto_nome,
        v.filial_id,
        COALESCE(p.curva_abcd, ''D'') as curva_venda,
        COALESCE(p.curva_lucro, ''D'') as curva_lucro,
        SUM(v.quantidade) as total_qtde,
        SUM(v.valor_vendas) as total_valor_vendas,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
      FROM %1$I.vendas v
      INNER JOIN %1$I.produtos p
        ON p.id = v.id_produto
        AND p.filial_id = v.filial_id
        AND p.ativo = true
      INNER JOIN %1$I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %1$I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %1$I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      WHERE v.data_venda >= $1
        AND v.data_venda < $2
        AND v.valor_vendas > 0
        AND ($3 IS NULL OR v.filial_id = $3)
        AND ($6 IS NULL OR d1.departamento_id = ANY($6))
        AND (
          $7 IS NULL
          OR EXISTS (
            SELECT 1
            FROM %1$I.setores s
            WHERE s.ativo = true
              AND s.id = ANY($7)
              AND (
                (s.departamento_nivel = 1 AND d1.departamento_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 2 AND d1.pai_level_2_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 3 AND d1.pai_level_3_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 4 AND d1.pai_level_4_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 5 AND d1.pai_level_5_id = ANY(s.departamento_ids))
                OR (s.departamento_nivel = 6 AND d1.pai_level_6_id = ANY(s.departamento_ids))
              )
          )
        )
        AND (
          $8 IS NULL
          OR p.id::text ILIKE $8
          OR p.descricao ILIKE $8
        )
      GROUP BY
        d3.descricao,
        d2.descricao,
        d1.descricao,
        p.id,
        p.descricao,
        v.filial_id,
        p.curva_abcd,
        p.curva_lucro
    ),
    dept3_totais AS (
      SELECT
        dept3_nome,
        SUM(total_valor_vendas) as total_vendas
      FROM vendas_agregadas
      GROUP BY dept3_nome
      ORDER BY total_vendas DESC
      LIMIT $4 OFFSET $5
    )
    SELECT
      va.dept3_nome::text,
      va.dept2_nome::text,
      va.dept1_nome::text,
      va.produto_id,
      va.produto_nome::text,
      va.filial_id,
      ROUND(va.total_qtde::numeric, 2),
      ROUND(va.total_valor_vendas::numeric, 2),
      ROUND(va.total_lucro::numeric, 2),
      CASE
        WHEN va.total_valor_vendas > 0 THEN ROUND((va.total_lucro / va.total_valor_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      va.curva_venda::text,
      va.curva_lucro::text
    FROM vendas_agregadas va
    INNER JOIN dept3_totais dt
      ON va.dept3_nome = dt.dept3_nome
    ORDER BY
      va.dept3_nome,
      va.dept2_nome,
      va.dept1_nome,
      CASE va.curva_venda
        WHEN ''A'' THEN 1
        WHEN ''B'' THEN 2
        WHEN ''C'' THEN 3
        WHEN ''D'' THEN 4
        ELSE 5
      END,
      va.total_valor_vendas DESC
  ', p_schema)
  USING v_data_inicio, v_data_fim, p_filial_id, p_page_size, v_offset, p_departamento_ids, p_setor_ids, p_busca;
END;
$function$;
