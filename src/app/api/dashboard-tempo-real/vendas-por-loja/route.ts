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
})

// Paleta de cores para filiais
const FILIAL_COLORS = [
  'hsl(142, 76%, 45%)',  // Verde neon
  'hsl(200, 70%, 50%)',  // Azul
  'hsl(38, 92%, 50%)',   // Laranja
  'hsl(280, 60%, 55%)',  // Roxo
  'hsl(350, 70%, 55%)',  // Rosa
  'hsl(170, 60%, 45%)',  // Teal
  'hsl(60, 70%, 50%)',   // Amarelo
  'hsl(320, 60%, 50%)',  // Magenta
]

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

    // Get tenant_id from schema
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('supabase_schema', requestedSchema)
      .single() as { data: { id: string } | null }

    // Get branch names from public.branches filtered by tenant_id
    const { data: branchesData } = await supabase
      .from('branches')
      .select('branch_code, descricao')
      .eq('tenant_id', tenantData?.id || '') as { data: { branch_code: string; descricao: string | null }[] | null }

    const branchNameMap = new Map<string, string>()
    if (branchesData) {
      branchesData.forEach((b) => {
        branchNameMap.set(b.branch_code, b.descricao || `Filial ${b.branch_code}`)
      })
    }

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
        metaByFilial.set(m.filial_id, parseFloat(String(m.valor_meta)) || 0)
      })
    }

    // Aggregate by filial_id separating oferta vs normal
    const filialMap = new Map<number, { receita_oferta: number; receita_normal: number }>()

    if (itensData) {
      itensData.forEach((item) => {
        const filialId = item.filial_id
        const quantidade = parseFloat(item.quantidade_vendida) || 0
        const preco = parseFloat(item.preco_venda) || 0
        const desconto = parseFloat(item.valor_desconto) || 0
        const acrescimo = parseFloat(item.valor_acrescimo) || 0
        const receita = quantidade * preco - desconto + acrescimo

        // Check if product is on sale (oferta_id is not null/empty/whitespace)
        const ofertaId = item.oferta_id ? String(item.oferta_id).trim() : ''
        const isOferta = ofertaId.length > 0

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
          cor: FILIAL_COLORS[index % FILIAL_COLORS.length],
          meta,
          atingimento_meta: meta > 0 ? (receita_total / meta) * 100 : 0,
        }
      })
      .sort((a, b) => b.receita_total - a.receita_total)

    // Reassign colors after sorting
    const result = filiaisArray.map((item, index) => ({
      ...item,
      cor: FILIAL_COLORS[index % FILIAL_COLORS.length],
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
