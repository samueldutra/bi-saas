import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
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

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filiais to use
    let finalFiliais: number[] | null = null

    if (authorizedBranches === null) {
      if (filiais && filiais !== 'all') {
        finalFiliais = filiais.split(',').map((f) => parseInt(f.trim(), 10)).filter((n) => !isNaN(n))
      }
    } else if (!filiais || filiais === 'all') {
      finalFiliais = authorizedBranches.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n))
    } else {
      const requestedFiliais = filiais.split(',')
      const allowedFiliais = requestedFiliais.filter((f) => authorizedBranches.includes(f))
      finalFiliais =
        allowedFiliais.length > 0
          ? allowedFiliais.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n))
          : authorizedBranches.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n))
    }

    // Direct Supabase client for schema queries
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

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

    // Aggregate by produto_id
    const productMap = new Map<number, { quantidade: number; receita: number; filial_id: number; is_oferta: boolean }>()

    if (itensData) {
      itensData.forEach((item) => {
        const produtoId = item.produto_id
        const quantidade = parseFloat(item.quantidade_vendida) || 0
        const preco = parseFloat(item.preco_venda) || 0
        const desconto = parseFloat(item.valor_desconto) || 0
        const acrescimo = parseFloat(item.valor_acrescimo) || 0
        const receita = quantidade * preco - desconto + acrescimo
        // Check if product is on sale (oferta_id is not null/empty/whitespace)
        const ofertaId = item.oferta_id ? String(item.oferta_id).trim() : ''
        const isOferta = ofertaId.length > 0

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
            filial_id: item.filial_id,
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

    const productDescMap = new Map<number, string>()
    if (produtoIds.length > 0) {
      // Get product descriptions from produtos table
      const { data: produtosData } = await directSupabase
        .schema(requestedSchema as 'public')
        .from('produtos')
        .select('id, descricao')
        .in('id', produtoIds)

      if (produtosData) {
        produtosData.forEach((p) => {
          if (!productDescMap.has(p.id)) {
            productDescMap.set(p.id, p.descricao || `Produto ${p.id}`)
          }
        })
      }
    }

    // Build result
    const produtos = sortedProducts.map(([produtoId, data]) => ({
      produto_id: produtoId,
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
