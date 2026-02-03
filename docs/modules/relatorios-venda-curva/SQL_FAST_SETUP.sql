-- Vendas por Curva (Fast) - Setup
-- Ajuste o schema (paraiso, demo, etc.) antes de executar.

-- 1) Tabela de agregados mensais por produto+filial
CREATE TABLE IF NOT EXISTS paraiso.vendas_mensal_produto (
  ano smallint not null,
  mes smallint not null,
  filial_id bigint not null,
  id_produto bigint not null,
  total_qtde numeric(15, 5) not null default 0,
  total_valor_vendas numeric(15, 5) not null default 0,
  total_lucro numeric(15, 5) not null default 0,
  primary key (ano, mes, filial_id, id_produto)
);

CREATE INDEX IF NOT EXISTS idx_paraiso_vendas_mensal_produto_ano_mes
  ON paraiso.vendas_mensal_produto (ano, mes);

CREATE INDEX IF NOT EXISTS idx_paraiso_vendas_mensal_produto_lookup
  ON paraiso.vendas_mensal_produto (ano, mes, filial_id, id_produto);

-- 2) Carga inicial (backfill)
INSERT INTO paraiso.vendas_mensal_produto (
  ano, mes, filial_id, id_produto, total_qtde, total_valor_vendas, total_lucro
)
SELECT
  EXTRACT(year FROM data_venda)::smallint as ano,
  EXTRACT(month FROM data_venda)::smallint as mes,
  filial_id,
  id_produto,
  SUM(quantidade) as total_qtde,
  SUM(valor_vendas) as total_valor_vendas,
  SUM(COALESCE(valor_vendas, 0) - (COALESCE(custo_compra, 0) * COALESCE(quantidade, 0))) as total_lucro
FROM paraiso.vendas
WHERE valor_vendas > 0
GROUP BY 1,2,3,4
ON CONFLICT (ano, mes, filial_id, id_produto) DO UPDATE
SET
  total_qtde = EXCLUDED.total_qtde,
  total_valor_vendas = EXCLUDED.total_valor_vendas,
  total_lucro = EXCLUDED.total_lucro;

-- 3) Função RPC otimizada
CREATE OR REPLACE FUNCTION public.get_venda_curva_report_fast(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date
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
AS $function$
DECLARE
  v_offset integer;
  v_data_inicio date;
  v_data_fim date;
  v_prev_inicio date;
  v_prev_fim date;
  v_prev_sql text;
BEGIN
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
      FROM %I.vendas_mensal_produto vmp
      WHERE vmp.ano = $1
        AND vmp.mes = $2
        AND ($3 IS NULL OR vmp.filial_id = ANY($3))
        AND vmp.total_valor_vendas > 0
    ),
    base_prev AS (
      ' || v_prev_sql || '
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
      INNER JOIN %I.produtos p
        ON p.id = b.id_produto
        AND p.filial_id = b.filial_id
        AND p.ativo = true
      INNER JOIN %I.departments_level_1 d1
        ON d1.departamento_id = p.departamento_id
      LEFT JOIN %I.departments_level_2 d2
        ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %I.departments_level_3 d3
        ON d3.departamento_id = d1.pai_level_3_id
      LEFT JOIN base_prev bp
        ON bp.id_produto = b.id_produto
        AND bp.filial_id = b.filial_id
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
        WHEN va.total_valor_vendas > 0
        THEN ROUND((va.total_lucro / va.total_valor_vendas) * 100, 2)
        ELSE 0
      END as percentual_lucro,
      va.curva_venda::text,
      va.curva_lucro::text,
      ROUND(va.total_qtde_prev::numeric, 2),
      ROUND(va.total_valor_vendas_prev::numeric, 2),
      ROUND(va.total_lucro_prev::numeric, 2),
      CASE
        WHEN va.total_valor_vendas_prev > 0
        THEN ROUND((va.total_lucro_prev / va.total_valor_vendas_prev) * 100, 2)
        ELSE 0
      END as percentual_lucro_ano_anterior
    FROM vendas_agregadas va
    INNER JOIN dept3_totais dt ON va.dept3_nome = dt.dept3_nome
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
  ', p_schema, p_schema, p_schema, p_schema, p_schema, p_schema)
  USING p_ano, p_mes, p_filial_ids, p_page_size, v_offset, v_prev_fim, v_prev_inicio;
END;
$function$;
