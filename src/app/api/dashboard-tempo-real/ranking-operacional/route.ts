import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  callRealtimeRpc,
  createRealtimeRouteMonitor,
  getAuthorizedRealtimeFiliais,
  getBranchNameMapForTenant,
  getRealtimeCurrentDate,
  getTenantIdBySchema,
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
  const monitor = createRealtimeRouteMonitor('API/DASHBOARD-TEMPO-REAL/RANKING-OPERACIONAL')

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

    const { data: rpcData, error: rpcError } = await callRealtimeRpc<{
      filial_id: number | string | null
      caixa: number | string | null
      skus_venda: number | string | null
      skus_cancelados: number | string | null
      valor_cancelamentos: number | string | null
      valor_vendido: number | string | null
    }>(
      supabase,
      'get_dashboard_tempo_real_ranking_operacional',
      {
        p_schema: requestedSchema,
        p_data_extracao: currentDate,
        p_filial_ids: finalFiliais && finalFiliais.length > 0 ? finalFiliais : null,
      }
    )

    if (rpcError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/RANKING-OPERACIONAL] RPC Error:', rpcError.message)
      return NextResponse.json(
        { error: 'Error fetching ranking data' },
        { status: 500 }
      )
    }
    monitor.mark('rpc_ranking', { rows: rpcData?.length ?? 0 })

    const tenantId = await getTenantIdBySchema(supabase, requestedSchema)
    const branchNameMap = await getBranchNameMapForTenant(supabase, tenantId)
    monitor.mark('branch_lookup', { branchCount: branchNameMap.size })

    const ranking = (rpcData || []).map((row) => ({
      filial_id: Number(row.filial_id),
      filial_nome: branchNameMap.get(String(row.filial_id)) || `Filial ${row.filial_id}`,
      caixa: Number(row.caixa || 0),
      skus_venda: Number(row.skus_venda || 0),
      skus_cancelados: Number(row.skus_cancelados || 0),
      valor_cancelamentos: Number(row.valor_cancelamentos || 0),
      valor_vendido: Number(row.valor_vendido || 0),
    }))
    monitor.mark('build_response', { rows: ranking.length })

    // Sort by valor_vendido descending (default)
    ranking.sort((a, b) => b.valor_vendido - a.valor_vendido)

    console.log('[API/DASHBOARD-TEMPO-REAL/RANKING-OPERACIONAL] Result count:', ranking.length)
    monitor.finish({
      currentDate,
      rpcRows: rpcData?.length ?? 0,
      rankingRows: ranking.length,
    })

    return NextResponse.json({ ranking })
  } catch (e) {
    const error = e as Error
    monitor.fail(error)
    console.error('Unexpected error in dashboard-tempo-real/ranking-operacional API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
