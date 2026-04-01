
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'
import { isApiFilialVendasEnabled } from '@/lib/tenant-parameters-server'

// FORÇAR ROTA DINÂMICA - NÃO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Valida o schema da query
const querySchema = z.object({
  schema: z.string().min(1),
  filiais: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  filter_type: z.enum(['month', 'year', 'custom']).optional(),
});

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries());

    const validation = querySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const {
      schema: requestedSchema,
      filiais: requestedFiliais,
      data_inicio: requestedDataInicio,
      data_fim: requestedDataFim,
      filter_type: requestedFilterType,
    } = validation.data;

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filiais to use
    let finalFiliais: string | null = null

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      if (requestedFiliais && requestedFiliais !== 'all') {
        finalFiliais = requestedFiliais
      }
    } else if (!requestedFiliais || requestedFiliais === 'all') {
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

    const currentYear = new Date().getFullYear()
    const dataInicio = requestedDataInicio || `${currentYear}-01-01`
    const dataFim = requestedDataFim || `${currentYear}-12-31`
    const filterType = requestedFilterType || 'year'

    console.log('[API/CHARTS/SALES-BY-MONTH] Params:', {
      requestedSchema,
      requestedFiliais,
      finalFiliais,
      authorizedBranches,
      dataInicio,
      dataFim,
      filterType,
    })

    // TEMPORÁRIO: Usar client direto sem cache (igual ao dashboard)
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()
    const useApiFilialVendas = await isApiFilialVendasEnabled(requestedSchema)
    const salesRpcName = useApiFilialVendas
      ? 'get_sales_by_month_chart_api_filial_vendas'
      : 'get_sales_by_month_chart'
    const lucroRpcName = useApiFilialVendas
      ? 'get_lucro_by_month_chart_api_filial_vendas'
      : 'get_lucro_by_month_chart'

    // Call RPC with filiais parameter for branch filtering - Sales
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: salesData, error: salesError } = await (directSupabase as any).rpc(salesRpcName, {
      schema_name: requestedSchema,
      p_filiais: finalFiliais || 'all',
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_filter_type: filterType,
    });

    if (salesError) {
      console.error('[API/CHARTS/SALES-BY-MONTH] Sales RPC Error:', { salesRpcName, salesError });
      return NextResponse.json({ error: 'Error fetching sales chart data' }, { status: 500 });
    }

    // Call RPC to get expenses by month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: expensesData, error: expensesError } = await (directSupabase as any).rpc('get_expenses_by_month_chart', {
      schema_name: requestedSchema,
      p_filiais: finalFiliais || 'all',
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_filter_type: filterType,
    });

    if (expensesError) {
      console.error('[API/CHARTS/SALES-BY-MONTH] Expenses RPC Error:', expensesError);
      // Continue without expenses data if the function doesn't exist yet
      console.warn('[API/CHARTS/SALES-BY-MONTH] Continuing without expense data');
    }

    // Call RPC to get lucro (profit) by month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lucroData, error: lucroError } = await (directSupabase as any).rpc(lucroRpcName, {
      schema_name: requestedSchema,
      p_filiais: finalFiliais || 'all',
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_filter_type: filterType,
    });

    if (lucroError) {
      console.error('[API/CHARTS/SALES-BY-MONTH] Lucro RPC Error:', { lucroRpcName, lucroError });
      console.warn('[API/CHARTS/SALES-BY-MONTH] Continuing without lucro data');
    }

    // Call RPC to get faturamento by month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: faturamentoData, error: faturamentoError } = await (directSupabase as any).rpc('get_faturamento_by_month_chart', {
      schema_name: requestedSchema,
      p_filiais: finalFiliais || 'all',
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_filter_type: filterType,
    });

    if (faturamentoError) {
      console.error('[API/CHARTS/SALES-BY-MONTH] Faturamento RPC Error:', faturamentoError);
      console.warn('[API/CHARTS/SALES-BY-MONTH] Continuing without faturamento data');
    }

    console.log('[API/CHARTS/SALES-BY-MONTH] Sales data:', salesData?.length || 0, 'records')
    console.log('[API/CHARTS/SALES-BY-MONTH] Expenses data:', expensesData?.length || 0, 'records')
    console.log('[API/CHARTS/SALES-BY-MONTH] Lucro data:', lucroData?.length || 0, 'records')
    console.log('[API/CHARTS/SALES-BY-MONTH] Faturamento data:', faturamentoData?.length || 0, 'records')
    if (expensesData && expensesData.length > 0) {
      console.log('[API/CHARTS/SALES-BY-MONTH] Sample expense:', expensesData[0])
    }
    if (lucroData && lucroData.length > 0) {
      console.log('[API/CHARTS/SALES-BY-MONTH] Sample lucro:', lucroData[0])
    }
    if (faturamentoData && faturamentoData.length > 0) {
      console.log('[API/CHARTS/SALES-BY-MONTH] Sample faturamento:', faturamentoData[0])
    }

    // Merge sales, expenses, lucro and faturamento data by month
    const mergedData = (salesData || []).map((sale: { mes: string; total_vendas: number; total_vendas_ano_anterior: number }) => {
      const expense = expensesData?.find((exp: { mes: string }) => exp.mes === sale.mes)
      const lucro = lucroData?.find((luc: { mes: string }) => luc.mes === sale.mes)
      const faturamento = faturamentoData?.find((fat: { mes: string }) => fat.mes === sale.mes)
      return {
        mes: sale.mes,
        // PDV data
        total_vendas: sale.total_vendas,
        total_vendas_ano_anterior: sale.total_vendas_ano_anterior,
        total_despesas: expense?.total_despesas || 0,
        total_despesas_ano_anterior: expense?.total_despesas_ano_anterior || 0,
        total_lucro: lucro?.total_lucro || 0,
        total_lucro_ano_anterior: lucro?.total_lucro_ano_anterior || 0,
        // Faturamento data
        total_faturamento: faturamento?.total_faturamento || 0,
        total_faturamento_ano_anterior: faturamento?.total_faturamento_ano_anterior || 0,
        total_lucro_faturamento: faturamento?.total_lucro_faturamento || 0,
        total_lucro_faturamento_ano_anterior: faturamento?.total_lucro_faturamento_ano_anterior || 0,
      }
    })

    console.log('[API/CHARTS/SALES-BY-MONTH] Merged data sample:', mergedData[0])

    return NextResponse.json(mergedData);

  } catch (e) {
    const error = e as Error;
    console.error('Unexpected error in sales chart API:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
