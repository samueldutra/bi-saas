import { createClient } from '@/lib/supabase/server'
import { createDirectClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

type ReprocessPayload = {
  schema: string
  ano: number
  mes: number
  filiais: number[]
}

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
      .select('role')
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

    const body = (await request.json()) as Partial<ReprocessPayload>
    const schema = body.schema?.trim()
    const ano = body.ano
    const mes = body.mes
    const filiais = body.filiais?.map((f) => Number(f)).filter(Boolean) ?? []

    if (!schema) {
      return NextResponse.json({ error: 'schema é obrigatório' }, { status: 400 })
    }
    if (!ano || ano < 2000 || ano > 2100) {
      return NextResponse.json({ error: 'ano inválido' }, { status: 400 })
    }
    if (!mes || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'mes inválido' }, { status: 400 })
    }
    if (filiais.length === 0) {
      return NextResponse.json({ error: 'filiais é obrigatório' }, { status: 400 })
    }

    const admin = createDirectClient()
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
