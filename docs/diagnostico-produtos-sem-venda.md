-- =========================================================
-- DIAGNOSTICO COMPLETO - RELATORIO PRODUTOS SEM VENDAS
-- Trocar sol pelo schema do tenant (ex: paraiso)
-- =========================================================

-- 0) Contexto ambiente:
[
  {
    "executed_at": "2026-03-12 12:48:53.087775+00",
    "db": "postgres",
    "db_user": "postgres",
    "version": "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit"
  }
]
-- 1) Funcoes relacionadas (definicao atual)
[
  {
    "schema_name": "public",
    "function_name": "get_previsao_ruptura_report",
    "signature": "get_previsao_ruptura_report(text,bigint[],integer,integer,text[],boolean,text,text,bigint[],bigint[],integer,integer)"
  },
  {
    "schema_name": "public",
    "function_name": "get_produtos_sem_vendas",
    "signature": "get_produtos_sem_vendas(text,text,integer,integer,date,text,text,text,text,integer,integer)"
  },
  {
    "schema_name": "public",
    "function_name": "get_ruptura_abcd_report",
    "signature": "get_ruptura_abcd_report(text,bigint[],text[],boolean,boolean,bigint[],bigint[],text,integer,integer)"
  },
  {
    "schema_name": "public",
    "function_name": "get_ruptura_venda_60d_report",
    "signature": "get_ruptura_venda_60d_report(text,integer[],integer,text[],integer,integer,bigint[],bigint[],text)"
  }
]

