-- =========================================================
-- Indices pesados - rodar manualmente no Supabase SQL Editor
-- Fora de migration transacional
-- =========================================================

-- Schema atual: sol
-- Ajuste se necessario para outro tenant

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendas_filial_produto_data_desc
ON sol.vendas USING btree (filial_id, id_produto, data_venda DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vhi_filial_produto_data_desc
ON sol.vendas_hoje_itens USING btree (filial_id, produto_id, data_extracao DESC)
WHERE cancelado = false;

-- Verificacao
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'sol'
  AND indexname IN (
    'idx_vendas_filial_produto_data_desc',
    'idx_vhi_filial_produto_data_desc'
  )
ORDER BY indexname;
