import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { isValidSchema, validateSchemaAccess } from '@/lib/security/validate-schema'
import { isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RpcResult = {
  data: unknown
  error: { message?: string } | null
}

type RpcClient = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<RpcResult>
}

const generateMarginSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2100),
  metaMargemPercentual: z.number().min(0).max(100),
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
    const validation = generateMarginSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const {
      schema,
      filialId: requestedFilialId,
      mes,
      ano,
      metaMargemPercentual,
    } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    let finalFilialId: number

    if (authorizedBranches === null) {
      if (!requestedFilialId) {
        return NextResponse.json(
          { error: 'filialId é obrigatório' },
          { status: 400 }
        )
      }

      const parsed = parseInt(String(requestedFilialId), 10)
      if (isNaN(parsed)) {
        return NextResponse.json(
          { error: 'filialId inválido' },
          { status: 400 }
        )
      }

      finalFilialId = parsed
    } else {
      if (authorizedBranches.length === 0) {
        return NextResponse.json(
          { error: 'Usuário não tem acesso a nenhuma filial' },
          { status: 403 }
        )
      }

      if (!requestedFilialId || requestedFilialId === 'all') {
        return NextResponse.json(
          { error: 'filialId é obrigatório para usuários com acesso restrito' },
          { status: 400 }
        )
      }

      const requestedIdStr = String(requestedFilialId)
      const parsed = parseInt(requestedIdStr, 10)

      if (isNaN(parsed)) {
        return NextResponse.json(
          { error: 'filialId inválido' },
          { status: 400 }
        )
      }

      if (!authorizedBranches.includes(requestedIdStr)) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso à filial solicitada' },
          { status: 403 }
        )
      }

      finalFilialId = parsed
    }

    const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
    const endDate = mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    const dataReferenciaInicial = startDate

    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()
    const rpcClient = directSupabase as unknown as RpcClient

    const { data: existingMetas, error: existingMetasError } = await directSupabase
      .schema(schema as 'public')
      .from('metas_mensais')
      .select('id')
      .eq('filial_id', finalFilialId)
      .gte('data', startDate)
      .lt('data', endDate)

    if (existingMetasError) {
      console.error('[API/METAS/GENERATE-MARGIN] Error checking existing metas:', existingMetasError)
      return NextResponse.json(
        { error: 'Erro ao validar metas existentes' },
        { status: 500 }
      )
    }

    if ((existingMetas?.length ?? 0) === 0) {
      const useFaturamentoMetas = await isFaturamentoMetasEnabled(schema)
      const rpcName = useFaturamentoMetas
        ? 'generate_metas_mensais_com_faturamento'
        : 'generate_metas_mensais'

      let { data: rpcData, error: rpcError } = await rpcClient.rpc(rpcName, {
        p_schema: schema,
        p_filial_id: finalFilialId,
        p_mes: mes,
        p_ano: ano,
        p_meta_percentual: 0,
        p_meta_margem_percentual: metaMargemPercentual,
        p_data_referencia_inicial: dataReferenciaInicial
      })

      if (rpcError && useFaturamentoMetas) {
        const fallback = await rpcClient.rpc('generate_metas_mensais', {
          p_schema: schema,
          p_filial_id: finalFilialId,
          p_mes: mes,
          p_ano: ano,
          p_meta_percentual: 0,
          p_meta_margem_percentual: metaMargemPercentual,
          p_data_referencia_inicial: dataReferenciaInicial
        })
        rpcData = fallback.data
        rpcError = fallback.error
      }

      if (rpcError) {
        console.error('[API/METAS/GENERATE-MARGIN] Error creating metas:', rpcError)
        return NextResponse.json(
          { error: 'Erro ao gerar meta de margem' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ...(typeof rpcData === 'object' && rpcData !== null ? rpcData : {}),
        success: true,
        message: 'Meta de margem gerada com sucesso para o período',
      })
    }

    const { data, error } = await directSupabase
      .schema(schema as 'public')
      .from('metas_mensais')
      .update({
        meta_margem_percentual: metaMargemPercentual,
      })
      .eq('filial_id', finalFilialId)
      .gte('data', startDate)
      .lt('data', endDate)
      .select('id')

    if (error) {
      console.error('[API/METAS/GENERATE-MARGIN] Error:', error)
      return NextResponse.json(
        { error: 'Erro ao gerar meta de margem' },
        { status: 500 }
      )
    }

    const metasAtualizadas = data?.length ?? 0

    if (metasAtualizadas === 0) {
      return NextResponse.json(
        {
          error: 'Nenhuma meta encontrada para o período selecionado',
          success: false,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      metas_atualizadas: metasAtualizadas,
      message: `${metasAtualizadas} metas de margem atualizadas para o período`,
    })
  } catch (error) {
    console.error('[API/METAS/GENERATE-MARGIN] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