[
  {
    "signature": "get_produtos_sem_vendas(text,text,integer,integer,date,text,text,text,text,integer,integer)",
    "function_definition": "CREATE OR REPLACE FUNCTION public.get_produtos_sem_vendas(p_schema text, p_filiais text DEFAULT 'all'::text, p_dias_sem_vendas_min integer DEFAULT 15, p_dias_sem_vendas_max integer DEFAULT 90, p_data_referencia date DEFAULT CURRENT_DATE, p_curva_abc text DEFAULT 'all'::text, p_filtro_tipo text DEFAULT 'all'::text, p_departamento_ids text DEFAULT NULL::text, p_produto_ids text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)\n RETURNS TABLE(filial_id bigint, produto_id bigint, descricao text, estoque_atual numeric, data_ultima_venda date, data_ultima_entrada date, preco_custo numeric, curva_abcd text, curva_lucro character varying, dias_sem_venda integer, total_count bigint)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET statement_timeout TO '25s'\nAS $function$\nDECLARE\n  v_filiais_condition TEXT;\n  v_curva_condition TEXT;\n  v_departamento_condition TEXT;\n  v_produto_condition TEXT;\n  v_data_limite_min DATE;\n  v_data_limite_max DATE;\n  v_query TEXT;\nBEGIN\n  v_data_limite_min := p_data_referencia - p_dias_sem_vendas_max;\n  v_data_limite_max := p_data_referencia - p_dias_sem_vendas_min;\n\n  IF p_filiais IS NULL OR p_filiais = 'all' OR p_filiais = '' THEN\n    v_filiais_condition := '1=1';\n  ELSE\n    v_filiais_condition := 'p.filial_id IN (' || p_filiais || ')';\n  END IF;\n\n  IF p_curva_abc IS NULL OR p_curva_abc = 'all' OR p_curva_abc = '' THEN\n    v_curva_condition := '1=1';\n  ELSE\n    v_curva_condition := 'p.curva_abcd = ' || quote_literal(p_curva_abc);\n  END IF;\n\n  IF p_filtro_tipo = 'departamento' AND p_departamento_ids IS NOT NULL AND p_departamento_ids != '' THEN\n    v_departamento_condition := 'p.departamento_id IN (' || p_departamento_ids || ')';\n  ELSIF p_filtro_tipo = 'setor' AND p_departamento_ids IS NOT NULL AND p_departamento_ids != '' THEN\n    v_departamento_condition := format('\n      p.departamento_id IN (\n        SELECT DISTINCT unnest(s.departamento_ids)\n        FROM %I.setores s\n        WHERE s.id IN (%s)\n          AND s.ativo = true\n      )\n    ', p_schema, p_departamento_ids);\n  ELSE\n    v_departamento_condition := '1=1';\n  END IF;\n\n  IF p_filtro_tipo = 'produto' AND p_produto_ids IS NOT NULL AND p_produto_ids != '' THEN\n    v_produto_condition := 'p.id IN (' || p_produto_ids || ')';\n  ELSE\n    v_produto_condition := '1=1';\n  END IF;\n\n  v_query := format('\n    WITH\n    produtos_base AS (\n      SELECT\n        p.id,\n        p.filial_id,\n        p.descricao,\n        p.estoque_atual,\n        p.preco_de_custo,\n        p.curva_abcd,\n        p.curva_lucro\n      FROM %I.produtos p\n      WHERE p.ativo = true\n        AND p.estoque_atual > 0\n        AND %s\n        AND %s\n        AND %s\n        AND %s\n      LIMIT 2000\n    ),\n    ultimas_vendas AS (\n      SELECT\n        v.id_produto,\n        v.filial_id,\n        MAX(v.data_venda) as data_ultima_venda\n      FROM %I.vendas v\n      WHERE EXISTS (\n        SELECT 1 FROM produtos_base pb\n        WHERE pb.id = v.id_produto\n          AND pb.filial_id = v.filial_id\n      )\n      GROUP BY v.id_produto, v.filial_id\n    ),\n    produtos_sem_vendas AS (\n      SELECT\n        p.filial_id::BIGINT,\n        p.id::BIGINT as produto_id,\n        p.descricao::TEXT,\n        p.estoque_atual::NUMERIC(18,6),\n        uv.data_ultima_venda::DATE,\n        ue.data_ultima_entrada::DATE,\n        p.preco_de_custo::NUMERIC(15,5),\n        p.curva_abcd::TEXT,\n        p.curva_lucro::VARCHAR(2),\n        CASE\n          WHEN uv.data_ultima_venda IS NULL THEN NULL\n          ELSE (CURRENT_DATE - uv.data_ultima_venda)::INTEGER\n        END as dias_sem_venda\n      FROM produtos_base p\n      LEFT JOIN ultimas_vendas uv\n        ON p.id = uv.id_produto\n        AND p.filial_id = uv.filial_id\n      LEFT JOIN LATERAL (\n        SELECT\n          e.data_entrada as data_ultima_entrada\n        FROM %I.entradas_produtos ep\n        INNER JOIN %I.entradas e\n          ON e.id = ep.entrada_id\n        WHERE ep.produto_id = p.id\n          AND e.filial_id = p.filial_id\n        ORDER BY e.data_entrada DESC, e.id DESC\n        LIMIT 1\n      ) ue ON true\n      WHERE (\n        uv.data_ultima_venda >= $1\n        AND uv.data_ultima_venda <= $2\n      )\n    ),\n    total AS (\n      SELECT COUNT(*) as cnt FROM produtos_sem_vendas\n    )\n    SELECT\n      psv.filial_id,\n      psv.produto_id,\n      psv.descricao,\n      psv.estoque_atual,\n      psv.data_ultima_venda,\n      psv.data_ultima_entrada,\n      psv.preco_de_custo,\n      psv.curva_abcd,\n      psv.curva_lucro,\n      psv.dias_sem_venda,\n      t.cnt::BIGINT as total_count\n    FROM produtos_sem_vendas psv\n    CROSS JOIN total t\n    ORDER BY psv.dias_sem_venda DESC, psv.produto_id\n    LIMIT $3\n    OFFSET $4\n  ',\n  p_schema,\n  v_filiais_condition,\n  v_curva_condition,\n  v_departamento_condition,\n  v_produto_condition,\n  p_schema,\n  p_schema,\n  p_schema\n  );\n\n  RETURN QUERY EXECUTE v_query\n    USING v_data_limite_min, v_data_limite_max, p_limit, p_offset;\n\nEXCEPTION\n  WHEN query_canceled THEN\n    RAISE EXCEPTION 'Query muito lenta. Por favor: 1) Selecione UMA filial específica, 2) Aguarde criação de índices';\nEND;\n$function$\n"
  }
]

-- 2) Tabelas usadas no modulo
[
  {
    "table_schema": "sol",
    "table_name": "departments_level_1"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos"
  },
  {
    "table_schema": "sol",
    "table_name": "setores"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens"
  }
]

