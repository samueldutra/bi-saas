import type { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'

export async function hasTenantAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tenantId: string | null
): Promise<boolean> {
  if (!tenantId) return false

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, tenant_id')
    .eq('id', userId)
    .single() as { data: Pick<UserProfile, 'role' | 'tenant_id'> | null }

  if (!profile) {
    return false
  }

  if (profile.role === 'superadmin') {
    return true
  }

  if (profile.tenant_id === tenantId) {
    return true
  }

  const { data: access } = await supabase
    .from('user_tenant_access')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .limit(1)

  return (access?.length ?? 0) > 0
}
