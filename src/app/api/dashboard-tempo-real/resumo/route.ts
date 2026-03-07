import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculatePercentage,
  calculateSimpleItemRevenue,
  getAuthorizedRealtimeFiliais,
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

    let receitaTotal = 0
    let qtdeCupons = 0
    let cancelamentos = 0
    let qtdeSkus = 0
    let metaDia = 0

    // Query 1: Receita e Cupons (vendas nao canceladas)
    try {
      let receitaQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('vendas_hoje')
        .select('valor_total')
        .eq('cancelada', false)

      if (finalFiliais && finalFiliais.length > 0) {
        receitaQuery = receitaQuery.in('filial_id', finalFiliais)
      }

      const { data: receitaData, error: receitaError } = await receitaQuery

      if (receitaError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Receita Query Error:', receitaError.message)
      } else if (receitaData) {
        receitaTotal = receitaData.reduce((sum, row) => sum + parseRealtimeNumber(row.valor_total), 0)
        qtdeCupons = receitaData.length
      }
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Receita Exception:', err)
    }

    // Query 2: Cancelamentos (de vendas_hoje_itens onde cancelado = true)
    let cancelamentosQtdeSkus = 0
    try {
      let cancelQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('vendas_hoje_itens')
        .select('produto_id, quantidade_vendida, preco_venda')
        .eq('cancelado', true)

      if (finalFiliais && finalFiliais.length > 0) {
        cancelQuery = cancelQuery.in('filial_id', finalFiliais)
      }

      const { data: cancelData, error: cancelError } = await cancelQuery

      if (cancelError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Cancel Query Error:', cancelError.message)
      } else if (cancelData) {
        cancelamentos = cancelData.reduce((sum, row) => sum + calculateSimpleItemRevenue(row), 0)
        // Contar SKUs distintos cancelados
        const skusCancelados = new Set(cancelData.map(item => item.produto_id))
        cancelamentosQtdeSkus = skusCancelados.size
      }
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Cancel Exception:', err)
    }

    // Query 3: SKUs distintos
    try {
      let skusQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('vendas_hoje_itens')
        .select('produto_id, filial_id, cupom')
        .eq('cancelado', false)

      if (finalFiliais && finalFiliais.length > 0) {
        skusQuery = skusQuery.in('filial_id', finalFiliais)
      }

      const { data: skusData, error: skusError } = await skusQuery

      if (skusError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] SKUs Query Error:', skusError.message)
      } else if (skusData) {
        // Get unique produto_ids
        const uniqueSkus = new Set(skusData.map(item => item.produto_id))
        qtdeSkus = uniqueSkus.size
      }
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] SKUs Exception:', err)
    }

    // Query 4: Meta do dia
    try {
      const today = new Date().toISOString().split('T')[0]
      let metaQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('metas_mensais')
        .select('valor_meta')
        .eq('data', today)

      if (finalFiliais && finalFiliais.length > 0) {
        metaQuery = metaQuery.in('filial_id', finalFiliais)
      }

      const { data: metaData, error: metaError } = await metaQuery

      if (metaError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Meta Query Error:', metaError.message)
      } else if (metaData) {
        metaDia = metaData.reduce((sum, row) => sum + parseRealtimeNumber(row.valor_meta), 0)
      }
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Meta Exception:', err)
    }

    // Query 5: Última atualização dos dados (created_at mais recente)
    let ultimaAtualizacao: string | null = null
    try {
      let ultimaQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('vendas_hoje')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)

      if (finalFiliais && finalFiliais.length > 0) {
        ultimaQuery = ultimaQuery.in('filial_id', finalFiliais)
      }

      const { data: ultimaData, error: ultimaError } = await ultimaQuery

      if (ultimaError) {
        console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Ultima Atualizacao Query Error:', ultimaError.message)
      } else if (ultimaData && ultimaData.length > 0) {
        ultimaAtualizacao = ultimaData[0].created_at
      }
    } catch (err) {
      console.warn('[API/DASHBOARD-TEMPO-REAL/RESUMO] Ultima Atualizacao Exception:', err)
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
      cancelamentos: cancelamentos,
      cancelamentos_percentual: cancelamentosPercentual,
      cancelamentos_qtde_skus: cancelamentosQtdeSkus,
      ultima_atualizacao: ultimaAtualizacao || new Date().toISOString(),
    }

    console.log('[API/DASHBOARD-TEMPO-REAL/RESUMO] Result:', result)

    return NextResponse.json(result)
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in dashboard-tempo-real/resumo API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