-- 3) Estrutura de colunas (tipos)
[
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 2,
    "column_name": "departamento_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 3,
    "column_name": "descricao",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 4,
    "column_name": "pai_level_2_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 5,
    "column_name": "pai_level_3_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 6,
    "column_name": "pai_level_4_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 7,
    "column_name": "pai_level_5_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 8,
    "column_name": "pai_level_6_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "ordinal_position": 9,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 2,
    "column_name": "filial_id",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 3,
    "column_name": "numero",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 4,
    "column_name": "data_emissao",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 5,
    "column_name": "data_entrada",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 6,
    "column_name": "valor_total",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 7,
    "column_name": "transacao",
    "data_type": "character varying",
    "udt_name": "varchar",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 8,
    "column_name": "data_extracao",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": "CURRENT_DATE"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "ordinal_position": 9,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 1,
    "column_name": "entrada_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 2,
    "column_name": "produto_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 3,
    "column_name": "ordem",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 4,
    "column_name": "quantidade",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 5,
    "column_name": "qtd_por_embalagem",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 6,
    "column_name": "custo_unitario",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 7,
    "column_name": "data_extracao",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": "CURRENT_DATE"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "ordinal_position": 8,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 2,
    "column_name": "filial_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 3,
    "column_name": "descricao",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 4,
    "column_name": "ativo",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": "true"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 5,
    "column_name": "departamento_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 6,
    "column_name": "departamento_nivel",
    "data_type": "smallint",
    "udt_name": "int2",
    "is_nullable": "NO",
    "column_default": "1"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 7,
    "column_name": "unidade_de_medida",
    "data_type": "character varying",
    "udt_name": "varchar",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 8,
    "column_name": "curva_abc",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 9,
    "column_name": "balanca",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 10,
    "column_name": "ultimo_fornecedor",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 11,
    "column_name": "preco_de_venda_1",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 12,
    "column_name": "preco_de_venda_2",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 13,
    "column_name": "preco_de_custo",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 14,
    "column_name": "custo_real",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 15,
    "column_name": "custo_fiscal",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 16,
    "column_name": "custo_com_encargos",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 17,
    "column_name": "custo_medio",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 18,
    "column_name": "estoque_atual",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 19,
    "column_name": "qtde_por_embalagem_ultima_entrada",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 20,
    "column_name": "data_cadastro",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 21,
    "column_name": "data_alteracao_preco",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 22,
    "column_name": "data_alteracao_custo",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 23,
    "column_name": "data_alteracao_cadastro",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 24,
    "column_name": "marca_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 25,
    "column_name": "classe_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 26,
    "column_name": "agrupamento_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 27,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 28,
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 29,
    "column_name": "venda_media_diaria_60d",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 30,
    "column_name": "dias_de_estoque",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 31,
    "column_name": "dias_com_venda_60d",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 32,
    "column_name": "curva_abcd",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 33,
    "column_name": "curva_lucro",
    "data_type": "character varying",
    "udt_name": "varchar",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 34,
    "column_name": "dias_com_venda_ultimos_3d",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "ordinal_position": 35,
    "column_name": "dias_com_venda_30d",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": "nextval('okilao.setores_id_seq'::regclass)"
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 2,
    "column_name": "nome",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 3,
    "column_name": "departamento_nivel",
    "data_type": "smallint",
    "udt_name": "int2",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 4,
    "column_name": "departamento_ids",
    "data_type": "ARRAY",
    "udt_name": "_int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 5,
    "column_name": "ativo",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "NO",
    "column_default": "true"
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 6,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "ordinal_position": 7,
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 1,
    "column_name": "id_produto",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 2,
    "column_name": "filial_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 3,
    "column_name": "data_venda",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 4,
    "column_name": "id_oferta",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 5,
    "column_name": "quantidade",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 6,
    "column_name": "preco_medio",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 7,
    "column_name": "valor_vendas",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 8,
    "column_name": "aliquota_icms",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 9,
    "column_name": "custo_com_encargos",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 10,
    "column_name": "custo_sem_icms",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 11,
    "column_name": "custo_compra",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 12,
    "column_name": "custo_medio",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 13,
    "column_name": "custo_fiscal_medio",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 14,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 15,
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "ordinal_position": 16,
    "column_name": "id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": "nextval('sol.vendas_id_seq'::regclass)"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 1,
    "column_name": "filial_id",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 2,
    "column_name": "cupom",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 3,
    "column_name": "produto_id",
    "data_type": "bigint",
    "udt_name": "int8",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 4,
    "column_name": "ordem",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 5,
    "column_name": "quantidade_vendida",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 6,
    "column_name": "preco_venda",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 7,
    "column_name": "valor_desconto",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 8,
    "column_name": "valor_acrescimo",
    "data_type": "numeric",
    "udt_name": "numeric",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 9,
    "column_name": "cancelado",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 10,
    "column_name": "data_extracao",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "NO",
    "column_default": "CURRENT_DATE"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 11,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "ordinal_position": 12,
    "column_name": "oferta_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null
  }
]

