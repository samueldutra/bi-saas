DROP FUNCTION IF EXISTS public.get_despesas_hierarquia(text, integer, date, date, text);

CREATE FUNCTION public.get_despesas_hierarquia(
  p_schema text,
  p_filial_id integer,
  p_data_inicial date,
  p_data_final date,
  p_tipo_data text DEFAULT 'data_despesa'
) RETURNS TABLE(
  dept_id integer,
  dept_descricao text,
  tipo_id integer,
  tipo_descricao text,
  data_despesa date,
  data_emissao date,
  descricao_despesa text,
  id_fornecedor integer,
  numero_nota bigint,
  serie_nota character varying,
  valor numeric,
  usuario character varying,
  observacao text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    '
      SELECT
        d.id AS dept_id,
        d.descricao AS dept_descricao,
        td.id AS tipo_id,
        td.descricao AS tipo_descricao,
        desp.data_despesa,
        desp.data_emissao,
        desp.descricao_despesa AS descricao_despesa,
        desp.id_fornecedor,
        desp.numero_nota,
        desp.serie_nota,
        desp.valor,
        desp.usuario,
        desp.observacao
      FROM %I.despesas desp
      INNER JOIN %I.tipos_despesa td ON desp.id_tipo_despesa = td.id
      INNER JOIN %I.departamentos_nivel1 d ON td.departamentalizacao_nivel1 = d.id
      WHERE desp.filial_id = $1
        AND (
          ($4 = ''data_emissao'' AND desp.data_emissao BETWEEN $2 AND $3)
          OR
          (($4 IS NULL OR $4 <> ''data_emissao'') AND desp.data_despesa BETWEEN $2 AND $3)
        )
      ORDER BY d.descricao, td.descricao,
        CASE WHEN $4 = ''data_emissao'' THEN desp.data_emissao ELSE desp.data_despesa END DESC
    ',
    p_schema, p_schema, p_schema
  )
  USING p_filial_id, p_data_inicial, p_data_final, p_tipo_data;
END;
$$;

COMMENT ON FUNCTION public.get_despesas_hierarquia(
  p_schema text,
  p_filial_id integer,
  p_data_inicial date,
  p_data_final date,
  p_tipo_data text
) IS 'Retorna despesas hierárquicas agrupadas por departamento e tipo. Expõe data_despesa e data_emissao e usa p_tipo_data para escolher o campo de filtro.';

GRANT EXECUTE ON FUNCTION public.get_despesas_hierarquia(TEXT, INTEGER, DATE, DATE, TEXT)
TO authenticated, service_role;
