import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  safeBadRequest,
  safeForbidden,
  safeNotFound,
  safeUnauthorized,
  safeErrorResponse,
} from '@/lib/api/error-handler'

type UserProfileRow = {
  id: string
  tenant_id: string | null
  full_name: string
  role: 'superadmin' | 'admin' | 'user' | 'viewer'
  is_active: boolean
}

type TenantRow = {
  id: string
  name: string
  slug: string
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)

    const tenantId = searchParams.get('tenantId')
    if (!tenantId) {
      return safeBadRequest('tenantId é obrigatório')
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return safeUnauthorized('Não autenticado')
    }

    const { data: requesterProfile } = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()) as {
      data: { role: 'superadmin' | 'admin' | 'user' | 'viewer' } | null
    }

    if (!requesterProfile) {
      return safeNotFound('Perfil não encontrado')
    }

    if (requesterProfile.role !== 'superadmin') {
      return safeForbidden('Apenas superadmins podem vincular usuários')
    }

    const { data: selectedTenant } = (await admin
      .from('tenants')
      .select('id, name, slug')
      .eq('id', tenantId)
      .maybeSingle()) as { data: TenantRow | null }

    if (!selectedTenant) {
      return safeNotFound('Tenant não encontrado')
    }

    const { data: existingAccessRows, error: accessError } = (await admin
      .from('user_tenant_access')
      .select('user_id')
      .eq('tenant_id', tenantId)) as {
      data: { user_id: string }[] | null
      error: Error | null
    }

    if (accessError) {
      return safeErrorResponse(accessError, 'linkable-users-access')
    }

    const blockedUserIds = new Set(existingAccessRows?.map((row) => row.user_id) || [])

    const { data: profiles, error: profilesError } = (await admin
      .from('user_profiles')
      .select('id, tenant_id, full_name, role, is_active')
      .in('role', ['admin', 'user'])
      .eq('is_active', true)
      .not('tenant_id', 'is', null)
      .neq('tenant_id', tenantId)) as {
      data: UserProfileRow[] | null
      error: Error | null
    }

    if (profilesError) {
      return safeErrorResponse(profilesError, 'linkable-users-profiles')
    }

    const filteredProfiles = (profiles || []).filter((profile) => !blockedUserIds.has(profile.id))
    const primaryTenantIds = Array.from(
      new Set(filteredProfiles.map((profile) => profile.tenant_id).filter(Boolean) as string[])
    )

    const { data: tenants } = primaryTenantIds.length > 0
      ? await admin
        .from('tenants')
        .select('id, name, slug')
        .in('id', primaryTenantIds) as { data: TenantRow[] | null }
      : { data: [] as TenantRow[] }

    const tenantsMap = new Map<string, TenantRow>()
    tenants?.forEach((tenant) => {
      tenantsMap.set(tenant.id, tenant)
    })

    const { data: authUsersData, error: authUsersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (authUsersError) {
      return safeErrorResponse(authUsersError, 'linkable-users-auth')
    }

    const emailsMap = new Map<string, string | null>()
    authUsersData.users.forEach((authUser) => {
      emailsMap.set(authUser.id, authUser.email || null)
    })

    const data = filteredProfiles
      .map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        is_active: profile.is_active,
        email: emailsMap.get(profile.id) || null,
        primary_tenant: profile.tenant_id ? tenantsMap.get(profile.tenant_id) || null : null,
      }))
      .sort((left, right) => left.full_name.localeCompare(right.full_name, 'pt-BR'))

    return NextResponse.json({
      tenant: selectedTenant,
      data,
    })
  } catch (error) {
    return safeErrorResponse(error, 'linkable-users')
  }
}