-- 4) Constraints (PK/FK/UNIQUE/CHECK)
[
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "constraint_name": "departments_level_1_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (id)"
  },
  {
    "table_schema": "sol",
    "table_name": "departments_level_1",
    "constraint_name": "departments_level_1_departamento_id_key",
    "constraint_type": "u",
    "constraint_definition": "UNIQUE (departamento_id)"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas",
    "constraint_name": "entradas_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (id)"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "constraint_name": "entradas_produtos_entrada_id_fkey",
    "constraint_type": "f",
    "constraint_definition": "FOREIGN KEY (entrada_id) REFERENCES sol.entradas(id) ON DELETE CASCADE"
  },
  {
    "table_schema": "sol",
    "table_name": "entradas_produtos",
    "constraint_name": "entradas_produtos_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (entrada_id, produto_id, ordem)"
  },
  {
    "table_schema": "sol",
    "table_name": "produtos",
    "constraint_name": "produtos_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (id, filial_id)"
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "constraint_name": "setores_departamento_nivel_check",
    "constraint_type": "c",
    "constraint_definition": "CHECK (((departamento_nivel >= 1) AND (departamento_nivel <= 6)))"
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "constraint_name": "setores_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (id)"
  },
  {
    "table_schema": "sol",
    "table_name": "setores",
    "constraint_name": "setores_nome_key",
    "constraint_type": "u",
    "constraint_definition": "UNIQUE (nome)"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "constraint_name": "vendas_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (id)"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas",
    "constraint_name": "vendas_unicas_idx",
    "constraint_type": "u",
    "constraint_definition": "UNIQUE (id_produto, filial_id, data_venda, id_oferta)"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "constraint_name": "vendas_hoje_itens_filial_id_cupom_data_extracao_fkey",
    "constraint_type": "f",
    "constraint_definition": "FOREIGN KEY (filial_id, cupom, data_extracao) REFERENCES sol.vendas_hoje(filial_id, cupom, data_extracao) ON DELETE CASCADE"
  },
  {
    "table_schema": "sol",
    "table_name": "vendas_hoje_itens",
    "constraint_name": "vendas_hoje_itens_pkey",
    "constraint_type": "p",
    "constraint_definition": "PRIMARY KEY (filial_id, cupom, produto_id, ordem, data_extracao)"
  }
]

