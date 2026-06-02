-- Metas por Setor: cria snapshot setorizada e RPCs paralelas para leitura
-- pelo modelo da API /filial/vendas quando enable_api_filial_vendas=true.
--
-- Ordem de execucao:
-- 1. Helper para garantir a tabela vendas_setores_snapshot por tenant
-- 2. Criacao da tabela/indices nos tenants ativos
-- 3. RPC de refresh da snapshot setorizada
-- 4. RPC de relatorio diario/setor
-- 5. RPC de resumo por filial

-- 1. Helper para garantir a tabela vendas_setores_snapshot por tenant
CREATE OR REPLACE FUNCTION public.ensure_vendas_setores_snapshot_api_filial_vendas(
  p_schema text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
  END IF;

  IF to_regnamespace(p_schema) IS NULL THEN
    RAISE EXCEPTION 'Schema % nao encontrado', p_schema;
  END IF;

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.vendas_setores_snapshot (
      setor_id bigint NOT NULL,
      filial_id bigint NOT NULL,
      data_referencia date NOT NULL,
      valor numeric(15,4) NOT NULL DEFAULT 0,
      valor_origem numeric(15,4) NOT NULL DEFAULT 0,
      custo_real numeric(15,4) NOT NULL DEFAULT 0,
      custo_sem_icms numeric(15,4) NOT NULL DEFAULT 0,
      custo_com_encargos numeric(15,4) NOT NULL DEFAULT 0,
      custo_medio numeric(15,4) NOT NULL DEFAULT 0,
      custo_fiscal_medio numeric(15,4) NOT NULL DEFAULT 0,
      quantidade_unidades_vendidas numeric(15,5) NOT NULL DEFAULT 0,
      percentual_quebra numeric(8,4) NOT NULL DEFAULT 0,
      valor_icms numeric(15,4) NOT NULL DEFAULT 0,
      valor_piscofins numeric(15,4) NOT NULL DEFAULT 0,
      valor_quebra numeric(15,4) NOT NULL DEFAULT 0,
      custo_total_ajustado numeric(15,4) NOT NULL DEFAULT 0,
      lucro_ajustado numeric(15,4) NOT NULL DEFAULT 0,
      margem_ajustada_percentual numeric(10,4) NOT NULL DEFAULT 0,
      participacao_receita numeric(12,8),
      snapshot_filial_gravado_em timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vendas_setores_snapshot_pkey PRIMARY KEY (setor_id, filial_id, data_referencia)
    )
  $sql$, p_schema);

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_vendas_setores_snapshot_filial_data
       ON %I.vendas_setores_snapshot (filial_id, data_referencia)',
    p_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_vendas_setores_snapshot_setor_data
       ON %I.vendas_setores_snapshot (setor_id, data_referencia)',
    p_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_vendas_setores_snapshot_data
       ON %I.vendas_setores_snapshot (data_referencia)',
    p_schema
  );
END;
$function$;

-- 2. Criacao da tabela/indices nos tenants ativos
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
    IF to_regnamespace(tenant_schema) IS NULL THEN
      CONTINUE;
    END IF;

    PERFORM public.ensure_vendas_setores_snapshot_api_filial_vendas(tenant_schema);

    IF to_regclass(format('%I.vendas_filiais_snapshot', tenant_schema)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_vendas_filiais_snapshot_filial_data
           ON %I.vendas_filiais_snapshot (filial_id, data_referencia)',
        tenant_schema
      );
    END IF;
  END LOOP;
END $$;

