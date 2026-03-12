-- =========================================================
-- Fase 2: performance do relatorio Produtos sem Vendas
-- =========================================================

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

  v_query := format('
    WITH
    setores_departamentos AS (
      SELECT DISTINCT unnest(s.departamento_ids)::bigint AS departamento_id
      FROM %1$I.setores s
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
      CROSS JOIN LATERAL unnest(s.departamento_ids) dep_id
      WHERE s.ativo = true
      ORDER BY dep_id, s.id
    ),
    setor_selecionado_por_departamento AS (
      SELECT DISTINCT ON (dep_id)
        dep_id::bigint AS departamento_id,
        s.id::bigint AS setor_id,
        s.nome::text AS setor_nome
      FROM %1$I.setores s
      CROSS JOIN LATERAL unnest(s.departamento_ids) dep_id
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
        AND (
          $3 = ''all''
          OR ($3 = ''departamento'' AND COALESCE(array_length($4, 1), 0) > 0 AND p.departamento_id = ANY($4))
          OR ($3 = ''setor'' AND COALESCE(array_length($4, 1), 0) > 0 AND p.departamento_id IN (SELECT sd.departamento_id FROM setores_departamentos sd))
          OR ($3 = ''produto'' AND COALESCE(array_length($5, 1), 0) > 0 AND p.id = ANY($5))
        )
    ),
    produtos_enriquecidos AS (
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
        ue.data_ultima_entrada::date AS data_ultima_entrada,
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
      LEFT JOIN LATERAL (
        SELECT e.data_entrada AS data_ultima_entrada
        FROM %1$I.entradas_produtos ep
        INNER JOIN %1$I.entradas e
          ON e.id = ep.entrada_id
        WHERE ep.produto_id = p.id
          AND e.filial_id = p.filial_id
        ORDER BY e.data_entrada DESC, e.id DESC
        LIMIT 1
      ) ue ON true
    ),
    produtos_sem_vendas AS (
      SELECT
        pe.*,
        CASE
          WHEN pe.data_ultima_venda IS NULL THEN NULL
          ELSE ($11 - pe.data_ultima_venda)::integer
        END AS dias_sem_venda
      FROM produtos_enriquecidos pe
      WHERE pe.data_ultima_venda >= $6
        AND pe.data_ultima_venda <= $7
    )
    SELECT
      psv.filial_id,
      psv.produto_id,
      psv.descricao,
      psv.departamento_id,
      psv.departamento_nome,
      psv.setor_id,
      psv.setor_nome,
      psv.estoque_atual,
      psv.data_ultima_venda,
      psv.data_ultima_entrada,
      psv.preco_custo,
      psv.curva_abcd,
      psv.curva_lucro,
      psv.dias_sem_venda,
      COUNT(*) OVER()::bigint AS total_count
    FROM produtos_sem_vendas psv
    ORDER BY psv.dias_sem_venda DESC NULLS LAST, psv.produto_id
    LIMIT $9
    OFFSET $10
  ', p_schema);

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

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'produtos'
      AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.produtos
       USING btree (filial_id, departamento_id, curva_abcd, id)
       INCLUDE (descricao, estoque_atual, preco_de_custo, curva_lucro)
       WHERE ativo = true AND estoque_atual > 0',
      'idx_produtos_sem_vendas_covering',
      r.table_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.entradas_produtos
       USING btree (produto_id, entrada_id DESC)',
      'idx_entradas_produtos_produto_entrada',
      r.table_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.entradas
       USING btree (filial_id, data_entrada DESC, id DESC)',
      'idx_entradas_filial_data_desc',
      r.table_schema
    );
  END LOOP;
END $$;