-- 5) Indices existentes
[
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "departments_level_1_departamento_id_key",
    "indexdef": "CREATE UNIQUE INDEX departments_level_1_departamento_id_key ON sol.departments_level_1 USING btree (departamento_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "departments_level_1_pkey",
    "indexdef": "CREATE UNIQUE INDEX departments_level_1_pkey ON sol.departments_level_1 USING btree (id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_departments_level_1_pai_level_2",
    "indexdef": "CREATE INDEX idx_departments_level_1_pai_level_2 ON sol.departments_level_1 USING btree (pai_level_2_id) WHERE (pai_level_2_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_departments_level_1_pai_level_5",
    "indexdef": "CREATE INDEX idx_departments_level_1_pai_level_5 ON sol.departments_level_1 USING btree (pai_level_5_id) WHERE (pai_level_5_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_level_1_pai_level_2",
    "indexdef": "CREATE INDEX idx_dept_level_1_pai_level_2 ON sol.departments_level_1 USING btree (pai_level_2_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_level_1_pai_level_3",
    "indexdef": "CREATE INDEX idx_dept_level_1_pai_level_3 ON sol.departments_level_1 USING btree (pai_level_3_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_level_1_pai_level_4",
    "indexdef": "CREATE INDEX idx_dept_level_1_pai_level_4 ON sol.departments_level_1 USING btree (pai_level_4_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_level_1_pai_level_5",
    "indexdef": "CREATE INDEX idx_dept_level_1_pai_level_5 ON sol.departments_level_1 USING btree (pai_level_5_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_level_1_pai_level_6",
    "indexdef": "CREATE INDEX idx_dept_level_1_pai_level_6 ON sol.departments_level_1 USING btree (pai_level_6_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_pai_level_2",
    "indexdef": "CREATE INDEX idx_dept_pai_level_2 ON sol.departments_level_1 USING btree (pai_level_2_id) INCLUDE (departamento_id) WHERE (pai_level_2_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_pai_level_3",
    "indexdef": "CREATE INDEX idx_dept_pai_level_3 ON sol.departments_level_1 USING btree (pai_level_3_id) INCLUDE (departamento_id) WHERE (pai_level_3_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_pai_level_4",
    "indexdef": "CREATE INDEX idx_dept_pai_level_4 ON sol.departments_level_1 USING btree (pai_level_4_id) INCLUDE (departamento_id) WHERE (pai_level_4_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_pai_level_5",
    "indexdef": "CREATE INDEX idx_dept_pai_level_5 ON sol.departments_level_1 USING btree (pai_level_5_id) INCLUDE (departamento_id) WHERE (pai_level_5_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "departments_level_1",
    "indexname": "idx_dept_pai_level_6",
    "indexdef": "CREATE INDEX idx_dept_pai_level_6 ON sol.departments_level_1 USING btree (pai_level_6_id) INCLUDE (departamento_id) WHERE (pai_level_6_id IS NOT NULL)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas",
    "indexname": "entradas_pkey",
    "indexdef": "CREATE UNIQUE INDEX entradas_pkey ON sol.entradas USING btree (id)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas",
    "indexname": "idx_entradas_data_entrada",
    "indexdef": "CREATE INDEX idx_entradas_data_entrada ON sol.entradas USING btree (data_entrada)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas",
    "indexname": "idx_entradas_filial",
    "indexdef": "CREATE INDEX idx_entradas_filial ON sol.entradas USING btree (filial_id, data_entrada)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas",
    "indexname": "idx_entradas_transacao",
    "indexdef": "CREATE INDEX idx_entradas_transacao ON sol.entradas USING btree (transacao)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas_produtos",
    "indexname": "entradas_produtos_pkey",
    "indexdef": "CREATE UNIQUE INDEX entradas_produtos_pkey ON sol.entradas_produtos USING btree (entrada_id, produto_id, ordem)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas_produtos",
    "indexname": "idx_entradas_produtos_entrada",
    "indexdef": "CREATE INDEX idx_entradas_produtos_entrada ON sol.entradas_produtos USING btree (entrada_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "entradas_produtos",
    "indexname": "idx_entradas_produtos_produto",
    "indexdef": "CREATE INDEX idx_entradas_produtos_produto ON sol.entradas_produtos USING btree (produto_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_okilao_produtos_ruptura_abcd",
    "indexdef": "CREATE INDEX idx_okilao_produtos_ruptura_abcd ON sol.produtos USING btree (filial_id, curva_abcd, estoque_atual, ativo, departamento_id, descricao) WHERE ((curva_abcd = 'A'::text) AND (estoque_atual <= (0)::numeric) AND (ativo = true))"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_ativos_venda",
    "indexdef": "CREATE INDEX idx_produtos_ativos_venda ON sol.produtos USING btree (id, filial_id, venda_media_diaria_60d) WHERE (venda_media_diaria_60d > (0)::numeric)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_curva_abc",
    "indexdef": "CREATE INDEX idx_produtos_curva_abc ON sol.produtos USING btree (curva_abc)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_curva_abc_estoque",
    "indexdef": "CREATE INDEX idx_produtos_curva_abc_estoque ON sol.produtos USING btree (curva_abc, estoque_atual, filial_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_departamento",
    "indexdef": "CREATE INDEX idx_produtos_departamento ON sol.produtos USING btree (departamento_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_departamento_id",
    "indexdef": "CREATE INDEX idx_produtos_departamento_id ON sol.produtos USING btree (departamento_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_dept_filial",
    "indexdef": "CREATE INDEX idx_produtos_dept_filial ON sol.produtos USING btree (departamento_id, filial_id) INCLUDE (id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_filial_departamento",
    "indexdef": "CREATE INDEX idx_produtos_filial_departamento ON sol.produtos USING btree (filial_id, departamento_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_id_filial",
    "indexdef": "CREATE INDEX idx_produtos_id_filial ON sol.produtos USING btree (id, filial_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_produtos_id_filial_unique",
    "indexdef": "CREATE UNIQUE INDEX idx_produtos_id_filial_unique ON sol.produtos USING btree (id, filial_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_sol_produtos_curva",
    "indexdef": "CREATE INDEX idx_sol_produtos_curva ON sol.produtos USING btree (curva_abcd, filial_id) WHERE (ativo = true)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_sol_produtos_ruptura_abcd",
    "indexdef": "CREATE INDEX idx_sol_produtos_ruptura_abcd ON sol.produtos USING btree (filial_id, curva_abcd, estoque_atual, ativo, departamento_id, descricao) WHERE ((curva_abcd = 'A'::text) AND (estoque_atual <= (0)::numeric) AND (ativo = true))"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "idx_sol_produtos_sem_vendas",
    "indexdef": "CREATE INDEX idx_sol_produtos_sem_vendas ON sol.produtos USING btree (filial_id, ativo, estoque_atual) WHERE ((ativo = true) AND (estoque_atual > (0)::numeric))"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "produtos_filial_id_id_idx",
    "indexdef": "CREATE INDEX produtos_filial_id_id_idx ON sol.produtos USING btree (filial_id, id)"
  },
  {
    "schemaname": "sol",
    "tablename": "produtos",
    "indexname": "produtos_pkey",
    "indexdef": "CREATE UNIQUE INDEX produtos_pkey ON sol.produtos USING btree (id, filial_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "setores",
    "indexname": "setores_ativo_idx",
    "indexdef": "CREATE INDEX setores_ativo_idx ON sol.setores USING btree (ativo) WHERE (ativo = true)"
  },
  {
    "schemaname": "sol",
    "tablename": "setores",
    "indexname": "setores_nome_key",
    "indexdef": "CREATE UNIQUE INDEX setores_nome_key ON sol.setores USING btree (nome)"
  },
  {
    "schemaname": "sol",
    "tablename": "setores",
    "indexname": "setores_pkey",
    "indexdef": "CREATE UNIQUE INDEX setores_pkey ON sol.setores USING btree (id)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_sol_vendas_ultima",
    "indexdef": "CREATE INDEX idx_sol_vendas_ultima ON sol.vendas USING btree (id_produto, filial_id, data_venda DESC)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_agregacao_mensal",
    "indexdef": "CREATE INDEX idx_vendas_agregacao_mensal ON sol.vendas USING btree (data_venda, filial_id, id_produto) INCLUDE (quantidade, valor_vendas, custo_compra)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_cobertura_mv",
    "indexdef": "CREATE INDEX idx_vendas_cobertura_mv ON sol.vendas USING btree (data_venda) INCLUDE (id_produto, filial_id, valor_vendas)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_data",
    "indexdef": "CREATE INDEX idx_vendas_data ON sol.vendas USING btree (data_venda)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_data_covering",
    "indexdef": "CREATE INDEX idx_vendas_data_covering ON sol.vendas USING btree (data_venda, filial_id, id_produto) INCLUDE (valor_vendas) WHERE (data_venda >= '2024-01-01'::date)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_data_filial",
    "indexdef": "CREATE INDEX idx_vendas_data_filial ON sol.vendas USING btree (data_venda, filial_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_data_filial_produto",
    "indexdef": "CREATE INDEX idx_vendas_data_filial_produto ON sol.vendas USING btree (data_venda, filial_id, id_produto)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_filial_e_data",
    "indexdef": "CREATE INDEX idx_vendas_filial_e_data ON sol.vendas USING btree (filial_id, data_venda DESC)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_id_produto",
    "indexdef": "CREATE INDEX idx_vendas_id_produto ON sol.vendas USING btree (id_produto)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_month_year_covering",
    "indexdef": "CREATE INDEX idx_vendas_month_year_covering ON sol.vendas USING btree (EXTRACT(month FROM data_venda), EXTRACT(year FROM data_venda), filial_id, id_produto) INCLUDE (valor_vendas) WHERE (data_venda >= '2024-01-01'::date)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "idx_vendas_produto_filial_data_optimized",
    "indexdef": "CREATE INDEX idx_vendas_produto_filial_data_optimized ON sol.vendas USING btree (id_produto, filial_id, data_venda)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "vendas_pkey",
    "indexdef": "CREATE UNIQUE INDEX vendas_pkey ON sol.vendas USING btree (id)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas",
    "indexname": "vendas_unicas_idx",
    "indexdef": "CREATE UNIQUE INDEX vendas_unicas_idx ON sol.vendas USING btree (id_produto, filial_id, data_venda, id_oferta)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_sol_vendas_hoje_ultima",
    "indexdef": "CREATE INDEX idx_sol_vendas_hoje_ultima ON sol.vendas_hoje_itens USING btree (produto_id, filial_id, data_extracao DESC) WHERE (cancelado = false)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_sol_vhi_dashboard_cupom",
    "indexdef": "CREATE INDEX idx_sol_vhi_dashboard_cupom ON sol.vendas_hoje_itens USING btree (data_extracao, filial_id, cupom, cancelado)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_sol_vhi_dashboard_produto",
    "indexdef": "CREATE INDEX idx_sol_vhi_dashboard_produto ON sol.vendas_hoje_itens USING btree (data_extracao, cancelado, filial_id, produto_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_vendas_hoje_itens_cancelado",
    "indexdef": "CREATE INDEX idx_vendas_hoje_itens_cancelado ON sol.vendas_hoje_itens USING btree (cancelado)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_vendas_hoje_itens_data",
    "indexdef": "CREATE INDEX idx_vendas_hoje_itens_data ON sol.vendas_hoje_itens USING btree (data_extracao)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_vendas_hoje_itens_filial_data_cupom",
    "indexdef": "CREATE INDEX idx_vendas_hoje_itens_filial_data_cupom ON sol.vendas_hoje_itens USING btree (filial_id, data_extracao, cupom)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "idx_vendas_hoje_itens_produto",
    "indexdef": "CREATE INDEX idx_vendas_hoje_itens_produto ON sol.vendas_hoje_itens USING btree (produto_id)"
  },
  {
    "schemaname": "sol",
    "tablename": "vendas_hoje_itens",
    "indexname": "vendas_hoje_itens_pkey",
    "indexdef": "CREATE UNIQUE INDEX vendas_hoje_itens_pkey ON sol.vendas_hoje_itens USING btree (filial_id, cupom, produto_id, ordem, data_extracao)"
  }
]

