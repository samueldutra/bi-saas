import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasTenantAccess } from '@/lib/security/tenant-access'
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
  avatar_url: string | null
  role: 'superadmin' | 'admin' | 'user' | 'viewer'
  can_switch_tenants: boolean
  is_active: boolean
  created_at: string
  updated_at: string
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

    const requestedTenantId = searchParams.get('tenantId')
    if (!requestedTenantId) {
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
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()) as {
      data: { role: 'superadmin' | 'admin' | 'user' | 'viewer'; tenant_id: string | null } | null
    }

    if (!requesterProfile) {
      return safeNotFound('Perfil não encontrado')
    }

    if (!['superadmin', 'admin'].includes(requesterProfile.role)) {
      return safeForbidden('Sem permissão')
    }

    if (requesterProfile.role === 'admin') {
      const canAccessTenant = await hasTenantAccess(supabase, user.id, requestedTenantId)
      if (!canAccessTenant) {
        return safeForbidden('Sem permissão para acessar este tenant')
      }
    }

    const { data: selectedTenant } = (await admin
      .from('tenants')
      .select('id, name, slug')
      .eq('id', requestedTenantId)
      .maybeSingle()) as { data: TenantRow | null }

    if (!selectedTenant) {
      return safeNotFound('Tenant não encontrado')
    }

    const { data: accessRows, error: accessError } = (await admin
      .from('user_tenant_access')
      .select('user_id, created_at')
      .eq('tenant_id', requestedTenantId)) as {
      data: { user_id: string; created_at: string }[] | null
      error: Error | null
    }

    if (accessError) {
      return safeErrorResponse(accessError, 'users-by-tenant-access')
    }

    const linkedAccessMap = new Map<string, string>()
    accessRows?.forEach((row) => {
      linkedAccessMap.set(row.user_id, row.created_at)
    })

    const { data: primaryProfiles, error: primaryError } = (await admin
      .from('user_profiles')
      .select('id, tenant_id, full_name, avatar_url, role, can_switch_tenants, is_active, created_at, updated_at')
      .eq('tenant_id', requestedTenantId)) as {
      data: UserProfileRow[] | null
      error: Error | null
    }

    if (primaryError) {
      return safeErrorResponse(primaryError, 'users-by-tenant-primary')
    }

    const linkedUserIds = Array.from(linkedAccessMap.keys())
    const { data: linkedProfiles, error: linkedError } = linkedUserIds.length > 0
      ? await admin
        .from('user_profiles')
        .select('id, tenant_id, full_name, avatar_url, role, can_switch_tenants, is_active, created_at, updated_at')
        .in('id', linkedUserIds) as {
          data: UserProfileRow[] | null
          error: Error | null
        }
      : { data: [], error: null }

    if (linkedError) {
      return safeErrorResponse(linkedError, 'users-by-tenant-linked')
    }

    const { data: superAdmins, error: superadminError } = requesterProfile.role === 'superadmin'
      ? await admin
        .from('user_profiles')
        .select('id, tenant_id, full_name, avatar_url, role, can_switch_tenants, is_active, created_at, updated_at')
        .eq('role', 'superadmin') as {
          data: UserProfileRow[] | null
          error: Error | null
        }
      : { data: [], error: null }

    if (superadminError) {
      return safeErrorResponse(superadminError, 'users-by-tenant-superadmins')
    }

    const allProfiles = [
      ...(primaryProfiles || []),
      ...(linkedProfiles || []),
      ...(superAdmins || []),
    ]

    const primaryTenantIds = Array.from(
      new Set(allProfiles.map((profile) => profile.tenant_id).filter(Boolean) as string[])
    )

    const { data: primaryTenants } = primaryTenantIds.length > 0
      ? await admin
        .from('tenants')
        .select('id, name, slug')
        .in('id', primaryTenantIds) as { data: TenantRow[] | null }
      : { data: [] as TenantRow[] }

    const tenantsMap = new Map<string, TenantRow>()
    primaryTenants?.forEach((tenant) => {
      tenantsMap.set(tenant.id, tenant)
    })

    const usersMap = new Map<string, UserProfileRow & {
      access_type: 'primary' | 'linked' | 'superadmin'
      linked_at: string | null
      primary_tenant: TenantRow | null
    }>()

    for (const profile of primaryProfiles || []) {
      usersMap.set(profile.id, {
        ...profile,
        access_type: profile.role === 'superadmin' ? 'superadmin' : 'primary',
        linked_at: null,
        primary_tenant: profile.tenant_id ? tenantsMap.get(profile.tenant_id) || null : null,
      })
    }

    for (const profile of linkedProfiles || []) {
      if (profile.role === 'superadmin') {
        continue
      }

      if (profile.tenant_id === requestedTenantId) {
        continue
      }

      if (usersMap.has(profile.id)) {
        continue
      }

      usersMap.set(profile.id, {
        ...profile,
        access_type: 'linked',
        linked_at: linkedAccessMap.get(profile.id) || null,
        primary_tenant: profile.tenant_id ? tenantsMap.get(profile.tenant_id) || null : null,
      })
    }

    if (requesterProfile.role === 'superadmin') {
      for (const profile of superAdmins || []) {
        usersMap.set(profile.id, {
          ...profile,
          access_type: 'superadmin',
          linked_at: null,
          primary_tenant: null,
        })
      }
    }

    const data = Array.from(usersMap.values()).sort((left, right) => {
      if (left.access_type === 'superadmin' && right.access_type !== 'superadmin') return -1
      if (left.access_type !== 'superadmin' && right.access_type === 'superadmin') return 1
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })

    return NextResponse.json({
      tenant: selectedTenant,
      data,
    })
  } catch (error) {
    return safeErrorResponse(error, 'users-by-tenant')
  }
}
