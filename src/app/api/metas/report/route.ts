import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'
import { isApiFilialVendasEnabled } from '@/lib/tenant-parameters-server'

// FORÇAR ROTA DINÂMICA - NÃO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')
    const requestedFilialId = searchParams.get('filial_id')

    if (!schema || !mes || !ano) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      )
    }

    // Validar acesso ao schema
    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filiais to use (can be array of IDs)
    let finalFilialIds: number[] | null = null

    if (authorizedBranches === null) {
      // User has no restrictions
      if (requestedFilialId) {
        // Parse comma-separated IDs or single ID
        const ids = requestedFilialId.split(',')
          .map(id => parseInt(id.trim(), 10))
          .filter(id => !isNaN(id))

        if (ids.length > 0) {
          finalFilialIds = ids
        }
      }
    } else {
      // User has restrictions
      if (!requestedFilialId) {
        // No filial requested - use all authorized
        finalFilialIds = authorizedBranches
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id))
      } else {
        // Specific filials requested - filter by authorized
        const requestedIds = requestedFilialId.split(',')
          .map(id => id.trim())
          .filter(id => authorizedBranches.includes(id))
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id))

        if (requestedIds.length > 0) {
          finalFilialIds = requestedIds
        } else {
          // None of requested are authorized - use all authorized
          finalFilialIds = authorizedBranches
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))
        }
      }
    }

    const params: Record<string, number | string | number[] | null> = {
      p_schema: schema,
      p_mes: parseInt(mes, 10),
      p_ano: parseInt(ano, 10),
      p_filial_id: null,
      p_filial_ids: finalFilialIds
    }

    // Usar client admin para RPC
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()
    const useApiFilialVendas = await isApiFilialVendasEnabled(schema)
    const rpcName = useApiFilialVendas
      ? 'get_metas_mensais_report_api_filial_vendas'
      : 'get_metas_mensais_report'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (directSupabase as any).rpc(rpcName, params)

    if (error) {
      console.error('[API/METAS/REPORT] RPC Error:', { rpcName, error })

      // Se a tabela não existe (primeira vez), retornar dados vazios ao invés de erro
      if (error.message && error.message.includes('does not exist')) {
        return NextResponse.json({
          metas: [],
          total_realizado: 0,
          total_meta: 0,
          total_custo: 0,
          total_lucro: 0,
          percentual_atingido: 0,
          margem_bruta: 0,
          meta_d1: 0,
          realizado_d1: 0,
          percentual_atingido_d1: 0,
          sales_source: useApiFilialVendas ? 'api_filial_vendas' : 'legacy'
        })
      }

      return NextResponse.json(
        { error: 'Erro ao buscar metas' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      data
        ? {
            ...(data as Record<string, unknown>),
            sales_source: useApiFilialVendas ? 'api_filial_vendas' : 'legacy'
          }
        : {
            metas: [],
            total_realizado: 0,
            total_meta: 0,
            total_custo: 0,
            total_lucro: 0,
            percentual_atingido: 0,
            margem_bruta: 0,
            meta_d1: 0,
            realizado_d1: 0,
            percentual_atingido_d1: 0,
            sales_source: useApiFilialVendas ? 'api_filial_vendas' : 'legacy'
          }
    )
  } catch (error) {
    console.error('[API/METAS/REPORT] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
