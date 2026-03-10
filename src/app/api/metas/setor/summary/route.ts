import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const setorId = searchParams.get('setor_id')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')
    const requestedFilialId = searchParams.get('filial_id')

    if (!schema || !setorId || !mes || !ano) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios faltando' },
        { status: 400 }
      )
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    let finalFilialIds: number[] | null = null

    if (authorizedBranches === null) {
      if (requestedFilialId) {
        const ids = requestedFilialId.split(',')
          .map(id => parseInt(id.trim(), 10))
          .filter(id => !isNaN(id))

        if (ids.length > 0) {
          finalFilialIds = ids
        }
      }
    } else {
      if (authorizedBranches.length === 0) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso a nenhuma filial' },
          { status: 403 }
        )
      }

      if (!requestedFilialId) {
        finalFilialIds = authorizedBranches
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id))
      } else {
        const requestedIds = requestedFilialId.split(',')
          .map(id => id.trim())
          .filter(id => authorizedBranches.includes(id))
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id))

        if (requestedIds.length > 0) {
          finalFilialIds = requestedIds
        } else {
          finalFilialIds = authorizedBranches
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))
        }
      }
    }

    const params = {
      p_schema: schema,
      p_setor_id: parseInt(setorId, 10),
      p_mes: parseInt(mes, 10),
      p_ano: parseInt(ano, 10),
      p_filial_ids: finalFilialIds
    }

    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (directSupabase as any).rpc('get_metas_setor_summary_by_filial', params)

    if (error) {
      console.error('[API/METAS/SETOR/SUMMARY] RPC Error:', error)

      if (error.message && error.message.includes('does not exist')) {
        return NextResponse.json({ resumo: [] })
      }

      return NextResponse.json(
        { error: 'Erro ao buscar resumo mensal de metas por setor' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || { resumo: [] })
  } catch (error) {
    console.error('[API/METAS/SETOR/SUMMARY] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
