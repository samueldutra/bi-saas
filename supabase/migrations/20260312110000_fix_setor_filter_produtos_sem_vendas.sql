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
  v_filiais_condition TEXT;
  v_curva_condition TEXT;
  v_departamento_condition TEXT;
  v_produto_condition TEXT;
  v_data_limite_min DATE;
  v_data_limite_max DATE;
  v_query TEXT;
BEGIN
  v_data_limite_min := p_data_referencia - p_dias_sem_vendas_max;
  v_data_limite_max := p_data_referencia - p_dias_sem_vendas_min;

  IF p_filiais IS NULL OR p_filiais = 'all' OR p_filiais = '' THEN
    v_filiais_condition := '1=1';
  ELSE
    v_filiais_condition := 'p.filial_id IN (' || p_filiais || ')';
  END IF;

  IF p_curva_abc IS NULL OR p_curva_abc = 'all' OR p_curva_abc = '' THEN
    v_curva_condition := '1=1';
  ELSE
    v_curva_condition := 'p.curva_abcd = ' || quote_literal(p_curva_abc);
  END IF;

  IF p_filtro_tipo = 'departamento' AND p_departamento_ids IS NOT NULL AND p_departamento_ids != '' THEN
    v_departamento_condition := 'p.departamento_id IN (' || p_departamento_ids || ')';
  ELSIF p_filtro_tipo = 'setor' AND p_departamento_ids IS NOT NULL AND p_departamento_ids != '' THEN
    v_departamento_condition := format('
      p.departamento_id IN (
        SELECT DISTINCT unnest(s.departamento_ids)
        FROM %I.setores s
        WHERE s.id IN (%s)
          AND s.ativo = true
      )
    ', p_schema, p_departamento_ids);
  ELSE
    v_departamento_condition := '1=1';
  END IF;

  IF p_filtro_tipo = 'produto' AND p_produto_ids IS NOT NULL AND p_produto_ids != '' THEN
    v_produto_condition := 'p.id IN (' || p_produto_ids || ')';
  ELSE
    v_produto_condition := '1=1';
  END IF;

  v_query := format('
    WITH
    produtos_base AS (
      SELECT
        p.id,
        p.filial_id,
        p.descricao,
        p.estoque_atual,
        p.preco_de_custo,
        p.curva_abcd,
        p.curva_lucro
      FROM %I.produtos p
      WHERE p.ativo = true
        AND p.estoque_atual > 0
        AND %s
        AND %s
        AND %s
        AND %s
      LIMIT 2000
    ),
    ultimas_vendas AS (
      SELECT
        v.id_produto,
        v.filial_id,
        MAX(v.data_venda) as data_ultima_venda
      FROM %I.vendas v
      WHERE EXISTS (
        SELECT 1 FROM produtos_base pb
        WHERE pb.id = v.id_produto
          AND pb.filial_id = v.filial_id
      )
      GROUP BY v.id_produto, v.filial_id
    ),
    produtos_sem_vendas AS (
      SELECT
        p.filial_id::BIGINT,
        p.id::BIGINT as produto_id,
        p.descricao::TEXT,
        p.estoque_atual::NUMERIC(18,6),
        uv.data_ultima_venda::DATE,
        ue.data_ultima_entrada::DATE,
        p.preco_de_custo::NUMERIC(15,5),
        p.curva_abcd::TEXT,
        p.curva_lucro::VARCHAR(2),
        CASE
          WHEN uv.data_ultima_venda IS NULL THEN NULL
          ELSE (CURRENT_DATE - uv.data_ultima_venda)::INTEGER
        END as dias_sem_venda
      FROM produtos_base p
      LEFT JOIN ultimas_vendas uv
        ON p.id = uv.id_produto
        AND p.filial_id = uv.filial_id
      LEFT JOIN LATERAL (
        SELECT
          e.data_entrada as data_ultima_entrada
        FROM %I.entradas_produtos ep
        INNER JOIN %I.entradas e
          ON e.id = ep.entrada_id
        WHERE ep.produto_id = p.id
          AND e.filial_id = p.filial_id
        ORDER BY e.data_entrada DESC, e.id DESC
        LIMIT 1
      ) ue ON true
      WHERE (
        uv.data_ultima_venda >= $1
        AND uv.data_ultima_venda <= $2
      )
    ),
    total AS (
      SELECT COUNT(*) as cnt FROM produtos_sem_vendas
    )
    SELECT
      psv.filial_id,
      psv.produto_id,
      psv.descricao,
      psv.estoque_atual,
      psv.data_ultima_venda,
      psv.data_ultima_entrada,
      psv.preco_de_custo,
      psv.curva_abcd,
      psv.curva_lucro,
      psv.dias_sem_venda,
      t.cnt::BIGINT as total_count
    FROM produtos_sem_vendas psv
    CROSS JOIN total t
    ORDER BY psv.dias_sem_venda DESC, psv.produto_id
    LIMIT $3
    OFFSET $4
  ',
  p_schema,
  v_filiais_condition,
  v_curva_condition,
  v_departamento_condition,
  v_produto_condition,
  p_schema,
  p_schema,
  p_schema
  );

  RETURN QUERY EXECUTE v_query
    USING v_data_limite_min, v_data_limite_max, p_limit, p_offset;

EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Query muito lenta. Por favor: 1) Selecione UMA filial específica, 2) Aguarde criação de índices';
END;
$function$;
