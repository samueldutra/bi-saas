import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createRealtimeRouteMonitor,
  getAuthorizedRealtimeFiliais,
  getRealtimeCurrentDate,
} from '@/lib/dashboard-tempo-real/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// FORCAR ROTA DINAMICA - NAO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

const querySchema = z.object({
  schema: z.string().min(1),
  filiais: z.string().optional(),
  limit: z.string().optional().default('10'),
})

export async function GET(req: Request) {
  const monitor = createRealtimeRouteMonitor('API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS')

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    monitor.mark('auth')

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = querySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }
    monitor.mark('validation')

    const { schema: requestedSchema, filiais, limit } = validation.data
    const limitNum = Math.min(parseInt(limit, 10), 100)

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    monitor.mark('schema_access')

    const finalFiliais = await getAuthorizedRealtimeFiliais(supabase, user.id, filiais)
    monitor.mark('authorized_filiais', { count: finalFiliais?.length ?? 0, limit: limitNum })

    const currentDate = getRealtimeCurrentDate()

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_dashboard_tempo_real_departamentos_receita',
      {
        p_schema: requestedSchema,
        p_data_extracao: currentDate,
        p_filial_ids: finalFiliais && finalFiliais.length > 0 ? finalFiliais : null,
        p_limit: limitNum,
      }
    )

    if (rpcError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS] RPC Error:', rpcError.message)
      return NextResponse.json(
        { error: 'Error fetching departamentos data' },
        { status: 500 }
      )
    }
    monitor.mark('rpc_departamentos', { rows: rpcData?.length ?? 0 })

    const receitaTotal =
      rpcData && rpcData.length > 0 ? Number(rpcData[0].receita_total || 0) : 0

    const departamentos = (rpcData || []).map((row) => ({
      departamento_id: Number(row.departamento_id || 0),
      departamento_nome: row.departamento_nome || 'Sem Departamento',
      receita: Number(row.receita || 0),
      participacao_percentual: Number(row.participacao_percentual || 0),
    }))

    monitor.mark('build_response', { rows: departamentos.length })

    console.log('[API/DASHBOARD-TEMPO-REAL/DEPARTAMENTOS] Result count:', departamentos.length)
    monitor.finish({
      currentDate,
      rpcRows: rpcData?.length ?? 0,
      departments: departamentos.length,
    })

    return NextResponse.json({
      receita_total: receitaTotal,
      departamentos,
    })
  } catch (e) {
    const error = e as Error
    monitor.fail(error)
    console.error('Unexpected error in dashboard-tempo-real/departamentos-receita API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
