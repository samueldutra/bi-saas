import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { isApiFilialVendasEnabled, isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'
import { isValidSchema, validateSchemaAccess } from '@/lib/security/validate-schema'
import { z } from 'zod'

const updateValoresSchema = z.object({
  schema: z.string().min(1, 'Schema é obrigatório').refine(isValidSchema, 'Schema inválido'),
  mes: z.coerce.number().int().min(1, 'Mês inválido').max(12, 'Mês inválido'),
  ano: z.coerce.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido'),
  setor_id: z.coerce.number().int().positive().optional().nullable(),
  filial_ids: z.array(z.coerce.number().int().positive()).optional().nullable(),
})

function toDateOnlyUTC(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const validation = updateValoresSchema.safeParse(await req.json())

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Schema, mês e ano são obrigatórios', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema, mes, ano, setor_id, filial_ids } = validation.data

    console.log('[API/METAS/SETOR/UPDATE] Request params:', { schema, mes, ano, setor_id, filial_ids })

    const hasSchemaAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasSchemaAccess) {
      return NextResponse.json(
        { error: 'Sem permissão para acessar este schema' },
        { status: 403 }
      )
    }

    const useApiFilialVendas = await isApiFilialVendasEnabled(schema)

    if (useApiFilialVendas) {
      const dataInicio = toDateOnlyUTC(ano, mes, 1)
      const dataFim = toDateOnlyUTC(ano, mes, getLastDayOfMonth(ano, mes))
      const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)
      const requestedFilialIds = filial_ids?.filter((id, index, list) => list.indexOf(id) === index) ?? null
      let finalFilialIds: number[] | null = null

      if (authorizedBranches === null) {
        finalFilialIds = requestedFilialIds && requestedFilialIds.length > 0 ? requestedFilialIds : null
      } else {
        if (authorizedBranches.length === 0) {
          return NextResponse.json(
            { error: 'Usuário não possui acesso a nenhuma filial' },
            { status: 403 }
          )
        }

        const authorizedIds = authorizedBranches
          .map((id) => parseInt(id, 10))
          .filter((id) => Number.isFinite(id))

        if (requestedFilialIds && requestedFilialIds.length > 0) {
          const authorizedSet = new Set(authorizedIds)
          finalFilialIds = requestedFilialIds.filter((id) => authorizedSet.has(id))

          if (finalFilialIds.length === 0) {
            return NextResponse.json(
              { error: 'Sem permissão para atualizar as filiais solicitadas' },
              { status: 403 }
            )
          }
        } else {
          finalFilialIds = authorizedIds
        }
      }

      // Quando a fonte /filial/vendas estiver ativa, os realizados de setor
      // sao materializados em uma snapshot paralela para manter o legado intacto.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('refresh_vendas_setores_snapshot_api_filial_vendas', {
        p_schema: schema,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_setor_id: setor_id ?? null,
        p_filial_ids: finalFilialIds && finalFilialIds.length > 0 ? finalFilialIds : null
      })

      if (error) {
        console.error('[API/METAS/SETOR/UPDATE] RPC API filial/vendas error:', error)
        return safeErrorResponse(error, 'metas-setor-update-valores-api-filial-vendas')
      }

      console.log('[API/METAS/SETOR/UPDATE] API filial/vendas success:', data)

      return NextResponse.json({
        success: true,
        message: 'Snapshot de vendas por setor atualizada com sucesso',
        data: {
          ...(data || {}),
          sales_source: 'api_filial_vendas',
          profit_source: 'vendas_setores_snapshot'
        }
      })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (!profile || !['superadmin', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Apenas admins podem atualizar valores realizados' },
        { status: 403 }
      )
    }

    const useFaturamentoMetas = await isFaturamentoMetasEnabled(schema)
    const rpcName = useFaturamentoMetas
      ? 'atualizar_valores_realizados_todos_setores_com_faturamento'
      : 'atualizar_valores_realizados_todos_setores'

    // Chamar função RPC para atualizar valores realizados de TODOS os setores
    // A função processa todos os setores ativos do schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (supabase.rpc as any)(rpcName, {
      p_schema: schema,
      p_mes: mes,
      p_ano: ano
    })

    if (error && useFaturamentoMetas) {
      console.warn('[API/METAS/SETOR/UPDATE] RPC com faturamento falhou, fallback legado:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (supabase.rpc as any)('atualizar_valores_realizados_todos_setores', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano
      })
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[API/METAS/SETOR/UPDATE] RPC Error:', error)
      return safeErrorResponse(error, 'metas-setor-update-valores')
    }

    console.log('[API/METAS/SETOR/UPDATE] Success:', data)

    return NextResponse.json({ 
      success: true,
      message: 'Valores realizados atualizados com sucesso',
      data 
    })
  } catch (error) {
    console.error('[API/METAS/SETOR/UPDATE] Error:', error)
    return safeErrorResponse(error, 'metas-setor-update-valores')
  }
}
