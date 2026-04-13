import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RpcResult<T> = {
  data: T | null
  error: { message?: string } | null
}

type ComprasReportResponse = Array<{
  data: string
  filial_id: number
  valor_meta_compras: number | null
  valor_realizado_compras: number
}>

type ComprasSummaryResponse = {
  resumo?: Array<{
    filial_id: number
    valor_meta_compras: number | null
    valor_realizado_compras: number
  }>
}

type RpcClient = {
  rpc: <T>(fn: string, params: Record<string, unknown>) => Promise<RpcResult<T>>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')
    const requestedFilialId = searchParams.get('filial_id')

    if (!schema || !mes || !ano) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
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
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id))

        if (ids.length > 0) {
          finalFilialIds = ids
        }
      }
    } else {
      if (!requestedFilialId) {
        finalFilialIds = authorizedBranches
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      } else {
        const requestedIds = requestedFilialId.split(',')
          .map((id) => id.trim())
          .filter((id) => authorizedBranches.includes(id))
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))

        if (requestedIds.length > 0) {
          finalFilialIds = requestedIds
        } else {
          finalFilialIds = authorizedBranches
            .map((id) => parseInt(id, 10))
            .filter((id) => !isNaN(id))
        }
      }
    }

    const params = {
      p_schema: schema,
      p_mes: parseInt(mes, 10),
      p_ano: parseInt(ano, 10),
      p_filial_id: null,
      p_filial_ids: finalFilialIds
    }

    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient() as unknown as RpcClient

    const [reportResult, summaryResult] = await Promise.all([
      directSupabase.rpc<ComprasReportResponse>('get_metas_mensais_compras_report', params),
      directSupabase.rpc<ComprasSummaryResponse>('get_metas_mensais_compras_summary_by_filial', params)
    ])

    const currentError = reportResult.error || summaryResult.error

    if (currentError) {
      console.error('[API/METAS/COMPRAS] RPC Error:', currentError)

      if (currentError.message && currentError.message.includes('does not exist')) {
        return NextResponse.json({
          report: [],
          resumo: []
        })
      }

      return NextResponse.json(
        { error: 'Erro ao buscar compras das metas mensais' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      report: Array.isArray(reportResult.data) ? reportResult.data : [],
      resumo: Array.isArray(summaryResult.data?.resumo) ? summaryResult.data.resumo : []
    })
  } catch (error) {
    console.error('[API/METAS/COMPRAS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
