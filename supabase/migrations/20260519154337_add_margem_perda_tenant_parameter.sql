-- Adiciona suporte a parâmetros numéricos em public.tenant_parameters.
-- O parâmetro margem_perda usa numeric(4,2), com default efetivo 0.00 no app.

ALTER TABLE public.tenant_parameters
  ADD COLUMN IF NOT EXISTS parameter_numeric_value numeric(4,2);

COMMENT ON COLUMN public.tenant_parameters.parameter_value IS
  'Valor booleano para parâmetros de feature. Para parâmetros numéricos, manter false.';

COMMENT ON COLUMN public.tenant_parameters.parameter_numeric_value IS
  'Valor numérico decimal para parâmetros não booleanos, como margem_perda.';

UPDATE public.tenant_parameters
SET parameter_numeric_value = 0.00
WHERE parameter_key = 'margem_perda'
  AND parameter_numeric_value IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_parameters_margem_perda_numeric_check'
      AND conrelid = 'public.tenant_parameters'::regclass
  ) THEN
    ALTER TABLE public.tenant_parameters
      ADD CONSTRAINT tenant_parameters_margem_perda_numeric_check
      CHECK (
        parameter_key <> 'margem_perda'
        OR (
          parameter_numeric_value IS NOT NULL
          AND parameter_numeric_value >= 0.00
          AND parameter_numeric_value <= 99.99
        )
      );
  END IF;
END $$;
