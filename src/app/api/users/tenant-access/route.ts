import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { hasTenantAccess } from '@/lib/security/tenant-access'
import type { Database } from '@/types/database.types'

function normalizeTenantIds(tenantId?: string, tenantIds?: string[]) {
  const list = [...(tenantIds || []), ...(tenantId ? [tenantId] : [])]
  return Array.from(new Set(list.filter(Boolean)))
}

async function getAccessibleTenantIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  profileTenantId: string | null
) {
  const tenantIds = new Set<string>()
  if (profileTenantId) {
    tenantIds.add(profileTenantId)
  }

  const { data: accessRows } = await supabase
    .from('user_tenant_access')
    .select('tenant_id')
    .eq('user_id', userId) as { data: { tenant_id: string }[] | null }

  accessRows?.forEach((row) => tenantIds.add(row.tenant_id))
  return Array.from(tenantIds)
}

// GET - Listar acessos de tenant de um usuário
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    const userId = targetUserId || user.id

    if (userId !== user.id && !['admin', 'superadmin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    let query = supabase
      .from('user_tenant_access')
      .select('id, user_id, tenant_id, granted_at, granted_by, created_at, tenant:tenants(id, name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (currentProfile.role === 'admin') {
      const accessibleTenantIds = await getAccessibleTenantIds(supabase, user.id, currentProfile.tenant_id)
      if (accessibleTenantIds.length === 0) {
        return NextResponse.json({ data: [] })
      }
      query = query.in('tenant_id', accessibleTenantIds)
    }

    const { data, error } = await query

    if (error) {
      return safeErrorResponse(error, 'user-tenant-access')
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST - Conceder acessos de tenant
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile || !['admin', 'superadmin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, tenantId, tenantIds } = body as { userId?: string; tenantId?: string; tenantIds?: string[] }

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }

    const normalizedTenantIds = normalizeTenantIds(tenantId, tenantIds)

    if (normalizedTenantIds.length === 0) {
      return NextResponse.json({ error: 'tenantId ou tenantIds é obrigatório' }, { status: 400 })
    }

    if (currentProfile.role === 'admin') {
      for (const id of normalizedTenantIds) {
        const canGrant = await hasTenantAccess(supabase, user.id, id)
        if (!canGrant) {
          return NextResponse.json({ error: 'Admin só pode conceder acesso a tenants acessíveis' }, { status: 403 })
        }
      }
    }

    const { data: existingAccess } = await supabase
      .from('user_tenant_access')
      .select('tenant_id')
      .eq('user_id', userId)
      .in('tenant_id', normalizedTenantIds) as { data: { tenant_id: string }[] | null }

    const existingIds = new Set(existingAccess?.map((row) => row.tenant_id) || [])
    const toInsert = normalizedTenantIds.filter((id) => !existingIds.has(id))

    if (toInsert.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const insertPayload: Database['public']['Tables']['user_tenant_access']['Insert'][] = toInsert.map((id) => ({
      user_id: userId,
      tenant_id: id,
      granted_by: user.id,
    }))

    const { data, error } = await supabase
      .from('user_tenant_access')
      .insert(insertPayload)
      .select()

    if (error) {
      return safeErrorResponse(error, 'user-tenant-access')
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE - Remover acesso de tenant
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const tenantId = searchParams.get('tenantId')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile || !['admin', 'superadmin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'userId e tenantId são obrigatórios' }, { status: 400 })
    }

    if (currentProfile.role === 'admin') {
      const canRevoke = await hasTenantAccess(supabase, user.id, tenantId)
      if (!canRevoke) {
        return NextResponse.json({ error: 'Admin só pode remover acesso de tenants acessíveis' }, { status: 403 })
      }
    }

    const { error } = await supabase
      .from('user_tenant_access')
      .delete()
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)

    if (error) {
      return safeErrorResponse(error, 'user-tenant-access')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
