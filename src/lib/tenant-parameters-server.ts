import { createDirectClient } from '@/lib/supabase/admin'

const ENABLE_FATURAMENTO_METAS_KEY = 'enable_faturamento_metas'
const ENABLE_API_FILIAL_VENDAS_KEY = 'enable_api_filial_vendas'

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
