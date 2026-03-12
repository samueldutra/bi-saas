-- =========================================================
-- Refresh do cache do relatorio Produtos sem Vendas
-- =========================================================

-- Rebuild completo do tenant
SELECT public.refresh_produtos_sem_vendas_cache('sol');

-- Ou rebuild de uma filial especifica
-- SELECT public.refresh_produtos_sem_vendas_cache('sol', 1);

-- Verificar volume do cache
SELECT
  COUNT(*) AS total_linhas,
  COUNT(DISTINCT filial_id) AS filiais,
  MIN(updated_at) AS menor_updated_at,
  MAX(updated_at) AS maior_updated_at
FROM sol.ultima_venda_produto_filial;

-- Teste de performance apos cache
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