-- 6) Estatisticas de volume (aprox)
[
  {
    "schemaname": "sol",
    "table_name": "departments_level_1",
    "approx_rows": 731,
    "dead_rows": 0,
    "last_analyze": "2025-11-18 19:59:08.233369+00",
    "last_autoanalyze": "2025-11-21 20:43:22.060336+00"
  },
  {
    "schemaname": "sol",
    "table_name": "entradas",
    "approx_rows": 56896,
    "dead_rows": 4761,
    "last_analyze": null,
    "last_autoanalyze": "2026-03-11 15:20:55.137787+00"
  },
  {
    "schemaname": "sol",
    "table_name": "entradas_produtos",
    "approx_rows": 645980,
    "dead_rows": 0,
    "last_analyze": null,
    "last_autoanalyze": "2026-03-11 15:22:55.319437+00"
  },
  {
    "schemaname": "sol",
    "table_name": "produtos",
    "approx_rows": 203003,
    "dead_rows": 26789,
    "last_analyze": "2026-01-12 20:35:05.618522+00",
    "last_autoanalyze": "2026-03-12 10:59:20.590406+00"
  },
  {
    "schemaname": "sol",
    "table_name": "setores",
    "approx_rows": 5,
    "dead_rows": 0,
    "last_analyze": "2025-11-18 19:59:08.234906+00",
    "last_autoanalyze": null
  },
  {
    "schemaname": "sol",
    "table_name": "vendas",
    "approx_rows": 8982759,
    "dead_rows": 0,
    "last_analyze": "2026-01-12 20:35:15.800322+00",
    "last_autoanalyze": "2026-03-09 08:27:52.927009+00"
  },
  {
    "schemaname": "sol",
    "table_name": "vendas_hoje_itens",
    "approx_rows": 337091,
    "dead_rows": 5,
    "last_analyze": "2026-01-12 20:35:17.256845+00",
    "last_autoanalyze": "2026-03-11 21:32:03.440996+00"
  }
]

