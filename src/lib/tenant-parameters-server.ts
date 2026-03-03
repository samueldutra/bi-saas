import { createDirectClient } from '@/lib/supabase/admin'

const ENABLE_FATURAMENTO_METAS_KEY = 'enable_faturamento_metas'

/**
 * Reads a boolean tenant parameter by schema using service-role client.
 * Returns false on any lookup error to keep legacy behavior safe.
 */
export async function isFaturamentoMetasEnabled(schema: string): Promise<boolean> {
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
      .eq('parameter_key', ENABLE_FATURAMENTO_METAS_KEY)
      .maybeSingle()

    if (parameterError) {
      return false
    }

    return parameter?.parameter_value === true
  } catch {
    return false
  }
}
