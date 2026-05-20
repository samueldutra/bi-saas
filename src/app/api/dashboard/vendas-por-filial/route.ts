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
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')
    const requestedFiliais = searchParams.get('filiais') || 'all'
    const filterType = searchParams.get('filter_type') || 'month' // 'month', 'year', 'custom'

    if (!schema || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: schema, data_inicio, data_fim' },
        { status: 400 }
      )
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filiais to use
    let finalFiliais: string

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      finalFiliais = requestedFiliais
    } else if (requestedFiliais === 'all') {
      // User requested all but has restrictions - use authorized branches as comma-separated string
      finalFiliais = authorizedBranches.join(',')
    } else {
      // User requested specific filiais - filter by authorized
      const requestedArray = requestedFiliais.split(',').map(f => f.trim())
      const allowedFiliais = requestedArray.filter(f => authorizedBranches.includes(f))

      // If none of requested filiais are authorized, use all authorized
      finalFiliais = allowedFiliais.length > 0
        ? allowedFiliais.join(',')
        : authorizedBranches.join(',')
    }

    console.log('[API/DASHBOARD/VENDAS-POR-FILIAL] Params:', {
      schema,
      dataInicio,
      dataFim,
      requestedFiliais,
      finalFiliais,
      filterType,
      authorizedBranches
    })

    // TEMPORÁRIO: Usar client direto sem cache (igual ao dashboard)
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()
    const useApiFilialVendas = await isApiFilialVendasEnabled(schema)
    const rpcName = useApiFilialVendas
      ? 'get_vendas_por_filial_api_filial_vendas'
      : 'get_vendas_por_filial'

    console.log('[API/DASHBOARD/VENDAS-POR-FILIAL] RPC Params:', {
      rpcName,
      useApiFilialVendas,
      schema,
      dataInicio,
      dataFim,
      finalFiliais,
      filterType,
    })

    // Chamar função RPC
    const { data, error } = await directSupabase.rpc(rpcName, {
      p_schema: schema,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_filiais: finalFiliais,
      p_filter_type: filterType
    } as never)

    if (error) {
      console.error('[API/DASHBOARD/VENDAS-POR-FILIAL] RPC Error:', { rpcName, error })
      return NextResponse.json({ error: 'Error fetching sales data' }, { status: 500 })
    }

    let totalSkuDistinct = 0
    let paTotalSkuDistinct = 0

    if (useApiFilialVendas) {
      const vendas = Array.isArray(data) ? data : []

      totalSkuDistinct = vendas.reduce(
        (total, venda: { total_sku?: number | string | null }) => total + Number(venda.total_sku || 0),
        0
      )
      paTotalSkuDistinct = vendas.reduce(
        (total, venda: { pa_total_sku?: number | string | null }) => total + Number(venda.pa_total_sku || 0),
        0
      )
    } else {
      // Buscar total de SKUs distintos (produtos vendidos no período - não somar por filial!)
      const { data: totalSkuData, error: skuError } = await directSupabase.rpc('get_total_sku_distinct', {
        p_schema: schema,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_filiais: finalFiliais
      } as never)

      console.log('[DEBUG] get_total_sku_distinct response:', {
        data: totalSkuData,
        error: skuError,
        extracted: totalSkuData?.[0]?.total_sku
      })

      // Buscar total de SKUs distintos do período anterior
      const { data: totalSkuPaData, error: skuPaError } = await directSupabase.rpc('get_total_sku_distinct_pa', {
        p_schema: schema,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_filiais: finalFiliais,
        p_filter_type: filterType
      } as never)

      console.log('[DEBUG] get_total_sku_distinct_pa response:', {
        data: totalSkuPaData,
        error: skuPaError,
        extracted: totalSkuPaData?.[0]?.pa_total_sku
      })

      totalSkuDistinct = totalSkuData?.[0]?.total_sku || 0
      paTotalSkuDistinct = totalSkuPaData?.[0]?.pa_total_sku || 0
    }

    return NextResponse.json(
      {
        vendas: data || [],
        total_sku_distinct: totalSkuDistinct,
        pa_total_sku_distinct: paTotalSkuDistinct,
        sales_source: useApiFilialVendas ? 'api_filial_vendas' : 'legacy',
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )

  } catch (error) {
    console.error('[API/DASHBOARD/VENDAS-POR-FILIAL] Erro:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
