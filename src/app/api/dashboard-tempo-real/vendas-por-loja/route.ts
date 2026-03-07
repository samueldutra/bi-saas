import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculatePercentage,
  calculateRealtimeItemRevenue,
  getAuthorizedRealtimeFiliais,
  getBranchNameMapForTenant,
  getDashboardTempoRealFilialColor,
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
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = querySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema: requestedSchema, filiais } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const finalFiliais = await getAuthorizedRealtimeFiliais(supabase, user.id, filiais)

    // Direct Supabase client for schema queries
    const directSupabase = getRealtimeDirectClient()

    // Query vendas_hoje_itens to get oferta data
    let itensQuery = directSupabase
      .schema(requestedSchema as 'public')
      .from('vendas_hoje_itens')
      .select('filial_id, quantidade_vendida, preco_venda, valor_desconto, valor_acrescimo, oferta_id')
      .eq('cancelado', false)

    if (finalFiliais && finalFiliais.length > 0) {
      itensQuery = itensQuery.in('filial_id', finalFiliais)
    }

    const { data: itensData, error: itensError } = await itensQuery

    if (itensError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-LOJA] Query Error:', itensError.message)
      return NextResponse.json(
        { error: 'Error fetching sales data' },
        { status: 500 }
      )
    }

    const tenantId = await getTenantIdBySchema(supabase, requestedSchema)
    const branchNameMap = await getBranchNameMapForTenant(supabase, tenantId)

    // Get metas for today
    const today = new Date().toISOString().split('T')[0]
    const { data: metasData } = await directSupabase
      .schema(requestedSchema as 'public')
      .from('metas_mensais')
      .select('filial_id, valor_meta')
      .eq('data', today)

    const metaByFilial = new Map<number, number>()
    if (metasData) {
      metasData.forEach((m: { filial_id: number; valor_meta: string | number }) => {
        metaByFilial.set(m.filial_id, parseRealtimeNumber(m.valor_meta))
      })
    }

    // Aggregate by filial_id separating oferta vs normal
    const filialMap = new Map<number, { receita_oferta: number; receita_normal: number }>()

    if (itensData) {
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
    }

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

    console.log('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-LOJA] Result:', result.length, 'filiais')

    return NextResponse.json({ lojas: result })
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in dashboard-tempo-real/vendas-por-loja API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
