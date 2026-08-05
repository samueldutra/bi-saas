import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculatePercentage,
  calculateRealtimeItemRevenue,
  createRealtimeRouteMonitor,
  fetchAllRealtimeRows,
  getAuthorizedRealtimeFiliais,
  getBranchNameMapForTenant,
  getDashboardTempoRealFilialColor,
  getRealtimeCurrentDate,
  getRealtimeDirectClient,
  getTenantIdBySchema,
  isOfertaItem,
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
  const monitor = createRealtimeRouteMonitor('API/DASHBOARD-TEMPO-REAL/VENDAS-POR-LOJA')

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

    // Direct Supabase client for schema queries
    const directSupabase = getRealtimeDirectClient()
    const currentDate = getRealtimeCurrentDate()

    // Query vendas_hoje_itens to get oferta data
    const { data: itensData, error: itensError } =
      await fetchAllRealtimeRows<{
        filial_id: number
        quantidade_vendida: string | number | null
        preco_venda: string | number | null
        valor_desconto: string | number | null
        valor_acrescimo: string | number | null
        oferta_id: string | null
      }>(async (from, to) => {
        let itensQuery = directSupabase
          .schema(requestedSchema as 'public')
          .from('vendas_hoje_itens')
          .select('filial_id, quantidade_vendida, preco_venda, valor_desconto, valor_acrescimo, oferta_id')
          .eq('data_extracao', currentDate)
          .eq('cancelado', false)
          .order('filial_id')
          .order('cupom')
          .order('ordem')
          .order('produto_id')
          .range(from, to)

        if (finalFiliais && finalFiliais.length > 0) {
          itensQuery = itensQuery.in('filial_id', finalFiliais)
        }

        return itensQuery
      })

    if (itensError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-LOJA] Query Error:', itensError.message)
      return NextResponse.json(
        { error: 'Error fetching sales data' },
        { status: 500 }
      )
    }
    monitor.mark('query_itens', { rows: itensData?.length ?? 0 })

    const tenantId = await getTenantIdBySchema(supabase, requestedSchema)
    const branchNameMap = await getBranchNameMapForTenant(supabase, tenantId)
    monitor.mark('branch_lookup', { branchCount: branchNameMap.size })

    // Get metas for today
    const { data: metasData } = await directSupabase
      .schema(requestedSchema as 'public')
      .from('metas_mensais')
      .select('filial_id, valor_meta')
      .eq('data', currentDate)
    monitor.mark('query_metas', { rows: metasData?.length ?? 0 })

    const metaByFilial = new Map<number, number>()
    if (metasData) {
      metasData.forEach((m: { filial_id: number; valor_meta: string | number }) => {
        metaByFilial.set(m.filial_id, parseRealtimeNumber(m.valor_meta))
      })
    }

    // Aggregate by filial_id separating oferta vs normal
    const filialMap = new Map<number, { receita_oferta: number; receita_normal: number }>()

    itensData.forEach((item) => {
      const filialId = item.filial_id
      const receita = calculateRealtimeItemRevenue(item)
      const isOferta = isOfertaItem(item.oferta_id)

      if (!filialMap.has(filialId)) {
        filialMap.set(filialId, { receita_oferta: 0, receita_normal: 0 })
      }

      const filialData = filialMap.get(filialId)!
      if (isOferta) {
        filialData.receita_oferta += receita
      } else {
        filialData.receita_normal += receita
      }
    })
    monitor.mark('aggregate_filiais', { groups: filialMap.size })

    // Build result array sorted by total receita
    const filiaisArray = Array.from(filialMap.entries())
      .map(([filialId, data], index) => {
        const receita_total = data.receita_oferta + data.receita_normal
        const meta = metaByFilial.get(filialId) || 0
        return {
          filial_id: filialId,
          filial_nome: branchNameMap.get(filialId.toString()) || `Filial ${filialId}`,
          receita_oferta: data.receita_oferta,
          receita_normal: data.receita_normal,
          receita_total,
          cor: getDashboardTempoRealFilialColor(index),
          meta,
          atingimento_meta: calculatePercentage(receita_total, meta),
        }
      })
      .sort((a, b) => b.receita_total - a.receita_total)

    // Reassign colors after sorting
    const result = filiaisArray.map((item, index) => ({
      ...item,
      cor: getDashboardTempoRealFilialColor(index),
    }))
    monitor.mark('build_response', { rows: result.length })

    console.log('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-LOJA] Result:', result.length, 'filiais')
    monitor.finish({
      currentDate,
      itensRows: itensData?.length ?? 0,
      metasRows: metasData?.length ?? 0,
      filiais: result.length,
    })

    return NextResponse.json({ lojas: result })
  } catch (e) {
    const error = e as Error
    monitor.fail(error)
    console.error('Unexpected error in dashboard-tempo-real/vendas-por-loja API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
