import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAuthorizedRealtimeFiliais,
  getBranchNameMapForTenant,
  getRealtimeDirectClient,
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

    // Query vendas_hoje to get caixa information
    let vendasQuery = directSupabase
      .schema(requestedSchema as 'public')
      .from('vendas_hoje')
      .select('filial_id, cupom, caixa')

    if (finalFiliais && finalFiliais.length > 0) {
      vendasQuery = vendasQuery.in('filial_id', finalFiliais)
    }

    const { data: vendasData, error: vendasError } = await vendasQuery

    if (vendasError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/RANKING-OPERACIONAL] Vendas Query Error:', vendasError.message)
      return NextResponse.json(
        { error: 'Error fetching vendas data' },
        { status: 500 }
      )
    }

    // Create a map of cupom -> caixa for lookup
    const cupomCaixaMap = new Map<string, number>()
    if (vendasData) {
      vendasData.forEach((venda) => {
        const key = `${venda.filial_id}-${venda.cupom}`
        cupomCaixaMap.set(key, venda.caixa)
      })
    }

    // Query vendas_hoje_itens
    let itensQuery = directSupabase
      .schema(requestedSchema as 'public')
      .from('vendas_hoje_itens')
      .select('filial_id, cupom, produto_id, cancelado, quantidade_vendida, preco_venda')

    if (finalFiliais && finalFiliais.length > 0) {
      itensQuery = itensQuery.in('filial_id', finalFiliais)
    }

    const { data: itensData, error: itensError } = await itensQuery

    if (itensError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/RANKING-OPERACIONAL] Itens Query Error:', itensError.message)
      return NextResponse.json(
        { error: 'Error fetching itens data' },
        { status: 500 }
      )
    }

    const tenantId = await getTenantIdBySchema(supabase, requestedSchema)
    const branchNameMap = await getBranchNameMapForTenant(supabase, tenantId)

    // Aggregate by filial_id and caixa
    const aggregateMap = new Map<string, {
      filial_id: number
      filial_nome: string
      caixa: number
      skus_venda: Set<number>
      skus_cancelados: Set<number>
      valor_cancelamentos: number
      valor_vendido: number
    }>()

    if (itensData) {
      itensData.forEach((item) => {
        // Lookup caixa from vendas_hoje
        const cupomKey = `${item.filial_id}-${item.cupom}`
        const caixa = cupomCaixaMap.get(cupomKey) || 0

        const key = `${item.filial_id}-${caixa}`
        const quantidade = parseFloat(item.quantidade_vendida) || 0
        const preco = parseFloat(item.preco_venda) || 0
        const valor = quantidade * preco

        if (!aggregateMap.has(key)) {
          aggregateMap.set(key, {
            filial_id: item.filial_id,
            filial_nome: branchNameMap.get(item.filial_id.toString()) || `Filial ${item.filial_id}`,
            caixa: caixa,
            skus_venda: new Set(),
            skus_cancelados: new Set(),
            valor_cancelamentos: 0,
            valor_vendido: 0,
          })
        }

        const entry = aggregateMap.get(key)!

        if (item.cancelado) {
          entry.skus_cancelados.add(item.produto_id)
          entry.valor_cancelamentos += valor
        } else {
          entry.skus_venda.add(item.produto_id)
          entry.valor_vendido += valor
        }
      })
    }

    // Convert to array and transform Sets to counts
    const ranking = Array.from(aggregateMap.values()).map((entry) => ({
      filial_id: entry.filial_id,
      filial_nome: entry.filial_nome,
      caixa: entry.caixa,
      skus_venda: entry.skus_venda.size,
      skus_cancelados: entry.skus_cancelados.size,
      valor_cancelamentos: entry.valor_cancelamentos,
      valor_vendido: entry.valor_vendido,
    }))

    // Sort by valor_vendido descending (default)
    ranking.sort((a, b) => b.valor_vendido - a.valor_vendido)

    console.log('[API/DASHBOARD-TEMPO-REAL/RANKING-OPERACIONAL] Result count:', ranking.length)

    return NextResponse.json({ ranking })
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in dashboard-tempo-real/ranking-operacional API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
