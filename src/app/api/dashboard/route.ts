import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'
import { isApiFilialVendasEnabled } from '@/lib/tenant-parameters-server'

// FORÇAR ROTA DINÂMICA - NÃO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Valida os novos parâmetros de filtro
const querySchema = z.object({
  schema: z.string().min(1),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  filiais: z.string().optional(), // ex: "1,4,7" ou "all"
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

    const { schema: requestedSchema, data_inicio, data_fim, filiais } = validation.data;

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filiais to use based on authorization
    let finalFiliais: string[] | null = null

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      finalFiliais = (filiais && filiais !== 'all') ? filiais.split(',') : null
    } else if (!filiais || filiais === 'all') {
      // User requested all but has restrictions - use authorized branches
      finalFiliais = authorizedBranches
    } else {
      // User requested specific filiais - filter by authorized
      const requestedFiliais = filiais.split(',')
      const allowedFiliais = requestedFiliais.filter(f => authorizedBranches.includes(f))

      // If none of requested filiais are authorized, use all authorized
      finalFiliais = allowedFiliais.length > 0 ? allowedFiliais : authorizedBranches
    }

    // Prepara os parâmetros para a função RPC
    const rpcParams = {
      schema_name: requestedSchema,
      p_data_inicio: data_inicio,
      p_data_fim: data_fim,
      p_filiais_ids: finalFiliais
    };

    const useApiFilialVendas = await isApiFilialVendasEnabled(requestedSchema)
    const rpcName = useApiFilialVendas
      ? 'get_dashboard_data_api_filial_vendas'
      : 'get_dashboard_data'

    // Usar client admin para RPC
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await directSupabase.rpc(rpcName, rpcParams as any).single();

    if (error) {
      console.error('[API/DASHBOARD] RPC Error:', { rpcName, error });
      return NextResponse.json({ error: 'Error fetching dashboard data' }, { status: 500 });
    }

    // A função RPC já retorna todos os dados necessários
    return NextResponse.json(data);

  } catch (e) {
    const error = e as Error;
    console.error('Unexpected error in dashboard API:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
