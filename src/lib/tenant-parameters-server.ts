import { createDirectClient } from '@/lib/supabase/admin'

const ENABLE_FATURAMENTO_METAS_KEY = 'enable_faturamento_metas'
const ENABLE_API_FILIAL_VENDAS_KEY = 'enable_api_filial_vendas'
const MARGEM_PERDA_KEY = 'margem_perda'

async function isTenantBooleanParameterEnabled(
  schema: string,
  parameterKey: string
): Promise<boolean> {
  try {
    const supabase = createDirectClient()

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('supabase_schema', schema)
      .eq('is_active', true)
      .maybeSingle()

    if (tenantError || !tenant?.id) {
      return false
    }

    const { data: parameter, error: parameterError } = await supabase
      .from('tenant_parameters')
      .select('parameter_value')
      .eq('tenant_id', tenant.id)
      .eq('parameter_key', parameterKey)
      .maybeSingle()

    if (parameterError) {
      return false
    }

    return parameter?.parameter_value === true
  } catch {
    return false
  }
}

async function getTenantNumericParameter(
  schema: string,
  parameterKey: string,
  defaultValue = 0
): Promise<number> {
  try {
    const supabase = createDirectClient()

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('supabase_schema', schema)
      .eq('is_active', true)
      .maybeSingle()

    if (tenantError || !tenant?.id) {
      return defaultValue
    }

    const { data: parameter, error: parameterError } = await supabase
      .from('tenant_parameters')
      .select('parameter_numeric_value')
      .eq('tenant_id', tenant.id)
      .eq('parameter_key', parameterKey)
      .maybeSingle()

    if (parameterError || parameter?.parameter_numeric_value == null) {
      return defaultValue
    }

    const parsedValue = Number(parameter.parameter_numeric_value)

    return Number.isFinite(parsedValue) ? parsedValue : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Reads a boolean tenant parameter by schema using service-role client.
 * Returns false on any lookup error to keep legacy behavior safe.
 */
export async function isFaturamentoMetasEnabled(schema: string): Promise<boolean> {
  return isTenantBooleanParameterEnabled(schema, ENABLE_FATURAMENTO_METAS_KEY)
}

/**
 * Reads whether Dashboard 360 should use the `/filial/vendas` snapshot source
 * instead of the legacy PDV aggregates.
 */
export async function isApiFilialVendasEnabled(schema: string): Promise<boolean> {
  return isTenantBooleanParameterEnabled(schema, ENABLE_API_FILIAL_VENDAS_KEY)
}

/**
 * Reads the default loss margin for profit-margin calculations by schema.
 * Returns 0.00 when the tenant or parameter row does not exist.
 */
export async function getMargemPerdaDefault(schema: string): Promise<number> {
  return getTenantNumericParameter(schema, MARGEM_PERDA_KEY, 0)
}
