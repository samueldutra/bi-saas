import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculateRealtimeItemRevenue,
  getAuthorizedRealtimeFiliais,
  getRealtimeDirectClient,
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
      .select('produto_id, filial_id, quantidade_vendida, preco_venda, valor_desconto, valor_acrescimo, oferta_id')
      .eq('cancelado', false)

    if (finalFiliais && finalFiliais.length > 0) {
      itensQuery = itensQuery.in('filial_id', finalFiliais)
    }

    const { data: itensData, error: itensError } = await itensQuery

    if (itensError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/PRODUTOS] Itens Query Error:', itensError.message)
      return NextResponse.json(
        { error: 'Error fetching items data' },
        { status: 500 }
      )
    }

    // Aggregate by produto_id (normalizado como string para evitar mismatch number vs string)
    const productMap = new Map<string, { quantidade: number; receita: number; is_oferta: boolean }>()

    if (itensData) {
      itensData.forEach((item) => {
        const produtoId = String(item.produto_id ?? '').trim()
        if (!produtoId) return
        const quantidade = parseRealtimeNumber(item.quantidade_vendida)
        const receita = calculateRealtimeItemRevenue(item)
        const isOferta = isOfertaItem(item.oferta_id)

        if (productMap.has(produtoId)) {
          const existing = productMap.get(produtoId)!
          existing.quantidade += quantidade
          existing.receita += receita
          // If any item of this product is on sale, mark as oferta
          if (isOferta) existing.is_oferta = true
        } else {
          productMap.set(produtoId, {
            quantidade,
            receita,
            is_oferta: isOferta,
          })
        }
      })
    }

    // Get top products by receita
    const sortedProducts = Array.from(productMap.entries())
      .sort((a, b) => b[1].receita - a[1].receita)
      .slice(0, limitNum)

    // Get product descriptions
    const produtoIds = sortedProducts.map(([id]) => id)

    const productDescMap = new Map<string, string>()
    if (produtoIds.length > 0) {
      const numericProdutoIds = produtoIds
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n))

      const idCandidates = ['id', 'codigo', 'cod_produto', 'produto_codigo', 'sku']

      for (const candidateColumn of idCandidates) {
        if (productDescMap.size >= produtoIds.length) break

        const filterValues = numericProdutoIds.length > 0 ? numericProdutoIds : produtoIds

        type ProdutoLookupRow = Record<string, unknown> & { descricao: string | null }
        type ProdutoLookupResult = {
          data: ProdutoLookupRow[] | null
          error: { message: string } | null
        }

        // Evita explosão de inferência de tipos com coluna dinâmica (candidateColumn)
        const query = (
          directSupabase
            .schema(requestedSchema as 'public')
            .from('produtos') as unknown as {
            select: (columns: string) => {
              in: (column: string, values: Array<string | number>) => Promise<ProdutoLookupResult>
            }
          }
        )

        const { data: produtosData, error: produtosError } = await query
          .select(`${candidateColumn}, descricao`)
          .in(candidateColumn, filterValues)

        if (produtosError) {
          const isMissingColumn = produtosError.message.includes('does not exist')
          if (!isMissingColumn) {
            console.warn(`[API/DASHBOARD-TEMPO-REAL/PRODUTOS] Produtos Query by ${candidateColumn} Error:`, produtosError.message)
          }
          continue
        }

        if (produtosData) {
          produtosData.forEach((p) => {
            const productId = String((p as Record<string, unknown>)[candidateColumn] ?? '').trim()
            if (productId && !productDescMap.has(productId)) {
              productDescMap.set(productId, p.descricao || `Produto ${productId}`)
            }
          })
        }
      }

      if (productDescMap.size < produtoIds.length) {
        const missingIds = produtoIds.filter((id) => !productDescMap.has(id)).slice(0, 20)
        console.warn('[API/DASHBOARD-TEMPO-REAL/PRODUTOS] IDs sem descrição encontrados:', {
          schema: requestedSchema,
          totalIds: produtoIds.length,
          totalDescricoes: productDescMap.size,
          missingSample: missingIds,
        })
      }
    }

    // Build result
    const produtos = sortedProducts.map(([produtoId, data]) => ({
      produto_id: parseInt(produtoId, 10),
      descricao: productDescMap.get(produtoId) || `Produto ${produtoId}`,
      quantidade_vendida: data.quantidade,
      receita: data.receita,
      is_oferta: data.is_oferta,
    }))

    console.log('[API/DASHBOARD-TEMPO-REAL/PRODUTOS] Result count:', produtos.length)

    return NextResponse.json({ produtos })
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in dashboard-tempo-real/produtos-mais-vendidos API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
