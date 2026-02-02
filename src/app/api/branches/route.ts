// import { type BranchInsert } from '@/types'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { z } from 'zod'
import { hasTenantAccess } from '@/lib/security/tenant-access'

const branchSchema = z.object({
  tenant_id: z.string().uuid('ID do tenant deve ser um UUID válido'),
  branch_code: z.string().min(1, 'Código da filial é obrigatório').max(20, 'Código da filial muito longo'),
  store_code: z.string().max(20).nullable().optional(),
  descricao: z.string().max(255).nullable().optional(),
  cep: z.string().regex(/^\d{8}$|^\d{5}-\d{3}$/, 'CEP inválido').nullable().optional(),
  rua: z.string().max(255).nullable().optional(),
  numero: z.string().max(20).nullable().optional(),
  bairro: z.string().max(100).nullable().optional(),
  cidade: z.string().max(100).nullable().optional(),
  estado: z.string().length(2, 'Estado deve ter 2 caracteres').nullable().optional(),
})

const branchUpdateSchema = branchSchema.partial().required({ tenant_id: true })

// GET - Listar filiais de uma empresa
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id é obrigatório' }, { status: 400 })
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get user's authorized branches
    const { data: authorizedBranches } = await supabase
      .from('user_authorized_branches')
      .select('branch_id')
      .eq('user_id', user.id) as { data: { branch_id: string }[] | null }

    // Get branches
    let query = supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('branch_code', { ascending: true })

    // If user has authorized branches restrictions, filter by them
    if (authorizedBranches && authorizedBranches.length > 0) {
      const authorizedBranchIds = authorizedBranches.map(ab => ab.branch_id)
      query = query.in('id', authorizedBranchIds)
    }

    const { data: branches, error } = await query

    if (error) {
      console.error('Error fetching branches:', error)
      return safeErrorResponse(error, 'branches')
    }

    return NextResponse.json({ branches })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST - Criar nova filial
// POST - Criar nova filial
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get current user profile
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile || !['superadmin', 'admin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()

    // Validar dados com Zod
    const validation = branchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { tenant_id, branch_code, store_code, descricao, cep, rua, numero, bairro, cidade, estado } = validation.data

    // Validate permissions
    if (currentProfile.role === 'admin') {
      const canManage = await hasTenantAccess(supabase, user.id, tenant_id)
      if (!canManage) {
        return NextResponse.json({ error: 'Admin só pode criar filiais em tenants acessíveis' }, { status: 403 })
      }
    }

    // Check if branch_code already exists for this tenant
    const { data: existingBranch } = await supabase
      .from('branches')
      .select('branch_code')
      .eq('branch_code', branch_code)
      .eq('tenant_id', tenant_id)
      .single()

    if (existingBranch) {
      return NextResponse.json({
        error: 'Este código de filial já está cadastrado para esta empresa'
      }, { status: 400 })
    }

    const newBranch = {
      tenant_id,
      branch_code,
      store_code: store_code || null,
      descricao: descricao || null,
      cep: cep || null,
      rua: rua || null,
      numero: numero || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
    }

    // Create branch
    const { data: branch, error } = await supabase
      .from('branches')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(newBranch as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating branch:', error)
      return safeErrorResponse(error, 'branches')
    }

    return NextResponse.json({ success: true, branch })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE - Deletar filial
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const branchCode = searchParams.get('branch_code')
    const tenantId = searchParams.get('tenant_id')

    if (!branchCode || !tenantId) {
      return NextResponse.json({ error: 'branch_code e tenant_id são obrigatórios' }, { status: 400 })
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get current user profile
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile || !['superadmin', 'admin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Get branch to check tenant - filter by both branch_code AND tenant_id
    const { data: branch } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('branch_code', branchCode)
      .eq('tenant_id', tenantId)
      .single()

    if (!branch) {
      return NextResponse.json({ error: 'Filial não encontrada' }, { status: 404 })
    }

    // Validate permissions
    if (currentProfile.role === 'admin') {
      const canManage = await hasTenantAccess(supabase, user.id, tenantId)
      if (!canManage) {
        return NextResponse.json({ error: 'Admin só pode deletar filiais em tenants acessíveis' }, { status: 403 })
      }
    }

    // Delete branch - filter by both branch_code AND tenant_id
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('branch_code', branchCode)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('Error deleting branch:', error)
      return safeErrorResponse(error, 'branches')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH - Atualizar filial
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const branchCode = searchParams.get('branch_code')

    if (!branchCode) {
      return NextResponse.json({ error: 'branch_code é obrigatório' }, { status: 400 })
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get current user profile
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile || !['superadmin', 'admin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Parse body first to get tenant_id
    const body = await request.json()

    // Validar dados com Zod
    const validation = branchUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { tenant_id, store_code, descricao, cep, rua, numero, bairro, cidade, estado } = validation.data

    // Get branch to check tenant - filter by both branch_code AND tenant_id
    const { data: existingBranch } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('branch_code', branchCode)
      .eq('tenant_id', tenant_id)
      .single()

    if (!existingBranch) {
      return NextResponse.json({ error: 'Filial não encontrada' }, { status: 404 })
    }

    // Validate permissions
    if (currentProfile.role === 'admin') {
      const canManage = await hasTenantAccess(supabase, user.id, tenant_id)
      if (!canManage) {
        return NextResponse.json({ error: 'Admin só pode editar filiais em tenants acessíveis' }, { status: 403 })
      }
    }

    // Update branch - filter by both branch_code AND tenant_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase.from('branches') as any).update({
      store_code: store_code || null,
      descricao: descricao || null,
      cep: cep || null,
      rua: rua || null,
      numero: numero || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      updated_at: new Date().toISOString(),
    })
      .eq('branch_code', branchCode)
      .eq('tenant_id', tenant_id)
      .select()
      .single()
    
    const { data: branch, error } = result as { 
      data: Record<string, unknown> | null; 
      error: { message: string } | null 
    }

    if (error) {
      console.error('Error updating branch:', error)
      return safeErrorResponse(error, 'branches')
    }

    return NextResponse.json({ success: true, branch })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
