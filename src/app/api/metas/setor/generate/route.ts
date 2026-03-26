import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'

type RpcError = {
  code?: string
  details?: string | null
  hint?: string | null
  message?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const {
      schema,
      setor_id,
      mes,
      ano,
      filial_id: requestedFilialId,
      data_referencia,
      meta_percentual,
    } = body

    if (!schema || !setor_id || !mes || !ano || !data_referencia || !meta_percentual) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filial to use
    let finalFilialId: number | null = null

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      if (requestedFilialId && requestedFilialId !== 'all') {
        const parsed = parseInt(requestedFilialId, 10)
        if (!isNaN(parsed)) {
          finalFilialId = parsed
        }
      }
    } else {
      // User has restrictions
      if (!requestedFilialId || requestedFilialId === 'all') {
        // Request for all - use first authorized branch
        if (authorizedBranches.length > 0) {
          const parsed = parseInt(authorizedBranches[0], 10)
          if (!isNaN(parsed)) {
            finalFilialId = parsed
          }
        }
      } else {
        // Specific filial requested - check if authorized
        const parsed = parseInt(requestedFilialId, 10)
        if (!isNaN(parsed) && authorizedBranches.includes(requestedFilialId)) {
          finalFilialId = parsed
        } else if (authorizedBranches.length > 0) {
          // Not authorized - use first authorized
          const firstParsed = parseInt(authorizedBranches[0], 10)
          if (!isNaN(firstParsed)) {
            finalFilialId = firstParsed
          }
        }
      }
    }

    console.log('[API/METAS/SETOR/GENERATE] Request params:', {
      schema,
      setor_id,
      mes,
      ano,
      requestedFilialId,
      finalFilialId,
      data_referencia,
      meta_percentual,
    })

    const useFaturamentoMetas = await isFaturamentoMetasEnabled(schema)
    const rpcName = useFaturamentoMetas
      ? 'generate_metas_setor_com_faturamento'
      : 'generate_metas_setor'

    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    // Enviamos explicitamente p_meta_margem_percentual para desambiguar a sobrecarga
    // exposta pelo PostgREST para generate_metas_setor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error }: { data: unknown; error: RpcError | null } = await (directSupabase as any).rpc(rpcName, {
      p_schema: schema,
      p_setor_id: parseInt(setor_id),
      p_filial_id: finalFilialId,  // bigint singular (não array!)
      p_mes: parseInt(mes),
      p_ano: parseInt(ano),
      p_meta_percentual: parseFloat(meta_percentual),
      p_meta_margem_percentual: null,
      p_data_referencia_inicial: data_referencia,
    })

    if (error && useFaturamentoMetas) {
      console.warn('[API/METAS/SETOR/GENERATE] RPC com faturamento falhou, fallback legado:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (directSupabase as any).rpc('generate_metas_setor', {
        p_schema: schema,
        p_setor_id: parseInt(setor_id),
        p_filial_id: finalFilialId,
        p_mes: parseInt(mes),
        p_ano: parseInt(ano),
        p_meta_percentual: parseFloat(meta_percentual),
        p_meta_margem_percentual: null,
        p_data_referencia_inicial: data_referencia,
      })
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[API/METAS/SETOR/GENERATE] Error:', error)
      return NextResponse.json(
        {
          error: error.message ?? 'Erro ao gerar metas do setor',
          code: error.code ?? null,
          hint: error.hint ?? null,
          details: error.details ?? null,
        },
        { status: 500 }
      )
    }

    console.log('[API/METAS/SETOR/GENERATE] Success:', data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[API/METAS/SETOR/GENERATE] Exception:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
