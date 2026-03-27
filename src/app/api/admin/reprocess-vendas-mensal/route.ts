import { createClient } from '@/lib/supabase/server'
import { createDirectClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isValidSchema, validateSchemaAccess } from '@/lib/security/validate-schema'
import { z } from 'zod'

const reprocessSchema = z.object({
  schema: z.string().min(1, 'schema é obrigatório').refine(isValidSchema, 'schema inválido'),
  ano: z.number().int().min(2000, 'ano inválido').max(2100, 'ano inválido'),
  mes: z.number().int().min(1, 'mes inválido').max(12, 'mes inválido'),
  filiais: z.array(z.coerce.number().int().positive()).min(1, 'filiais é obrigatório'),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Erro ao verificar perfil do usuário' },
        { status: 500 }
      )
    }

    const userRole = (profile as { role: string }).role
    if (!['superadmin', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Apenas admins podem reprocessar' },
        { status: 403 }
      )
    }

    const validation = reprocessSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema, ano, mes, filiais } = validation.data

    const hasSchemaAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasSchemaAccess) {
      return NextResponse.json(
        { error: 'Sem permissão para acessar este schema' },
        { status: 403 }
      )
    }

    const admin = createDirectClient()
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('supabase_schema', schema)
      .eq('is_active', true)
      .maybeSingle() as { data: { id: string } | null }

    if (!tenant) {
      return NextResponse.json(
        { error: 'Schema não encontrado' },
        { status: 404 }
      )
    }

    const filialCodes = filiais.map((filial) => String(filial))
    const { data: allowedBranches, error: branchesError } = await admin
      .from('branches')
      .select('branch_code')
      .eq('tenant_id', tenant.id)
      .in('branch_code', filialCodes) as { data: { branch_code: string }[] | null; error: Error | null }

    if (branchesError) {
      return NextResponse.json(
        { error: 'Erro ao validar filiais do tenant' },
        { status: 500 }
      )
    }

    const allowedCodes = new Set((allowedBranches || []).map((branch) => branch.branch_code))
    const invalidFiliais = filiais.filter((filial) => !allowedCodes.has(String(filial)))

    if (invalidFiliais.length > 0) {
      return NextResponse.json(
        { error: `Filiais inválidas para o schema informado: ${invalidFiliais.join(', ')}` },
        { status: 400 }
      )
    }

    const results: Array<{ filial: number; rows: number; error?: string }> = []

    for (const filial of filiais) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin as any).rpc('backfill_vendas_mensal_produto', {
        p_schema: schema,
        p_ano: ano,
        p_mes: mes,
        p_filial_id: filial,
      })

      if (error) {
        results.push({ filial, rows: 0, error: error.message })
        continue
      }

      results.push({ filial, rows: typeof data === 'number' ? data : 0 })
    }

    return NextResponse.json({
      success: true,
      schema,
      ano,
      mes,
      filiais,
      results,
    })
  } catch (error) {
    console.error('[Reprocess Vendas Mensal] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao reprocessar' },
      { status: 500 }
    )
  }
}
