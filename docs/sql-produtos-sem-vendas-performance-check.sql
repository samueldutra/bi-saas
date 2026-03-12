-- =========================================================
-- Check de performance - Produtos sem Vendas
-- Ajuste schema/filial/setores/departamentos/produtos antes de rodar
-- =========================================================

-- 1) Atualizar estatísticas antes do explain
ANALYZE sol.produtos;
ANALYZE sol.vendas;
ANALYZE sol.vendas_hoje_itens;
ANALYZE sol.entradas;
ANALYZE sol.entradas_produtos;
ANALYZE sol.setores;
ANALYZE sol.departments_level_1;

-- 2) Cenário base: filial + sem filtro adicional
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.get_produtos_sem_vendas(
  'sol',
  '1',
  15,
  90,
  CURRENT_DATE,
  'all',
  'all',
  NULL,
  NULL,
  100,
  0
);

-- 3) Cenário por setor
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.get_produtos_sem_vendas(
  'sol',
  '1',
  15,
  90,
  CURRENT_DATE,
  'all',
  'setor',
  '24',
  NULL,
  100,
  0
);

-- 4) Cenário por departamento
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.get_produtos_sem_vendas(
  'sol',
  '1',
  15,
  90,
  CURRENT_DATE,
  'all',
  'departamento',
  '65',
  NULL,
  100,
  0
);

-- 5) Cenário por produto
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.get_produtos_sem_vendas(
  'sol',
  '1',
  15,
  90,
  CURRENT_DATE,
  'all',
  'produto',
  NULL,
  '573,12913,14043',
  100,
  0
);

-- 6) Inventário dos índices usados pelo relatório
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'sol'
  AND tablename IN ('produtos', 'vendas', 'vendas_hoje_itens', 'entradas', 'entradas_produtos')
  AND (
    indexname ILIKE '%produtos_sem_vendas%'
    OR indexname ILIKE '%vendas_ultima%'
    OR indexname ILIKE '%vendas_hoje_ultima%'
    OR indexname ILIKE '%entradas_produtos_produto_entrada%'
    OR indexname ILIKE '%entradas_filial_data_desc%'
  )
ORDER BY tablename, indexname;