-- 7.1) Quantidade de setores e cardinalidade dos arrays
[
  {
    "total_setores": 5,
    "setores_ativos": 5,
    "sem_departamento_ids": 0,
    "departamento_ids_vazio": 0
  }
]

-- 7.2) Amostra de setores ativos com departamento_ids
[
  {
    "setor_id": 13,
    "setor_nome": "Acougue",
    "ativo": true,
    "departamento_nivel": 3,
    "departamento_ids": [
      "61"
    ],
    "qtd_departamentos": 1
  },
  {
    "setor_id": 14,
    "setor_nome": "HortiFruti",
    "ativo": true,
    "departamento_nivel": 3,
    "departamento_ids": [
      "63"
    ],
    "qtd_departamentos": 1
  },
  {
    "setor_id": 15,
    "setor_nome": "Padaria",
    "ativo": true,
    "departamento_nivel": 3,
    "departamento_ids": [
      "62"
    ],
    "qtd_departamentos": 1
  },
  {
    "setor_id": 16,
    "setor_nome": "Loja Geral",
    "ativo": true,
    "departamento_nivel": 3,
    "departamento_ids": [
      "65",
      "99",
      "68",
      "80",
      "60",
      "59",
      "58",
      "64",
      "66",
      "70",
      "71",
      "2"
    ],
    "qtd_departamentos": 12
  },
  {
    "setor_id": 24,
    "setor_nome": "Bebidas",
    "ativo": true,
    "departamento_nivel": 3,
    "departamento_ids": [
      "65"
    ],
    "qtd_departamentos": 1
  }
]

