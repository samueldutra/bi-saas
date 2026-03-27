import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

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

    // Chamar função RPC
    const { data, error } = await directSupabase.rpc('get_vendas_por_filial', {
      p_schema: schema,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_filiais: finalFiliais,
      p_filter_type: filterType
    } as never)

    if (error) {
      console.error('[API/DASHBOARD/VENDAS-POR-FILIAL] RPC Error:', error)
      return NextResponse.json({ error: 'Error fetching sales data' }, { status: 500 })
    }

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

    return NextResponse.json({
      vendas: data || [],
      total_sku_distinct: totalSkuData?.[0]?.total_sku || 0,
      pa_total_sku_distinct: totalSkuPaData?.[0]?.pa_total_sku || 0
    })

  } catch (error) {
    console.error('[API/DASHBOARD/VENDAS-POR-FILIAL] Erro:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
