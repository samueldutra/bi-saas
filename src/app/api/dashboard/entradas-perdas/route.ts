import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// FORCAR ROTA DINAMICA - NAO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Valida os parametros de filtro
const querySchema = z.object({
  schema: z.string().min(1),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data invalido, esperado YYYY-MM-DD'),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data invalido, esperado YYYY-MM-DD'),
  filiais: z.string().optional(), // ex: "1,4,7" ou "all"
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

    const { schema: requestedSchema, data_inicio, data_fim, filiais } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filiais to use based on authorization
    let finalFiliais: number[] | null = null

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      if (filiais && filiais !== 'all') {
        finalFiliais = filiais.split(',').map((f) => parseInt(f.trim(), 10)).filter((n) => !isNaN(n))
      }
    } else if (!filiais || filiais === 'all') {
      // User requested all but has restrictions - use authorized branches
      finalFiliais = authorizedBranches.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n))
    } else {
      // User requested specific filiais - filter by authorized
      const requestedFiliais = filiais.split(',')
      const allowedFiliais = requestedFiliais.filter((f) => authorizedBranches.includes(f))
      // If none of requested filiais are authorized, use all authorized
      finalFiliais =
        allowedFiliais.length > 0
          ? allowedFiliais.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n))
          : authorizedBranches.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n))
    }

    // Usar client direto sem cache
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    let totalEntradas = 0
    let totalPerdas = 0

    // Buscar ENTRADAS usando schema dinâmico
    // Filtra apenas transacoes P (Prazo) e V (Vista) - compras reais
    try {
      let entradasQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('entradas')
        .select('valor_total')
        .in('transacao', ['P', 'V'])
        .gte('data_entrada', data_inicio)
        .lte('data_entrada', data_fim)

      if (finalFiliais && finalFiliais.length > 0) {
        entradasQuery = entradasQuery.in('filial_id', finalFiliais)
      }

      const { data: entradasData, error: entradasError } = await entradasQuery

      if (entradasError) {
        console.warn('[API/ENTRADAS-PERDAS] Entradas Query Error:', entradasError.message)
      } else if (entradasData) {
        totalEntradas = entradasData.reduce((sum, row) => sum + (parseFloat(row.valor_total) || 0), 0)
      }
    } catch (err) {
      console.warn('[API/ENTRADAS-PERDAS] Entradas Exception:', err)
    }

    // Buscar PERDAS usando schema dinâmico
    try {
      let perdasQuery = directSupabase
        .schema(requestedSchema as 'public')
        .from('perdas')
        .select('valor_perda')
        .gte('data_perda', data_inicio)
        .lte('data_perda', data_fim)

      if (finalFiliais && finalFiliais.length > 0) {
        perdasQuery = perdasQuery.in('filial_id', finalFiliais)
      }

      const { data: perdasData, error: perdasError } = await perdasQuery

      if (perdasError) {
        console.warn('[API/ENTRADAS-PERDAS] Perdas Query Error:', perdasError.message)
      } else if (perdasData) {
        totalPerdas = perdasData.reduce((sum, row) => sum + (parseFloat(row.valor_perda) || 0), 0)
      }
    } catch (err) {
      console.warn('[API/ENTRADAS-PERDAS] Perdas Exception:', err)
    }

    console.log('[API/ENTRADAS-PERDAS] Result:', { totalEntradas, totalPerdas, data_inicio, data_fim, filiais: finalFiliais })

    return NextResponse.json({
      total_entradas: totalEntradas,
      total_perdas: totalPerdas,
    })
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in entradas-perdas API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
