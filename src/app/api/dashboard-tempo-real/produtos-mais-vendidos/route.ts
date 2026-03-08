import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  callRealtimeRpc,
  createRealtimeRouteMonitor,
  getAuthorizedRealtimeFiliais,
  getRealtimeCurrentDate,
} from '@/lib/dashboard-tempo-real/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const querySchema = z.object({
  schema: z.string().min(1),
  filiais: z.string().optional(),
  limit: z.string().optional().default('10'),
})

export async function GET(req: Request) {
  const monitor = createRealtimeRouteMonitor('API/DASHBOARD-TEMPO-REAL/PRODUTOS')

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

    const { data: rpcData, error: rpcError } = await callRealtimeRpc<{
      produto_id: number | string | null
      descricao: string | null
      quantidade_vendida: number | string | null
      receita: number | string | null
      is_oferta: boolean | null
    }>(
      supabase,
      'get_dashboard_tempo_real_produtos_mais_vendidos',
      {
        p_schema: requestedSchema,
        p_data_extracao: currentDate,
        p_filial_ids: finalFiliais && finalFiliais.length > 0 ? finalFiliais : null,
        p_limit: limitNum,
      }
    )

    if (rpcError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/PRODUTOS] RPC Error:', rpcError.message)
      return NextResponse.json(
        { error: 'Error fetching produtos data' },
        { status: 500 }
      )
    }
    monitor.mark('rpc_produtos', { rows: rpcData?.length ?? 0 })

    const produtos = (rpcData || []).map((row) => ({
      produto_id: Number(row.produto_id),
      descricao: row.descricao || `Produto ${row.produto_id}`,
      quantidade_vendida: Number(row.quantidade_vendida || 0),
      receita: Number(row.receita || 0),
      is_oferta: Boolean(row.is_oferta),
    }))
    monitor.mark('build_response', { rows: produtos.length })

    console.log('[API/DASHBOARD-TEMPO-REAL/PRODUTOS] Result count:', produtos.length)
    monitor.finish({
      currentDate,
      rpcRows: rpcData?.length ?? 0,
      returnedProducts: produtos.length,
    })

    return NextResponse.json({ produtos })
  } catch (e) {
    const error = e as Error
    monitor.fail(error)
    console.error('Unexpected error in dashboard-tempo-real/produtos-mais-vendidos API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