-- 3. RPC de refresh da snapshot setorizada
CREATE OR REPLACE FUNCTION public.refresh_vendas_setores_snapshot_api_filial_vendas(
  p_schema text,
  p_data_inicio date,
  p_data_fim date,
  p_setor_id bigint DEFAULT NULL,
  p_filial_ids bigint[] DEFAULT NULL::bigint[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '90s'
SET work_mem TO '128MB'
AS $function$
DECLARE
  v_rows_deleted bigint := 0;
  v_rows_upserted bigint := 0;
BEGIN
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema nao informado';
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'Periodo nao informado';
  END IF;

  IF p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'Periodo invalido: data final menor que data inicial';
  END IF;

  IF to_regclass(format('%I.setores', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.setores nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.vendas', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.vendas nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.produtos', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.produtos nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.vendas_filiais_snapshot', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.vendas_filiais_snapshot nao encontrada', p_schema;
  END IF;

  PERFORM public.ensure_vendas_setores_snapshot_api_filial_vendas(p_schema);

  EXECUTE format($sql$
    DELETE FROM %I.vendas_setores_snapshot
    WHERE data_referencia >= $1
      AND data_referencia <= $2
      AND ($3 IS NULL OR filial_id = ANY($3))
      AND ($4 IS NULL OR setor_id = $4)
  $sql$, p_schema)
  USING p_data_inicio, p_data_fim, p_filial_ids, p_setor_id;

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  EXECUTE format($sql$
    WITH setores_departamentos AS (
      SELECT DISTINCT
        s.id::bigint AS setor_id,
        dep_id::bigint AS departamento_id
      FROM %1$I.setores s
      CROSS JOIN LATERAL unnest(
        public.get_departamentos_hierarquia_simples($5, s.departamento_nivel, s.departamento_ids)
      ) dep_id
      WHERE (s.ativo IS NULL OR s.ativo = true)
        AND ($4 IS NULL OR s.id::bigint = $4)
    ),
    vendas_setor AS (
      SELECT
        sd.setor_id,
        v.filial_id::bigint AS filial_id,
        v.data_venda::date AS data_referencia,
        COALESCE(SUM(COALESCE(v.valor_vendas, 0)), 0) AS valor_origem,
        COALESCE(SUM(COALESCE(v.quantidade, 0)), 0) AS quantidade_unidades_vendidas,
        COALESCE(SUM(COALESCE(v.quantidade, 0) * COALESCE(v.custo_compra, 0)), 0) AS custo_real,
        COALESCE(SUM(COALESCE(v.quantidade, 0) * COALESCE(v.custo_sem_icms, 0)), 0) AS custo_sem_icms,
        COALESCE(SUM(COALESCE(v.quantidade, 0) * COALESCE(v.custo_com_encargos, 0)), 0) AS custo_com_encargos,
        COALESCE(SUM(COALESCE(v.quantidade, 0) * COALESCE(v.custo_medio, 0)), 0) AS custo_medio,
        COALESCE(SUM(COALESCE(v.quantidade, 0) * COALESCE(v.custo_fiscal_medio, 0)), 0) AS custo_fiscal_medio
      FROM %1$I.vendas v
      INNER JOIN %1$I.produtos p
        ON p.id = v.id_produto
       AND p.filial_id = v.filial_id
      INNER JOIN setores_departamentos sd
        ON sd.departamento_id = p.departamento_id::bigint
      WHERE v.data_venda >= $1
        AND v.data_venda <= $2
        AND ($3 IS NULL OR v.filial_id::bigint = ANY($3))
      GROUP BY sd.setor_id, v.filial_id, v.data_venda::date
    ),
    vendas_filial_origem AS (
      SELECT
        v.filial_id::bigint AS filial_id,
        v.data_venda::date AS data_referencia,
        COALESCE(SUM(COALESCE(v.valor_vendas, 0)), 0) AS valor_origem_filial
      FROM %1$I.vendas v
      WHERE v.data_venda >= $1
        AND v.data_venda <= $2
        AND ($3 IS NULL OR v.filial_id::bigint = ANY($3))
      GROUP BY v.filial_id, v.data_venda::date
    ),
    base AS (
      SELECT
        vs.*,
        fs.valor AS valor_snapshot_filial,
        fs.custo_total_ajustado AS custo_total_snapshot_filial,
        fs.percentual_quebra,
        fs.valor_icms,
        fs.valor_piscofins,
        fs.valor_quebra,
        fs.snapshot_gravado_em,
        CASE
          WHEN COALESCE(vfo.valor_origem_filial, 0) > 0 THEN
            vs.valor_origem / vfo.valor_origem_filial
          ELSE NULL
        END AS participacao_receita
      FROM vendas_setor vs
      LEFT JOIN vendas_filial_origem vfo
        ON vfo.filial_id = vs.filial_id
       AND vfo.data_referencia = vs.data_referencia
      LEFT JOIN %1$I.vendas_filiais_snapshot fs
        ON fs.filial_id = vs.filial_id
       AND fs.data_referencia = vs.data_referencia
    ),
    calculado AS (
      SELECT
        setor_id,
        filial_id,
        data_referencia,
        ROUND(
          CASE
            WHEN COALESCE(valor_snapshot_filial, 0) > 0 AND participacao_receita IS NOT NULL THEN
              valor_snapshot_filial * participacao_receita
            ELSE valor_origem
          END::numeric,
          4
        ) AS valor,
        ROUND(valor_origem::numeric, 4) AS valor_origem,
        ROUND(custo_real::numeric, 4) AS custo_real,
        ROUND(custo_sem_icms::numeric, 4) AS custo_sem_icms,
        ROUND(custo_com_encargos::numeric, 4) AS custo_com_encargos,
        ROUND(custo_medio::numeric, 4) AS custo_medio,
        ROUND(custo_fiscal_medio::numeric, 4) AS custo_fiscal_medio,
        ROUND(quantidade_unidades_vendidas::numeric, 5) AS quantidade_unidades_vendidas,
        ROUND(COALESCE(percentual_quebra, 0)::numeric, 4) AS percentual_quebra,
        ROUND(
          COALESCE(
            CASE WHEN participacao_receita IS NOT NULL THEN valor_icms * participacao_receita END,
            0
          )::numeric,
          4
        ) AS valor_icms,
        ROUND(
          COALESCE(
            CASE WHEN participacao_receita IS NOT NULL THEN valor_piscofins * participacao_receita END,
            0
          )::numeric,
          4
        ) AS valor_piscofins,
        ROUND(
          COALESCE(
            CASE WHEN participacao_receita IS NOT NULL THEN valor_quebra * participacao_receita END,
            0
          )::numeric,
          4
        ) AS valor_quebra,
        ROUND(
          CASE
            WHEN custo_total_snapshot_filial IS NOT NULL AND participacao_receita IS NOT NULL THEN
              custo_total_snapshot_filial * participacao_receita
            ELSE custo_com_encargos
          END::numeric,
          4
        ) AS custo_total_ajustado,
        participacao_receita,
        snapshot_gravado_em
      FROM base
    ),
    final AS (
      SELECT
        setor_id,
        filial_id,
        data_referencia,
        valor,
        valor_origem,
        custo_real,
        custo_sem_icms,
        custo_com_encargos,
        custo_medio,
        custo_fiscal_medio,
        quantidade_unidades_vendidas,
        percentual_quebra,
        valor_icms,
        valor_piscofins,
        valor_quebra,
        custo_total_ajustado,
        ROUND((valor - custo_total_ajustado)::numeric, 4) AS lucro_ajustado,
        CASE
          WHEN valor > 0 THEN ROUND(((valor - custo_total_ajustado) / valor * 100)::numeric, 4)
          ELSE 0
        END AS margem_ajustada_percentual,
        ROUND(participacao_receita::numeric, 8) AS participacao_receita,
        snapshot_gravado_em
      FROM calculado
    ),
    upserted AS (
      INSERT INTO %1$I.vendas_setores_snapshot (
        setor_id,
        filial_id,
        data_referencia,
        valor,
        valor_origem,
        custo_real,
        custo_sem_icms,
        custo_com_encargos,
        custo_medio,
        custo_fiscal_medio,
        quantidade_unidades_vendidas,
        percentual_quebra,
        valor_icms,
        valor_piscofins,
        valor_quebra,
        custo_total_ajustado,
        lucro_ajustado,
        margem_ajustada_percentual,
        participacao_receita,
        snapshot_filial_gravado_em,
        updated_at
      )
      SELECT
        setor_id,
        filial_id,
        data_referencia,
        valor,
        valor_origem,
        custo_real,
        custo_sem_icms,
        custo_com_encargos,
        custo_medio,
        custo_fiscal_medio,
        quantidade_unidades_vendidas,
        percentual_quebra,
        valor_icms,
        valor_piscofins,
        valor_quebra,
        custo_total_ajustado,
        lucro_ajustado,
        margem_ajustada_percentual,
        participacao_receita,
        snapshot_gravado_em,
        now()
      FROM final
      ON CONFLICT (setor_id, filial_id, data_referencia) DO UPDATE SET
        valor = EXCLUDED.valor,
        valor_origem = EXCLUDED.valor_origem,
        custo_real = EXCLUDED.custo_real,
        custo_sem_icms = EXCLUDED.custo_sem_icms,
        custo_com_encargos = EXCLUDED.custo_com_encargos,
        custo_medio = EXCLUDED.custo_medio,
        custo_fiscal_medio = EXCLUDED.custo_fiscal_medio,
        quantidade_unidades_vendidas = EXCLUDED.quantidade_unidades_vendidas,
        percentual_quebra = EXCLUDED.percentual_quebra,
        valor_icms = EXCLUDED.valor_icms,
        valor_piscofins = EXCLUDED.valor_piscofins,
        valor_quebra = EXCLUDED.valor_quebra,
        custo_total_ajustado = EXCLUDED.custo_total_ajustado,
        lucro_ajustado = EXCLUDED.lucro_ajustado,
        margem_ajustada_percentual = EXCLUDED.margem_ajustada_percentual,
        participacao_receita = EXCLUDED.participacao_receita,
        snapshot_filial_gravado_em = EXCLUDED.snapshot_filial_gravado_em,
        updated_at = now()
      RETURNING 1
    )
    SELECT COUNT(*)::bigint FROM upserted
  $sql$, p_schema)
  INTO v_rows_upserted
  USING p_data_inicio, p_data_fim, p_filial_ids, p_setor_id, p_schema;

  RETURN jsonb_build_object(
    'success', true,
    'rows_deleted', v_rows_deleted,
    'rows_updated', v_rows_upserted,
    'rows_upserted', v_rows_upserted,
    'sales_source', 'api_filial_vendas',
    'profit_source', 'vendas_setores_snapshot',
    'periodo', jsonb_build_object(
      'data_inicio', p_data_inicio,
      'data_fim', p_data_fim
    )
  );
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao atualizar snapshot de vendas por setor (>90s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao atualizar snapshot de vendas por setor: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

-- 4. RPC de relatorio diario/setor usando vendas_setores_snapshot
CREATE OR REPLACE FUNCTION public.get_metas_setor_report_api_filial_vendas(
  p_schema text,
  p_setor_id bigint,
  p_mes integer,
  p_ano integer,
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
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  IF to_regclass(format('%I.metas_setor', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.metas_setor nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.vendas_setores_snapshot', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.vendas_setores_snapshot nao encontrada', p_schema;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;

  EXECUTE format($sql$
    WITH metas_base AS (
      SELECT
        ms.data,
        ms.dia_semana,
        ms.setor_id,
        ms.filial_id,
        COALESCE(b.descricao, 'Filial ' || ms.filial_id) AS filial_nome,
        ms.data_referencia,
        ms.dia_semana_ref,
        COALESCE(ms.valor_referencia, 0) AS valor_referencia,
        COALESCE(ms.meta_percentual, 0) AS meta_percentual,
        ms.meta_margem_percentual,
        COALESCE(ms.valor_meta, 0) AS valor_meta,
        COALESCE(vss.valor, 0) AS valor_realizado,
        COALESCE(vss.custo_total_ajustado, 0) AS custo_realizado,
        COALESCE(vss.lucro_ajustado, 0) AS lucro_realizado,
        COALESCE(
          vss.margem_ajustada_percentual,
          CASE
            WHEN COALESCE(vss.valor, 0) > 0 THEN
              COALESCE(vss.lucro_ajustado, 0) / COALESCE(vss.valor, 0) * 100
            ELSE 0
          END
        ) AS margem_realizada
      FROM %1$I.metas_setor ms
      LEFT JOIN %1$I.vendas_setores_snapshot vss
        ON vss.setor_id = ms.setor_id
       AND vss.filial_id = ms.filial_id
       AND vss.data_referencia = ms.data
      LEFT JOIN public.branches b
        ON b.branch_code = ms.filial_id::text
       AND b.tenant_id = (
         SELECT id
         FROM public.tenants
         WHERE supabase_schema = %2$L
         LIMIT 1
       )
      WHERE ms.setor_id = $1
        AND ms.data >= $2
        AND ms.data <= $3
        AND ($4 IS NULL OR ms.filial_id::bigint = ANY($4))
    ),
    datas AS (
      SELECT DISTINCT data, dia_semana
      FROM metas_base
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'data', d.data,
          'dia_semana', d.dia_semana,
          'sales_source', 'api_filial_vendas',
          'profit_source', 'vendas_setores_snapshot',
          'filiais', (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'filial_id', mb.filial_id,
                  'filial_nome', mb.filial_nome,
                  'data_referencia', mb.data_referencia,
                  'dia_semana_ref', mb.dia_semana_ref,
                  'valor_referencia', ROUND(mb.valor_referencia::numeric, 2),
                  'meta_percentual', ROUND(mb.meta_percentual::numeric, 2),
                  'meta_margem_percentual', ROUND(mb.meta_margem_percentual::numeric, 2),
                  'valor_meta', ROUND(mb.valor_meta::numeric, 2),
                  'valor_realizado', ROUND(mb.valor_realizado::numeric, 2),
                  'custo_realizado', ROUND(mb.custo_realizado::numeric, 2),
                  'lucro_realizado', ROUND(mb.lucro_realizado::numeric, 2),
                  'margem_realizada', ROUND(mb.margem_realizada::numeric, 2),
                  'diferenca', ROUND((mb.valor_realizado - mb.valor_meta)::numeric, 2),
                  'diferenca_percentual',
                    CASE
                      WHEN mb.valor_meta > 0 THEN
                        ROUND(((mb.valor_realizado - mb.valor_meta) / mb.valor_meta * 100)::numeric, 2)
                      ELSE 0
                    END,
                  'percentual_atingido',
                    CASE
                      WHEN mb.valor_meta > 0 THEN
                        ROUND((mb.valor_realizado / mb.valor_meta * 100)::numeric, 2)
                      ELSE 0
                    END,
                  'sales_source', 'api_filial_vendas',
                  'profit_source', 'vendas_setores_snapshot'
                )
                ORDER BY mb.filial_nome
              ),
              '[]'::jsonb
            )
            FROM metas_base mb
            WHERE mb.data = d.data
          )
        )
        ORDER BY d.data
      ),
      '[]'::jsonb
    )
    FROM datas d
  $sql$, p_schema, p_schema)
  INTO v_result
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids;

  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar metas por setor pela snapshot (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar metas por setor pela snapshot: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

-- 5. RPC de resumo por filial usando vendas_setores_snapshot
CREATE OR REPLACE FUNCTION public.get_metas_setor_summary_by_filial_api_filial_vendas(
  p_schema text,
  p_setor_id bigint,
  p_mes integer,
  p_ano integer,
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
  v_today date;
  v_current_month boolean;
BEGIN
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  IF to_regclass(format('%I.metas_setor', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.metas_setor nao encontrada', p_schema;
  END IF;

  IF to_regclass(format('%I.vendas_setores_snapshot', p_schema)) IS NULL THEN
    RAISE EXCEPTION 'Tabela %.vendas_setores_snapshot nao encontrada', p_schema;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := (v_date_start + interval '1 month' - interval '1 day')::date;
  v_today := current_date;
  v_current_month := extract(year from v_today) = p_ano AND extract(month from v_today) = p_mes;

  EXECUTE format($sql$
    WITH base AS (
      SELECT
        ms.filial_id,
        COALESCE(b.descricao, 'Filial ' || ms.filial_id) AS filial_nome,
        COALESCE(ms.valor_meta, 0) AS valor_meta,
        COALESCE(vss.valor, 0) AS valor_realizado,
        COALESCE(vss.lucro_ajustado, 0) AS lucro_realizado,
        COALESCE(
          vss.margem_ajustada_percentual,
          CASE
            WHEN COALESCE(vss.valor, 0) > 0 THEN
              COALESCE(vss.lucro_ajustado, 0) / COALESCE(vss.valor, 0) * 100
            ELSE 0
          END
        ) AS margem_realizada,
        ms.meta_margem_percentual,
        ms.data
      FROM %1$I.metas_setor ms
      LEFT JOIN %1$I.vendas_setores_snapshot vss
        ON vss.setor_id = ms.setor_id
       AND vss.filial_id = ms.filial_id
       AND vss.data_referencia = ms.data
      LEFT JOIN public.branches b
        ON b.branch_code = ms.filial_id::text
       AND b.tenant_id = (
         SELECT id
         FROM public.tenants
         WHERE supabase_schema = %2$L
         LIMIT 1
       )
      WHERE ms.setor_id = $1
        AND ms.data >= $2
        AND ms.data <= $3
        AND ($4 IS NULL OR ms.filial_id::bigint = ANY($4))
    ),
    resumido AS (
      SELECT
        filial_id,
        MAX(filial_nome) AS filial_nome,
        SUM(valor_meta) AS valor_meta,
        SUM(valor_realizado) AS valor_realizado,
        SUM(lucro_realizado) AS lucro_bruto,
        AVG(meta_margem_percentual) FILTER (WHERE meta_margem_percentual IS NOT NULL) AS meta_margem_percentual,
        SUM(
          CASE
            WHEN $5 = true AND data < $6 THEN valor_meta
            ELSE 0
          END
        ) AS valor_meta_acumulada_d1,
        COALESCE(
          SUM(COALESCE(margem_realizada, 0) * COALESCE(valor_realizado, 0))
            / NULLIF(SUM(CASE WHEN margem_realizada IS NOT NULL THEN COALESCE(valor_realizado, 0) ELSE 0 END), 0),
          CASE
            WHEN COALESCE(SUM(valor_realizado), 0) > 0 THEN
              COALESCE(SUM(lucro_realizado), 0) / COALESCE(SUM(valor_realizado), 0) * 100
            ELSE 0
          END
        ) AS margem_bruta
      FROM base
      GROUP BY filial_id
    )
    SELECT jsonb_build_object(
      'resumo',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'filial_id', filial_id,
            'filial_nome', filial_nome,
            'valor_meta', ROUND(valor_meta::numeric, 2),
            'valor_meta_acumulada_d1', ROUND(valor_meta_acumulada_d1::numeric, 2),
            'valor_realizado', ROUND(valor_realizado::numeric, 2),
            'percentual_atingido',
              CASE
                WHEN valor_meta > 0 THEN ROUND(((valor_realizado / valor_meta) * 100)::numeric, 2)
                ELSE 0
              END,
            'percentual_atingido_acumulado_d1',
              CASE
                WHEN valor_meta_acumulada_d1 > 0 THEN ROUND(((valor_realizado / valor_meta_acumulada_d1) * 100)::numeric, 2)
                ELSE 0
              END,
            'lucro_bruto', ROUND(lucro_bruto::numeric, 2),
            'meta_margem_percentual', ROUND(meta_margem_percentual::numeric, 2),
            'margem_bruta', ROUND(margem_bruta::numeric, 2)
          )
          ORDER BY filial_nome
        ),
        '[]'::jsonb
      ),
      'sales_source', 'api_filial_vendas',
      'profit_source', 'vendas_setores_snapshot'
    )
    FROM resumido
  $sql$, p_schema, p_schema)
  INTO v_result
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids, v_current_month, v_today;

  RETURN COALESCE(v_result, jsonb_build_object(
    'resumo', '[]'::jsonb,
    'sales_source', 'api_filial_vendas',
    'profit_source', 'vendas_setores_snapshot'
  ));
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar resumo mensal de metas por setor pela snapshot (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar resumo mensal de metas por setor pela snapshot: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$function$;

COMMENT ON FUNCTION public.refresh_vendas_setores_snapshot_api_filial_vendas(text, date, date, bigint, bigint[])
IS 'Materializa vendas_setores_snapshot por schema usando setores/departamentos e ajustes da vendas_filiais_snapshot.';

COMMENT ON FUNCTION public.get_metas_setor_report_api_filial_vendas(text, bigint, integer, integer, bigint[])
IS 'Metas por Setor - relatorio diario usando vendas_setores_snapshot quando enable_api_filial_vendas=true.';

COMMENT ON FUNCTION public.get_metas_setor_summary_by_filial_api_filial_vendas(text, bigint, integer, integer, bigint[])
IS 'Metas por Setor - resumo por filial usando vendas_setores_snapshot quando enable_api_filial_vendas=true.';
