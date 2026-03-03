import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { isValidSchema } from '@/lib/security/validate-schema'
import { isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'
import { z } from 'zod'

// FORÇAR ROTA DINÂMICA - NÃO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

const generateMetaSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2100),
  metaPercentual: z.number().min(-100).max(1000),
  dataReferenciaInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filialId: z.union([z.string(), z.number()]).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Validar dados com Zod
    const validation = generateMetaSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema, filialId: requestedFilialId, mes, ano, metaPercentual, dataReferenciaInicial } = validation.data

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filial to use
    let finalFilialId: number | string

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      if (!requestedFilialId) {
        return NextResponse.json(
          { error: 'filialId é obrigatório' },
          { status: 400 }
        )
      }
      finalFilialId = requestedFilialId
    } else {
      // User has restrictions
      if (!requestedFilialId || requestedFilialId === 'all') {
        // Request for all - use first authorized branch
        if (authorizedBranches.length > 0) {
          const parsed = parseInt(authorizedBranches[0], 10)
          if (!isNaN(parsed)) {
            finalFilialId = parsed
          } else {
            return NextResponse.json(
              { error: 'Nenhuma filial autorizada válida encontrada' },
              { status: 400 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Usuário não tem acesso a nenhuma filial' },
            { status: 403 }
          )
        }
      } else {
        // Specific filial requested - check if authorized
        const requestedIdStr = String(requestedFilialId)
        const parsed = parseInt(requestedIdStr, 10)
        if (!isNaN(parsed) && authorizedBranches.includes(requestedIdStr)) {
          finalFilialId = parsed
        } else if (authorizedBranches.length > 0) {
          // Not authorized - use first authorized
          const firstParsed = parseInt(authorizedBranches[0], 10)
          if (!isNaN(firstParsed)) {
            finalFilialId = firstParsed
          } else {
            return NextResponse.json(
              { error: 'Nenhuma filial autorizada válida encontrada' },
              { status: 400 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Usuário não tem acesso a nenhuma filial' },
            { status: 403 }
          )
        }
      }
    }

    console.log('[API/METAS/GENERATE] Params:', {
      schema,
      requestedFilialId,
      finalFilialId,
      mes,
      ano,
      metaPercentual,
      dataReferenciaInicial
    })

    const useFaturamentoMetas = await isFaturamentoMetasEnabled(schema)
    const rpcName = useFaturamentoMetas
      ? 'generate_metas_mensais_com_faturamento'
      : 'generate_metas_mensais'

    // TEMPORÁRIO: Usar client direto sem cache (igual ao dashboard)
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (directSupabase as any).rpc(rpcName, {
      p_schema: schema,
      p_filial_id: finalFilialId,
      p_mes: mes,
      p_ano: ano,
      p_meta_percentual: metaPercentual,
      p_data_referencia_inicial: dataReferenciaInicial
    })

    if (error && useFaturamentoMetas) {
      console.warn('[API/METAS/GENERATE] RPC com faturamento falhou, fallback legado:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (directSupabase as any).rpc('generate_metas_mensais', {
        p_schema: schema,
        p_filial_id: finalFilialId,
        p_mes: mes,
        p_ano: ano,
        p_meta_percentual: metaPercentual,
        p_data_referencia_inicial: dataReferenciaInicial
      })
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[API/METAS/GENERATE] Error:', error)
      return NextResponse.json(
        { error: 'Erro ao gerar metas' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/METAS/GENERATE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
