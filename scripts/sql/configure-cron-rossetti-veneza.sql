-- Configura os pipelines diarios de Rossetti e Veneza.
-- Horarios do pg_cron em UTC:
--   Rossetti: 17:00-17:54 UTC (14:00-14:54 America/Sao_Paulo)
--   Veneza:   18:00-18:54 UTC (15:00-15:54 America/Sao_Paulo)
--
-- Bootstrap obrigatorio antes da primeira execucao do job de Veneza:
--   REFRESH MATERIALIZED VIEW veneza.mv_dias_com_venda;
--   REFRESH MATERIALIZED VIEW veneza.vw_report_curva_abcd;
-- A primeira carga nao aceita CONCURRENTLY. Depois dela, o job abaixo pode
-- usar CONCURRENTLY porque as duas views possuem indices unicos validos.
--
-- cron.schedule com job_name atualiza o job existente com o mesmo nome
-- e cria o job quando ele ainda nao existe.

SET ROLE postgres;

BEGIN;

-- Rossetti: filiais com dados 1, 2, 3 e 5.
SELECT cron.schedule(
  'refresh_mv_dias_com_venda(rossetti)',
  '0 17 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY rossetti.mv_dias_com_venda;$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(rossetti_1)',
  '3 17 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('rossetti', 1);$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(rossetti_2)',
  '6 17 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('rossetti', 2);$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(rossetti_3)',
  '9 17 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('rossetti', 3);$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(rossetti_5)',
  '12 17 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('rossetti', 5);$$
);

-- Corrige o job existente que estava sem SELECT.
SELECT cron.schedule(
  'refresh_vendas_agregadas_30d(rossetti)',
  '15 17 * * *',
  $$SELECT public.refresh_vendas_agregadas_30d('rossetti');$$
);

SELECT cron.schedule(
  'refresh_vendas_agregadas_60d(rossetti)',
  '18 17 * * *',
  $$SELECT public.refresh_vendas_agregadas_60d('rossetti');$$
);

SELECT cron.schedule(
  'calcular_venda_media_diaria_60d(rossetti)',
  '21 17 * * *',
  $$SELECT public.calcular_venda_media_diaria_60d('rossetti');$$
);

SELECT cron.schedule(
  'atualizar_dias_de_estoque(rossetti)',
  '24 17 * * *',
  $$SELECT public.atualizar_dias_de_estoque('rossetti', ARRAY[1, 2, 3, 5]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(rossetti_1)',
  '27 17 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('rossetti', ARRAY[1]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(rossetti_2)',
  '30 17 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('rossetti', ARRAY[2]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(rossetti_3)',
  '33 17 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('rossetti', ARRAY[3]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(rossetti_5)',
  '36 17 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('rossetti', ARRAY[5]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(rossetti_1)',
  '39 17 * * *',
  $$SELECT public.atualizar_curva_lucro('rossetti', ARRAY[1]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(rossetti_2)',
  '42 17 * * *',
  $$SELECT public.atualizar_curva_lucro('rossetti', ARRAY[2]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(rossetti_3)',
  '45 17 * * *',
  $$SELECT public.atualizar_curva_lucro('rossetti', ARRAY[3]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(rossetti_5)',
  '48 17 * * *',
  $$SELECT public.atualizar_curva_lucro('rossetti', ARRAY[5]);$$
);

SELECT cron.schedule(
  'refresh_report_curva_abcd(rossetti)',
  '51 17 * * *',
  $$SELECT public.refresh_report_curva_abcd('rossetti');$$
);

SELECT cron.schedule(
  'vendas_mensal_auto(rossetti)',
  '54 17 * * *',
  $$SELECT public.run_vendas_mensal_auto('rossetti', ARRAY[1, 2, 3, 5], 1);$$
);

-- Veneza: filiais 11, 65, 70 e 71.
SELECT cron.schedule(
  'refresh_mv_dias_com_venda(veneza)',
  '0 18 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY veneza.mv_dias_com_venda;$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(veneza_11)',
  '3 18 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('veneza', 11);$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(veneza_65)',
  '6 18 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('veneza', 65);$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(veneza_70)',
  '9 18 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('veneza', 70);$$
);

SELECT cron.schedule(
  'atualizar_produtos_mv_dias_com_venda(veneza_71)',
  '12 18 * * *',
  $$SELECT public.atualizar_produtos_com_dias_de_venda('veneza', 71);$$
);

SELECT cron.schedule(
  'refresh_vendas_agregadas_30d(veneza)',
  '15 18 * * *',
  $$SELECT public.refresh_vendas_agregadas_30d('veneza');$$
);

SELECT cron.schedule(
  'refresh_vendas_agregadas_60d(veneza)',
  '18 18 * * *',
  $$SELECT public.refresh_vendas_agregadas_60d('veneza');$$
);

SELECT cron.schedule(
  'calcular_venda_media_diaria_60d(veneza)',
  '21 18 * * *',
  $$SELECT public.calcular_venda_media_diaria_60d('veneza');$$
);

SELECT cron.schedule(
  'atualizar_dias_de_estoque(veneza)',
  '24 18 * * *',
  $$SELECT public.atualizar_dias_de_estoque('veneza', ARRAY[11, 65, 70, 71]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(veneza_11)',
  '27 18 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('veneza', ARRAY[11]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(veneza_65)',
  '30 18 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('veneza', ARRAY[65]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(veneza_70)',
  '33 18 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('veneza', ARRAY[70]);$$
);

SELECT cron.schedule(
  'atualizar_curva_abcd_30d(veneza_71)',
  '36 18 * * *',
  $$SELECT public.atualizar_curva_abcd_30d('veneza', ARRAY[71]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(veneza_11)',
  '39 18 * * *',
  $$SELECT public.atualizar_curva_lucro('veneza', ARRAY[11]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(veneza_65)',
  '42 18 * * *',
  $$SELECT public.atualizar_curva_lucro('veneza', ARRAY[65]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(veneza_70)',
  '45 18 * * *',
  $$SELECT public.atualizar_curva_lucro('veneza', ARRAY[70]);$$
);

SELECT cron.schedule(
  'atualizar_curva_lucro(veneza_71)',
  '48 18 * * *',
  $$SELECT public.atualizar_curva_lucro('veneza', ARRAY[71]);$$
);

SELECT cron.schedule(
  'refresh_report_curva_abcd(veneza)',
  '51 18 * * *',
  $$SELECT public.refresh_report_curva_abcd('veneza');$$
);

SELECT cron.schedule(
  'vendas_mensal_auto(veneza)',
  '54 18 * * *',
  $$SELECT public.run_vendas_mensal_auto('veneza', ARRAY[11, 65, 70, 71], 1);$$
);

COMMIT;

-- Validacao apos a execucao.
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE command ILIKE '%''rossetti''%'
   OR command ILIKE '%rossetti.%'
   OR command ILIKE '%''veneza''%'
   OR command ILIKE '%veneza.%'
ORDER BY
  split_part(schedule, ' ', 2)::int,
  split_part(schedule, ' ', 1)::int,
  jobid;