-- 7.3) Cada ID de departamento_ids bate em departments_level_1.departamento_id?
[
  {
    "setor_id": 13,
    "setor_nome": "Acougue",
    "total_ids_no_array": 1,
    "ids_com_match_em_departamento_id": 1,
    "ids_sem_match_em_departamento_id": 0
  },
  {
    "setor_id": 14,
    "setor_nome": "HortiFruti",
    "total_ids_no_array": 1,
    "ids_com_match_em_departamento_id": 1,
    "ids_sem_match_em_departamento_id": 0
  },
  {
    "setor_id": 15,
    "setor_nome": "Padaria",
    "total_ids_no_array": 1,
    "ids_com_match_em_departamento_id": 1,
    "ids_sem_match_em_departamento_id": 0
  },
  {
    "setor_id": 16,
    "setor_nome": "Loja Geral",
    "total_ids_no_array": 12,
    "ids_com_match_em_departamento_id": 12,
    "ids_sem_match_em_departamento_id": 0
  },
  {
    "setor_id": 24,
    "setor_nome": "Bebidas",
    "total_ids_no_array": 1,
    "ids_com_match_em_departamento_id": 1,
    "ids_sem_match_em_departamento_id": 0
  }
]

-- 7.4) IDs orfaos dentro de setor.departamento_ids (sem match)
Success. No rows returned

-- 8) Sanidade produtos/departamento
[
  {
    "total_produtos": 203003,
    "ativos": 203003,
    "ativos_com_estoque": 54989,
    "departamentos_distintos_em_produtos": 704
  }
]

-- 9) Cobertura de vendas para produtos ativos com estoque
[
  {
    "produtos_base": 54989,
    "com_ultima_venda": 49951,
    "sem_ultima_venda": 5038
  }
]

-- 10) Teste alvo por setor (trocar __SETOR_IDS__ por exemplo: 12,25)
[
  {
    "qtd_setores": 0,
    "qtd_departamentos_mapeados": 0,
    "qtd_produtos_no_escopo": 0
  }
]