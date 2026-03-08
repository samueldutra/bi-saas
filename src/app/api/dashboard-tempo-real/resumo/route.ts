import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  callRealtimeRpc,
  calculatePercentage,
  createRealtimeRouteMonitor,
  getAuthorizedRealtimeFiliais,
  getRealtimeCurrentDate,
  getRealtimeDirectClient,
  parseRealtimeNumber,
} from '@/lib/dashboard-tempo-real/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// FORCAR ROTA DINAMICA - NAO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

const querySchema = z.object({
  schema: z.string().min(1),
  filiais: z.string().optional(),
})

export async function GET(req: Request) {
  const monitor = createRealtimeRouteMonitor('API/DASHBOARD-TEMPO-REAL/RESUMO')

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    monitor.mark('auth')

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = querySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }
    monitor.mark('validation')

    const { schema: requestedSchema, filiais } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    monitor.mark('schema_access')

    const finalFiliais = await getAuthorizedRealtimeFiliais(supabase, user.id, filiais)
    monitor.mark('authorized_filiais', { count: finalFiliais?.length ?? 0 })

    const currentDate = getRealtimeCurrentDate()

    let receitaTotal = 0
    let qtdeCupons = 0
    let cancelamentos = 0
    let qtdeSkus = 0
    let metaDia = 0
    let descontos = 0
    let cancelamentosQtdeSkus = 0

    let ultimaAtualizacao: string | null = null

    const { data: resumoRpcData, error: resumoRpcError } = await callRealtimeRpc<{
      receita_total: number | string | null
      qtde_cupons: number | string | null
      cancelamentos: number | string | null
      cancelamentos_qtde_skus: number | string | null
      qtde_skus: number | string | null
      ultima_atualizacao: string | null
    }>(
      supabase,
      'get_dashboard_tempo_real_resumo',
      {
        p_schema: requestedSchema,
        p_data_extracao: currentDate,
        p_filial_ids: finalFiliais && finalFiliais.length > 0 ? finalFiliais : null,
      }
    )

    if (resumoRpcError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/RESUMO] RPC Error:', resumoRpcError.message)
      return NextResponse.json(
        { error: 'Error fetching resumo data' },
        { status: 500 }
      )
    }

    const resumoRpcRow = resumoRpcData && resumoRpcData.length > 0 ? resumoRpcData[0] : null
    receitaTotal = Number(resumoRpcRow?.receita_total || 0)
    qtdeCupons = Number(resumoRpcRow?.qtde_cupons || 0)
    cancelamentos = Number(resumoRpcRow?.cancelamentos || 0)
    cancelamentosQtdeSkus = Number(resumoRpcRow?.cancelamentos_qtde_skus || 0)
    qtdeSkus = Number(resumoRpcRow?.qtde_skus || 0)
    ultimaAtualizacao = resumoRpcRow?.ultima_atualizacao || null
    monitor.mark('rpc_resumo', { rows: resumoRpcData?.length ?? 0 })

    // Query meta do dia
    const directSupabase = getRealtimeDirectClient()
    try {
      let metaQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('metas_mensais')
        .select('valor_meta')
        .eq('data', currentDate)

      if (finalFiliais && finalFiliais.length > 0) {
        metaQuery = metaQuery.in('filial_id', finalFiliais)
      }

      const { data: metaData, error: metaError } = await metaQuery

      if (metaError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Meta Query Error:', metaError.message)
      } else if (metaData) {
        metaDia = metaData.reduce((sum, row) => sum + parseRealtimeNumber(row.valor_meta), 0)
      }
      monitor.mark('query_meta', { rows: metaData?.length ?? 0 })
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Meta Exception:', err)
      monitor.mark('query_meta_error')
    }

    try {
      let descontosQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('resumo_vendas_caixa')
        .select('valor_total_descontos')
        .eq('data', currentDate)

      if (finalFiliais && finalFiliais.length > 0) {
        descontosQuery = descontosQuery.in('filial_id', finalFiliais)
      }

      const { data: descontosData, error: descontosError } = await descontosQuery

      if (descontosError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Descontos Query Error:', descontosError.message)
      } else if (descontosData) {
        descontos = descontosData.reduce(
          (sum, row) => sum + parseRealtimeNumber(row.valor_total_descontos),
          0
        )
      }
      monitor.mark('query_descontos', { rows: descontosData?.length ?? 0 })
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Descontos Exception:', err)
      monitor.mark('query_descontos_error')
    }

    // Calculate derived values
    const ticketMedio = qtdeCupons > 0 ? receitaTotal / qtdeCupons : 0
    const atingimentoPercentual = calculatePercentage(receitaTotal, metaDia)
    const cancelamentosPercentual = calculatePercentage(cancelamentos, receitaTotal)

    const result = {
      receita_total: receitaTotal,
      meta_dia: metaDia,
      atingimento_percentual: atingimentoPercentual,
      ticket_medio: ticketMedio,
      qtde_cupons: qtdeCupons,
      qtde_skus: qtdeSkus,
      descontos,
      cancelamentos: cancelamentos,
      cancelamentos_percentual: cancelamentosPercentual,
      cancelamentos_qtde_skus: cancelamentosQtdeSkus,
      ultima_atualizacao: ultimaAtualizacao || new Date().toISOString(),
    }

    console.log('[API/DASHBOARD-TEMPO-REAL/RESUMO] Result:', result)
    monitor.finish({
      currentDate,
      receitaTotal,
      qtdeCupons,
      qtdeSkus,
      descontos,
      cancelamentosQtdeSkus,
    })

    return NextResponse.json(result)
  } catch (e) {
    const error = e as Error
    monitor.fail(error)
    console.error('Unexpected error in dashboard-tempo-real/resumo API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
