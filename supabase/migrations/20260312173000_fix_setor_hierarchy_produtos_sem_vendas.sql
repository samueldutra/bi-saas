-- =========================================================
-- Corrige atribuicao de setor por hierarquia real de departamentos
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_produtos_sem_vendas_live(
  p_schema text,
  p_filiais text DEFAULT 'all'::text,
  p_dias_sem_vendas_min integer DEFAULT 15,
  p_dias_sem_vendas_max integer DEFAULT 90,
  p_data_referencia date DEFAULT CURRENT_DATE,
  p_curva_abc text DEFAULT 'all'::text,
  p_filtro_tipo text DEFAULT 'all'::text,
  p_departamento_ids text DEFAULT NULL::text,
  p_produto_ids text DEFAULT NULL::text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  filial_id bigint,
  produto_id bigint,
  descricao text,
  departamento_id bigint,
  departamento_nome text,
  setor_id bigint,
  setor_nome text,
  estoque_atual numeric,
  data_ultima_venda date,
  data_ultima_entrada date,
  preco_custo numeric,
  curva_abcd text,
  curva_lucro character varying,
  dias_sem_venda integer,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '25s'
AS $function$
DECLARE
  v_data_limite_min date;
  v_data_limite_max date;
  v_query text;
  v_filiais_arr bigint[];
  v_departamentos_arr bigint[];
  v_produtos_arr bigint[];
  v_filter_condition text := '';
  v_is_all_case boolean := false;
BEGIN
  v_data_limite_min := p_data_referencia - p_dias_sem_vendas_max;
  v_data_limite_max := p_data_referencia - p_dias_sem_vendas_min;

  IF p_filiais IS NULL OR p_filiais = '' OR p_filiais = 'all' THEN
    v_filiais_arr := NULL;
  ELSE
    v_filiais_arr := string_to_array(replace(p_filiais, ' ', ''), ',')::bigint[];
  END IF;

  IF p_departamento_ids IS NULL OR p_departamento_ids = '' THEN
    v_departamentos_arr := NULL;
  ELSE
    v_departamentos_arr := string_to_array(replace(p_departamento_ids, ' ', ''), ',')::bigint[];
  END IF;

  IF p_produto_ids IS NULL OR p_produto_ids = '' THEN
    v_produtos_arr := NULL;
  ELSE
    v_produtos_arr := string_to_array(replace(p_produto_ids, ' ', ''), ',')::bigint[];
  END IF;

  IF p_filtro_tipo = 'departamento' THEN
    IF COALESCE(array_length(v_departamentos_arr, 1), 0) = 0 THEN
      RETURN;
    END IF;
    v_filter_condition := ' AND p.departamento_id = ANY($4)';
  ELSIF p_filtro_tipo = 'setor' THEN
    IF COALESCE(array_length(v_departamentos_arr, 1), 0) = 0 THEN
      RETURN;
    END IF;
    v_filter_condition := ' AND p.departamento_id IN (SELECT sd.departamento_id FROM setores_departamentos sd)';
  ELSIF p_filtro_tipo = 'produto' THEN
    IF COALESCE(array_length(v_produtos_arr, 1), 0) = 0 THEN
      RETURN;
    END IF;
    v_filter_condition := ' AND p.id = ANY($5)';
  ELSE
    v_is_all_case := true;
  END IF;

  IF v_is_all_case THEN
    v_query := format('
      WITH
      departamento_ref AS (
        SELECT d1.departamento_id::bigint AS departamento_id, d1.descricao::text AS departamento_nome
        FROM %1$I.departments_level_1 d1
      ),
      setor_default_por_departamento AS (
        SELECT DISTINCT ON (dep_id)
          dep_id::bigint AS departamento_id,
          s.id::bigint AS setor_id,
          s.nome::text AS setor_nome
        FROM %1$I.setores s
        CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
        WHERE s.ativo = true
        ORDER BY dep_id, s.id
      ),
      produtos_base AS (
        SELECT
          p.id,
          p.filial_id,
          p.descricao,
          p.departamento_id,
          p.estoque_atual,
          p.preco_de_custo,
          p.curva_abcd,
          p.curva_lucro
        FROM %1$I.produtos p
        WHERE p.ativo = true
          AND p.estoque_atual > 0
          AND ($1 IS NULL OR p.filial_id = ANY($1))
          AND ($2 = ''all'' OR p.curva_abcd = $2)
      ),
      vendas_no_periodo AS (
        SELECT
          v.filial_id,
          v.id_produto AS produto_id,
          MAX(v.data_venda)::date AS data_ultima_venda
        FROM %1$I.vendas v
        WHERE ($1 IS NULL OR v.filial_id = ANY($1))
          AND v.data_venda >= $6
          AND v.data_venda <= $11
        GROUP BY v.filial_id, v.id_produto
      ),
      vendas_hoje_no_periodo AS (
        SELECT
          vhi.filial_id,
          vhi.produto_id,
          MAX(vhi.data_extracao)::date AS data_ultima_venda
        FROM %1$I.vendas_hoje_itens vhi
        WHERE ($1 IS NULL OR vhi.filial_id = ANY($1))
          AND vhi.cancelado = false
          AND vhi.data_extracao >= $6
          AND vhi.data_extracao <= $11
        GROUP BY vhi.filial_id, vhi.produto_id
      ),
      todas_ultimas_vendas AS (
        SELECT
          uv.filial_id,
          uv.produto_id,
          MAX(uv.data_ultima_venda)::date AS data_ultima_venda
        FROM (
          SELECT vh.filial_id, vh.produto_id, vh.data_ultima_venda FROM vendas_no_periodo vh
          UNION ALL
          SELECT vho.filial_id, vho.produto_id, vho.data_ultima_venda FROM vendas_hoje_no_periodo vho
        ) uv
        GROUP BY uv.filial_id, uv.produto_id
      ),
      produtos_filtrados AS (
        SELECT
          p.filial_id::bigint AS filial_id,
          p.id::bigint AS produto_id,
          p.descricao::text AS descricao,
          p.departamento_id::bigint AS departamento_id,
          dr.departamento_nome::text AS departamento_nome,
          sdpd.setor_id::bigint AS setor_id,
          sdpd.setor_nome::text AS setor_nome,
          p.estoque_atual::numeric(18,6) AS estoque_atual,
          tuv.data_ultima_venda::date AS data_ultima_venda,
          p.preco_de_custo::numeric(15,5) AS preco_custo,
          p.curva_abcd::text AS curva_abcd,
          p.curva_lucro::varchar(2) AS curva_lucro,
          ($11 - tuv.data_ultima_venda)::integer AS dias_sem_venda,
          COUNT(*) OVER()::bigint AS total_count
        FROM produtos_base p
        INNER JOIN todas_ultimas_vendas tuv
          ON tuv.produto_id = p.id
         AND tuv.filial_id = p.filial_id
        LEFT JOIN departamento_ref dr
          ON dr.departamento_id = p.departamento_id
        LEFT JOIN setor_default_por_departamento sdpd
          ON sdpd.departamento_id = p.departamento_id
        WHERE tuv.data_ultima_venda >= $6
          AND tuv.data_ultima_venda <= $7
      ),
      produtos_paginados AS (
        SELECT *
        FROM produtos_filtrados
        ORDER BY dias_sem_venda DESC NULLS LAST, produto_id
        LIMIT $9
        OFFSET $10
      )
      SELECT
        pp.filial_id,
        pp.produto_id,
        pp.descricao,
        pp.departamento_id,
        pp.departamento_nome,
        pp.setor_id,
        pp.setor_nome,
        pp.estoque_atual,
        pp.data_ultima_venda,
        ue.data_ultima_entrada::date AS data_ultima_entrada,
        pp.preco_custo,
        pp.curva_abcd,
        pp.curva_lucro,
        pp.dias_sem_venda,
        pp.total_count
      FROM produtos_paginados pp
      LEFT JOIN LATERAL (
        SELECT e.data_entrada AS data_ultima_entrada
        FROM %1$I.entradas_produtos ep
        INNER JOIN %1$I.entradas e
          ON e.id = ep.entrada_id
        WHERE ep.produto_id = pp.produto_id
          AND e.filial_id = pp.filial_id
        ORDER BY e.data_entrada DESC, e.id DESC
        LIMIT 1
      ) ue ON true
      ORDER BY pp.dias_sem_venda DESC NULLS LAST, pp.produto_id
    ', p_schema, p_schema);
  ELSE
    v_query := format('
      WITH
      setores_departamentos AS (
        SELECT DISTINCT dep_id::bigint AS departamento_id
        FROM %1$I.setores s
        CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
        WHERE s.ativo = true
          AND s.id = ANY($4)
      ),
      departamento_ref AS (
        SELECT d1.departamento_id::bigint AS departamento_id, d1.descricao::text AS departamento_nome
        FROM %1$I.departments_level_1 d1
      ),
      setor_default_por_departamento AS (
        SELECT DISTINCT ON (dep_id)
          dep_id::bigint AS departamento_id,
          s.id::bigint AS setor_id,
          s.nome::text AS setor_nome
        FROM %1$I.setores s
        CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
        WHERE s.ativo = true
        ORDER BY dep_id, s.id
      ),
      setor_selecionado_por_departamento AS (
        SELECT DISTINCT ON (dep_id)
          dep_id::bigint AS departamento_id,
          s.id::bigint AS setor_id,
          s.nome::text AS setor_nome
        FROM %1$I.setores s
        CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
        WHERE s.ativo = true
          AND s.id = ANY($4)
        ORDER BY dep_id, s.id
      ),
      produtos_base AS (
        SELECT
          p.id,
          p.filial_id,
          p.descricao,
          p.departamento_id,
          p.estoque_atual,
          p.preco_de_custo,
          p.curva_abcd,
          p.curva_lucro
        FROM %1$I.produtos p
        WHERE p.ativo = true
          AND p.estoque_atual > 0
          AND ($1 IS NULL OR p.filial_id = ANY($1))
          AND ($2 = ''all'' OR p.curva_abcd = $2)
          %3$s
      ),
      produtos_classificados AS (
        SELECT
          p.filial_id::bigint AS filial_id,
          p.id::bigint AS produto_id,
          p.descricao::text AS descricao,
          p.departamento_id::bigint AS departamento_id,
          dr.departamento_nome::text AS departamento_nome,
          COALESCE(sspd.setor_id, sdpd.setor_id)::bigint AS setor_id,
          COALESCE(sspd.setor_nome, sdpd.setor_nome)::text AS setor_nome,
          p.estoque_atual::numeric(18,6) AS estoque_atual,
          CASE
            WHEN vh.data_ultima_venda IS NULL AND vho.data_ultima_venda IS NULL THEN NULL
            ELSE GREATEST(
              COALESCE(vh.data_ultima_venda, ''1900-01-01''::date),
              COALESCE(vho.data_ultima_venda, ''1900-01-01''::date)
            )::date
          END AS data_ultima_venda,
          p.preco_de_custo::numeric(15,5) AS preco_custo,
          p.curva_abcd::text AS curva_abcd,
          p.curva_lucro::varchar(2) AS curva_lucro
        FROM produtos_base p
        LEFT JOIN departamento_ref dr
          ON dr.departamento_id = p.departamento_id
        LEFT JOIN setor_default_por_departamento sdpd
          ON $3 <> ''setor''
         AND sdpd.departamento_id = p.departamento_id
        LEFT JOIN setor_selecionado_por_departamento sspd
          ON $3 = ''setor''
         AND sspd.departamento_id = p.departamento_id
        LEFT JOIN LATERAL (
          SELECT v.data_venda::date AS data_ultima_venda
          FROM %1$I.vendas v
          WHERE v.id_produto = p.id
            AND v.filial_id = p.filial_id
          ORDER BY v.data_venda DESC
          LIMIT 1
        ) vh ON true
        LEFT JOIN LATERAL (
          SELECT vhi.data_extracao::date AS data_ultima_venda
          FROM %1$I.vendas_hoje_itens vhi
          WHERE vhi.produto_id = p.id
            AND vhi.filial_id = p.filial_id
            AND vhi.cancelado = false
          ORDER BY vhi.data_extracao DESC
          LIMIT 1
        ) vho ON true
      ),
      produtos_filtrados AS (
        SELECT
          pc.*,
          ($11 - pc.data_ultima_venda)::integer AS dias_sem_venda,
          COUNT(*) OVER()::bigint AS total_count
        FROM produtos_classificados pc
        WHERE pc.data_ultima_venda >= $6
          AND pc.data_ultima_venda <= $7
      ),
      produtos_paginados AS (
        SELECT *
        FROM produtos_filtrados
        ORDER BY dias_sem_venda DESC NULLS LAST, produto_id
        LIMIT $9
        OFFSET $10
      )
      SELECT
        pp.filial_id,
        pp.produto_id,
        pp.descricao,
        pp.departamento_id,
        pp.departamento_nome,
        pp.setor_id,
        pp.setor_nome,
        pp.estoque_atual,
        pp.data_ultima_venda,
        ue.data_ultima_entrada::date AS data_ultima_entrada,
        pp.preco_custo,
        pp.curva_abcd,
        pp.curva_lucro,
        pp.dias_sem_venda,
        pp.total_count
      FROM produtos_paginados pp
      LEFT JOIN LATERAL (
        SELECT e.data_entrada AS data_ultima_entrada
        FROM %1$I.entradas_produtos ep
        INNER JOIN %1$I.entradas e
          ON e.id = ep.entrada_id
        WHERE ep.produto_id = pp.produto_id
          AND e.filial_id = pp.filial_id
        ORDER BY e.data_entrada DESC, e.id DESC
        LIMIT 1
      ) ue ON true
      ORDER BY pp.dias_sem_venda DESC NULLS LAST, pp.produto_id
    ', p_schema, p_schema, v_filter_condition);
  END IF;

  RETURN QUERY EXECUTE v_query
    USING
      v_filiais_arr,
      p_curva_abc,
      p_filtro_tipo,
      v_departamentos_arr,
      v_produtos_arr,
      v_data_limite_min,
      v_data_limite_max,
      NULL,
      p_limit,
      p_offset,
      p_data_referencia;

EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Query muito lenta. Por favor: 1) Selecione UMA filial específica, 2) Aguarde criação de índices';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_produtos_sem_vendas(
  p_schema text,
  p_filiais text DEFAULT 'all'::text,
  p_dias_sem_vendas_min integer DEFAULT 15,
  p_dias_sem_vendas_max integer DEFAULT 90,
  p_data_referencia date DEFAULT CURRENT_DATE,
  p_curva_abc text DEFAULT 'all'::text,
  p_filtro_tipo text DEFAULT 'all'::text,
  p_departamento_ids text DEFAULT NULL::text,
  p_produto_ids text DEFAULT NULL::text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  filial_id bigint,
  produto_id bigint,
  descricao text,
  departamento_id bigint,
  departamento_nome text,
  setor_id bigint,
  setor_nome text,
  estoque_atual numeric,
  data_ultima_venda date,
  data_ultima_entrada date,
  preco_custo numeric,
  curva_abcd text,
  curva_lucro character varying,
  dias_sem_venda integer,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '25s'
AS $function$
DECLARE
  v_data_limite_min date;
  v_data_limite_max date;
  v_query text;
  v_filiais_arr bigint[];
  v_departamentos_arr bigint[];
  v_produtos_arr bigint[];
  v_filter_condition text := '';
  v_cache_exists boolean := false;
BEGIN
  v_data_limite_min := p_data_referencia - p_dias_sem_vendas_max;
  v_data_limite_max := p_data_referencia - p_dias_sem_vendas_min;

  IF p_filiais IS NULL OR p_filiais = '' OR p_filiais = 'all' THEN
    v_filiais_arr := NULL;
  ELSE
    v_filiais_arr := string_to_array(replace(p_filiais, ' ', ''), ',')::bigint[];
  END IF;

  IF p_departamento_ids IS NULL OR p_departamento_ids = '' THEN
    v_departamentos_arr := NULL;
  ELSE
    v_departamentos_arr := string_to_array(replace(p_departamento_ids, ' ', ''), ',')::bigint[];
  END IF;

  IF p_produto_ids IS NULL OR p_produto_ids = '' THEN
    v_produtos_arr := NULL;
  ELSE
    v_produtos_arr := string_to_array(replace(p_produto_ids, ' ', ''), ',')::bigint[];
  END IF;

  SELECT to_regclass(format('%I.ultima_venda_produto_filial', p_schema)) IS NOT NULL
  INTO v_cache_exists;

  IF NOT v_cache_exists THEN
    RETURN QUERY
    SELECT *
    FROM public.get_produtos_sem_vendas_live(
      p_schema,
      p_filiais,
      p_dias_sem_vendas_min,
      p_dias_sem_vendas_max,
      p_data_referencia,
      p_curva_abc,
      p_filtro_tipo,
      p_departamento_ids,
      p_produto_ids,
      p_limit,
      p_offset
    );
    RETURN;
  END IF;

  IF p_filtro_tipo = 'departamento' THEN
    IF COALESCE(array_length(v_departamentos_arr, 1), 0) = 0 THEN
      RETURN;
    END IF;
    v_filter_condition := ' AND p.departamento_id = ANY($4)';
  ELSIF p_filtro_tipo = 'setor' THEN
    IF COALESCE(array_length(v_departamentos_arr, 1), 0) = 0 THEN
      RETURN;
    END IF;
    v_filter_condition := ' AND p.departamento_id IN (SELECT sd.departamento_id FROM setores_departamentos sd)';
  ELSIF p_filtro_tipo = 'produto' THEN
    IF COALESCE(array_length(v_produtos_arr, 1), 0) = 0 THEN
      RETURN;
    END IF;
    v_filter_condition := ' AND p.id = ANY($5)';
  END IF;

  v_query := format('
    WITH
    setores_departamentos AS (
      SELECT DISTINCT dep_id::bigint AS departamento_id
      FROM %1$I.setores s
      CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
      WHERE s.ativo = true
        AND s.id = ANY($4)
    ),
    departamento_ref AS (
      SELECT d1.departamento_id::bigint AS departamento_id, d1.descricao::text AS departamento_nome
      FROM %1$I.departments_level_1 d1
    ),
    setor_default_por_departamento AS (
      SELECT DISTINCT ON (dep_id)
        dep_id::bigint AS departamento_id,
        s.id::bigint AS setor_id,
        s.nome::text AS setor_nome
      FROM %1$I.setores s
      CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
      WHERE s.ativo = true
      ORDER BY dep_id, s.id
    ),
    setor_selecionado_por_departamento AS (
      SELECT DISTINCT ON (dep_id)
        dep_id::bigint AS departamento_id,
        s.id::bigint AS setor_id,
        s.nome::text AS setor_nome
      FROM %1$I.setores s
      CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples(%2$L, s.departamento_nivel, s.departamento_ids)) dep_id
      WHERE s.ativo = true
        AND s.id = ANY($4)
      ORDER BY dep_id, s.id
    ),
    produtos_base AS (
      SELECT
        p.id,
        p.filial_id,
        p.descricao,
        p.departamento_id,
        p.estoque_atual,
        p.preco_de_custo,
        p.curva_abcd,
        p.curva_lucro
      FROM %1$I.produtos p
      WHERE p.ativo = true
        AND p.estoque_atual > 0
        AND ($1 IS NULL OR p.filial_id = ANY($1))
        AND ($2 = ''all'' OR p.curva_abcd = $2)
        %3$s
    ),
    produtos_filtrados AS (
      SELECT
        p.filial_id::bigint AS filial_id,
        p.id::bigint AS produto_id,
        p.descricao::text AS descricao,
        p.departamento_id::bigint AS departamento_id,
        dr.departamento_nome::text AS departamento_nome,
        COALESCE(sspd.setor_id, sdpd.setor_id)::bigint AS setor_id,
        COALESCE(sspd.setor_nome, sdpd.setor_nome)::text AS setor_nome,
        p.estoque_atual::numeric(18,6) AS estoque_atual,
        c.data_ultima_venda::date AS data_ultima_venda,
        c.data_ultima_entrada::date AS data_ultima_entrada,
        p.preco_de_custo::numeric(15,5) AS preco_custo,
        p.curva_abcd::text AS curva_abcd,
        p.curva_lucro::varchar(2) AS curva_lucro,
        ($11 - c.data_ultima_venda)::integer AS dias_sem_venda,
        COUNT(*) OVER()::bigint AS total_count
      FROM produtos_base p
      INNER JOIN %1$I.ultima_venda_produto_filial c
        ON c.produto_id = p.id
       AND c.filial_id = p.filial_id
      LEFT JOIN departamento_ref dr
        ON dr.departamento_id = p.departamento_id
      LEFT JOIN setor_default_por_departamento sdpd
        ON $3 <> ''setor''
       AND sdpd.departamento_id = p.departamento_id
      LEFT JOIN setor_selecionado_por_departamento sspd
        ON $3 = ''setor''
       AND sspd.departamento_id = p.departamento_id
      WHERE c.data_ultima_venda >= $6
        AND c.data_ultima_venda <= $7
    )
    SELECT
      pf.filial_id,
      pf.produto_id,
      pf.descricao,
      pf.departamento_id,
      pf.departamento_nome,
      pf.setor_id,
      pf.setor_nome,
      pf.estoque_atual,
      pf.data_ultima_venda,
      pf.data_ultima_entrada,
      pf.preco_custo,
      pf.curva_abcd,
      pf.curva_lucro,
      pf.dias_sem_venda,
      pf.total_count
    FROM produtos_filtrados pf
    ORDER BY pf.dias_sem_venda DESC NULLS LAST, pf.produto_id
    LIMIT $9
    OFFSET $10
  ', p_schema, p_schema, v_filter_condition);

  RETURN QUERY EXECUTE v_query
    USING
      v_filiais_arr,
      p_curva_abc,
      p_filtro_tipo,
      v_departamentos_arr,
      v_produtos_arr,
      v_data_limite_min,
      v_data_limite_max,
      NULL,
      p_limit,
      p_offset,
      p_data_referencia;
END;
$function$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'setores'
      AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
  LOOP
    EXECUTE format($fn$
      CREATE OR REPLACE FUNCTION %1$I.trg_setores_bloquear_departamento_duplicado()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $body$
      DECLARE
        v_new_level1 bigint[];
        v_overlap bigint[];
      BEGIN
        IF NEW.ativo IS DISTINCT FROM TRUE THEN
          RETURN NEW;
        END IF;

        v_new_level1 := public.get_departamentos_hierarquia_simples('%1$I', NEW.departamento_nivel, NEW.departamento_ids);

        IF v_new_level1 IS NULL OR cardinality(v_new_level1) = 0 THEN
          RETURN NEW;
        END IF;

        SELECT array_agg(DISTINCT dep_id)
        INTO v_overlap
        FROM %1$I.setores s
        CROSS JOIN LATERAL unnest(public.get_departamentos_hierarquia_simples('%1$I', s.departamento_nivel, s.departamento_ids)) dep_id
        WHERE s.ativo = true
          AND s.id <> COALESCE(NEW.id, -1)
          AND dep_id = ANY(v_new_level1);

        IF v_overlap IS NOT NULL THEN
          RAISE EXCEPTION
            'Conflito de setor: departamentos nível 1 %% já pertencem a outro setor ativo',
            v_overlap
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END;
      $body$;
    $fn$, r.table_schema);
  END LOOP;
END $$;
