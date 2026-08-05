-- meta_percentual era numeric(5,2) (máx 999.99), causando "numeric field overflow" (22003)
-- ao editar Valor Meta em filiais/dias com valor_referencia baixo, onde o percentual implícito
-- (valorMeta / valor_referencia) facilmente ultrapassa 999.99%. Ver src/app/api/metas/update/route.ts.

-- 1. Alarga a coluna em todos os schemas de tenants já provisionados
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
    EXECUTE format(
      'ALTER TABLE %I.metas_mensais ALTER COLUMN meta_percentual TYPE numeric(9, 2)',
      tenant_schema
    );
  END LOOP;
END $$;

-- 2. Atualiza o template usado para provisionar novos tenants
CREATE OR REPLACE FUNCTION public.create_metas_table_for_tenant(schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.metas_mensais (
      id bigserial PRIMARY KEY,
      filial_id bigint NOT NULL,
      data date NOT NULL,
      dia_semana text NOT NULL,
      meta_percentual numeric(9, 2) NOT NULL DEFAULT 0,
      data_referencia date NOT NULL,
      valor_referencia numeric(15, 2) DEFAULT 0,
      valor_meta numeric(15, 2) DEFAULT 0,
      valor_realizado numeric(15, 2) DEFAULT 0,
      diferenca numeric(15, 2) DEFAULT 0,
      diferenca_percentual numeric(5, 2) DEFAULT 0,
      situacao text DEFAULT ''pendente'',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT metas_mensais_unique_filial_data UNIQUE (filial_id, data)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_metas_mensais_filial_data
      ON %I.metas_mensais(filial_id, data);

    CREATE INDEX IF NOT EXISTS idx_metas_mensais_data
      ON %I.metas_mensais(data);

    -- Create trigger for updated_at
    CREATE TRIGGER on_metas_mensais_update
      BEFORE UPDATE ON %I.metas_mensais
      FOR EACH ROW
      EXECUTE FUNCTION handle_updated_at();
  ', schema_name, schema_name, schema_name, schema_name);
END;
$$;
