-- Backfill helper for vendas_mensal_produto (one month + one filial)
CREATE OR REPLACE FUNCTION public.backfill_vendas_mensal_produto(
  p_schema text,
  p_ano integer,
  p_mes integer,
  p_filial_id bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_start date;
  v_end date;
  v_rows bigint;
BEGIN
  v_start := make_date(p_ano, p_mes, 1);
  v_end := (v_start + interval '1 month')::date;

  EXECUTE format('
    INSERT INTO %I.vendas_mensal_produto (
      ano, mes, filial_id, id_produto, total_qtde, total_valor_vendas, total_lucro
    )
    SELECT
      $4::smallint as ano,
      $5::smallint as mes,
      filial_id,
      id_produto,
      SUM(quantidade) as total_qtde,
      SUM(valor_vendas) as total_valor_vendas,
      SUM(COALESCE(valor_vendas, 0) - (COALESCE(custo_compra, 0) * COALESCE(quantidade, 0))) as total_lucro
    FROM %I.vendas
    WHERE data_venda >= $1
      AND data_venda < $2
      AND valor_vendas > 0
      AND filial_id = $3
    GROUP BY 1,2,3,4
    ON CONFLICT (ano, mes, filial_id, id_produto) DO UPDATE
    SET
      total_qtde = EXCLUDED.total_qtde,
      total_valor_vendas = EXCLUDED.total_valor_vendas,
      total_lucro = EXCLUDED.total_lucro
  ', p_schema, p_schema)
  USING v_start, v_end, p_filial_id, p_ano, p_mes;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;

ALTER FUNCTION public.backfill_vendas_mensal_produto(text, integer, integer, bigint)
  SET search_path = public;
