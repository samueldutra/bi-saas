import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculatePercentage,
  calculateRealtimeItemRevenue,
  getAuthorizedRealtimeFiliais,
  getRealtimeDirectClient,
} from '@/lib/dashboard-tempo-real/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// FORCAR ROTA DINAMICA - NAO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

const querySchema = z.object({
  schema: z.string().min(1),
  filiais: z.string().optional(),
  limit: z.string().optional().default('10'),
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

    const { schema: requestedSchema, filiais, limit } = validation.data
    const limitNum = Math.min(parseInt(limit, 10), 100)

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const finalFiliais = await getAuthorizedRealtimeFiliais(supabase, user.id, filiais)

    // Direct Supabase client for schema queries
    const directSupabase = getRealtimeDirectClient()

    // Query vendas_hoje_itens
    let itensQuery = directSupabase
      .schema(requestedSchema as 'public')
      .from('vendas_hoje_itens')
      .select('produto_id, filial_id, quantidade_vendida, preco_venda, valor_desconto, valor_acrescimo')
      .eq('cancelado', false)

    if (finalFiliais && finalFiliais.length > 0) {
      itensQuery = itensQuery.in('filial_id', finalFiliais)
    }

    const { data: itensData, error: itensError } = await itensQuery

    if (itensError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS] Itens Query Error:', itensError.message)
      return NextResponse.json(
        { error: 'Error fetching items data' },
        { status: 500 }
      )
    }

    // Get produtos with departamento_id
    const produtoIds = new Set<number>()
    if (itensData) {
      itensData.forEach((item) => produtoIds.add(item.produto_id))
    }

    const productDeptMap = new Map<number, number | null>()
    if (produtoIds.size > 0) {
      // Processar em lotes para evitar limite de URL do Supabase
      const BATCH_SIZE = 500
      const produtoIdsArray = Array.from(produtoIds)
      let totalProdutosRetornados = 0
      let totalProdutosSemDepto = 0

      for (let i = 0; i < produtoIdsArray.length; i += BATCH_SIZE) {
        const batch = produtoIdsArray.slice(i, i + BATCH_SIZE)

        const { data: produtosData, error: produtosError } = await directSupabase
          .schema(requestedSchema as 'public')
          .from('produtos')
          .select('id, departamento_id')
          .in('id', batch)

        if (produtosError) {
          console.error('[API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS] Produtos batch error:', produtosError.message)
          continue
        }

        if (produtosData) {
          totalProdutosRetornados += produtosData.length
          produtosData.forEach((p) => {
            productDeptMap.set(p.id, p.departamento_id)
            if (p.departamento_id === null || p.departamento_id === undefined) {
              totalProdutosSemDepto++
            }
          })
        }
      }

      console.log('[API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS] Produtos query:', {
        schema: requestedSchema,
        produtoIds: produtoIds.size,
        produtosRetornados: totalProdutosRetornados,
        produtosSemDepto: totalProdutosSemDepto,
        batches: Math.ceil(produtoIdsArray.length / BATCH_SIZE)
      })
    }

    // Aggregate by departamento_id
    const deptMap = new Map<number | null, number>()
    let receitaTotal = 0

    if (itensData) {
      itensData.forEach((item) => {
        const receita = calculateRealtimeItemRevenue(item)

        receitaTotal += receita

        const deptId = productDeptMap.get(item.produto_id) ?? null

        if (deptMap.has(deptId)) {
          deptMap.set(deptId, deptMap.get(deptId)! + receita)
        } else {
          deptMap.set(deptId, receita)
        }
      })
    }

    // Get department names
    const deptIds = Array.from(deptMap.keys()).filter((id) => id !== null) as number[]
    const deptNameMap = new Map<number, string>()

    if (deptIds.length > 0) {
      const { data: deptsData } = await directSupabase
        .schema(requestedSchema as 'public')
        .from('departments_level_1')
        .select('departamento_id, descricao')
        .in('departamento_id', deptIds)

      if (deptsData) {
        deptsData.forEach((d) => {
          deptNameMap.set(d.departamento_id, d.descricao || `Departamento ${d.departamento_id}`)
        })
      }
    }

    // Build result sorted by receita
    const sortedDepts = Array.from(deptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitNum)

    const departamentos = sortedDepts.map(([deptId, receita]) => ({
      departamento_id: deptId ?? 0,
      departamento_nome: deptId ? (deptNameMap.get(deptId) || `Departamento ${deptId}`) : 'Sem Departamento',
      receita,
      participacao_percentual: calculatePercentage(receita, receitaTotal),
    }))

    console.log('[API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS] Result count:', departamentos.length)

    return NextResponse.json({
      receita_total: receitaTotal,
      departamentos,
    })
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in dashboard-tempo-real/departamentos-receita API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
