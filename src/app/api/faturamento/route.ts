import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// FORÇAR ROTA DINÂMICA - NÃO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Schema de validação dos parâmetros
const querySchema = z.object({
  schema: z.string().min(1),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  filiais: z.string().optional(), // ex: "1,4,7" ou "all"
  por_filial: z.string().optional(), // "true" para retornar dados por filial
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

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

    const { schema: requestedSchema, data_inicio, data_fim, filiais, por_filial } = validation.data

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
      finalFiliais = (filiais && filiais !== 'all')
        ? filiais.split(',').map(f => parseInt(f, 10)).filter(f => !isNaN(f))
        : null
    } else if (!filiais || filiais === 'all') {
      // User requested all but has restrictions - use authorized branches
      finalFiliais = authorizedBranches.map(f => parseInt(f, 10)).filter(f => !isNaN(f))
    } else {
      // User requested specific filiais - filter by authorized
      const requestedFiliais = filiais.split(',')
      const allowedFiliais = requestedFiliais.filter(f => authorizedBranches.includes(f))

      // If none of requested filiais are authorized, use all authorized
      finalFiliais = (allowedFiliais.length > 0 ? allowedFiliais : authorizedBranches)
        .map(f => parseInt(f, 10))
        .filter(f => !isNaN(f))
    }

    // Usar client direto com service role para acessar funções
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    // Escolher função RPC baseado no parâmetro por_filial
    const rpcName = por_filial === 'true' ? 'get_faturamento_por_filial' : 'get_faturamento_data'

    const rpcParams = {
      p_schema: requestedSchema,
      p_data_inicio: data_inicio,
      p_data_fim: data_fim,
      p_filiais_ids: finalFiliais
    }

    console.log(`[API/FATURAMENTO] RPC ${rpcName} Params:`, JSON.stringify(rpcParams, null, 2))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await directSupabase.rpc(rpcName, rpcParams as any)

    if (error) {
      // Se o erro for porque a tabela não existe, retornar zeros
      if (error.message?.includes('faturamento') || error.code === 'PGRST106') {
        console.log('[API/FATURAMENTO] Tabela faturamento não existe, retornando zeros')
        if (por_filial === 'true') {
          return NextResponse.json([])
        }
        return NextResponse.json({
          receita_faturamento: 0,
          cmv_faturamento: 0,
          lucro_bruto_faturamento: 0,
          qtd_notas: 0
        })
      }

      console.error('[API/FATURAMENTO] RPC Error:', error)
      return NextResponse.json(
        { error: 'Error fetching faturamento data' },
        { status: 500 }
      )
    }

    // Para get_faturamento_data, retornar objeto único
    if (por_filial !== 'true' && Array.isArray(data) && data.length > 0) {
      return NextResponse.json(data[0])
    }

    return NextResponse.json(data)

  } catch (e) {
    const error = e as Error
    console.error('[API/FATURAMENTO] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
