import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createRealtimeRouteMonitor,
  getAuthorizedRealtimeFiliais,
  getRealtimeCurrentDate,
  getRealtimeDirectClient,
  parseRealtimeNumber,
} from '@/lib/dashboard-tempo-real/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// FORCAR ROTA DINAMICA - NAO CACHEAR
export const dynamic = 'force-dynamic'
export const revalidate = 0

const querySchema = z.object({
  schema: z.string().min(1),
  filiais: z.string().optional(),
})

export async function GET(req: Request) {
  const monitor = createRealtimeRouteMonitor('API/DASHBOARD-TEMPO-REAL/VENDAS-POR-HORA')

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

    const { schema: requestedSchema, filiais } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    monitor.mark('schema_access')

    const finalFiliais = await getAuthorizedRealtimeFiliais(supabase, user.id, filiais)
    monitor.mark('authorized_filiais', { count: finalFiliais?.length ?? 0 })

    // Direct Supabase client for schema queries
    const directSupabase = getRealtimeDirectClient()
    const currentDate = getRealtimeCurrentDate()

    // Query vendas por hora
    let vendasQuery = directSupabase
      .schema(requestedSchema as 'public')
      .from('vendas_hoje')
      .select('horario, valor_total')
      .eq('data_extracao', currentDate)
      .eq('cancelada', false)
      .not('horario', 'is', null)

    if (finalFiliais && finalFiliais.length > 0) {
      vendasQuery = vendasQuery.in('filial_id', finalFiliais)
    }

    const { data: vendasData, error: vendasError } = await vendasQuery

    if (vendasError) {
      console.error('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-HORA] Query Error:', vendasError.message)
      return NextResponse.json(
        { error: 'Error fetching sales data' },
        { status: 500 }
      )
    }
    monitor.mark('query_vendas', { rows: vendasData?.length ?? 0 })

    const rangeData: Record<string, number> = {}

    for (let h = 6; h <= 22; h++) {
      const rangeKey = `${h.toString().padStart(2, '0')} às ${(h + 1).toString().padStart(2, '0')}`
      rangeData[rangeKey] = 0
    }

    const getRangeKeyFromHorario = (horario: string | Date) => {
      let hour: number
      let minute: number

      if (typeof horario === 'string') {
        const parts = horario.split(':')
        hour = parseInt(parts[0], 10)
        minute = parseInt(parts[1] ?? '0', 10)
      } else {
        hour = horario.getHours()
        minute = horario.getMinutes()
      }

      const rangeStartHour = minute === 0 ? hour - 1 : hour
      if (rangeStartHour < 6 || rangeStartHour > 22) {
        return null
      }

      return `${rangeStartHour.toString().padStart(2, '0')} às ${(rangeStartHour + 1).toString().padStart(2, '0')}`
    }

    if (vendasData) {
      vendasData.forEach((venda) => {
        if (!venda.horario) return

        const rangeKey = getRangeKeyFromHorario(venda.horario)
        if (!rangeKey) return

        rangeData[rangeKey] += parseRealtimeNumber(venda.valor_total)
      })
    }
    monitor.mark('group_by_range', { rows: vendasData?.length ?? 0, ranges: Object.keys(rangeData).length })

    const dataArray = Object.entries(rangeData).map(([faixa, total_vendas]) => ({
      faixa,
      total_vendas,
    }))
    monitor.mark('build_range_series', { rows: dataArray.length })

    const result = {
      data: dataArray,
    }

    const activeRanges = dataArray.filter((item) => item.total_vendas > 0).length
    console.log('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-HORA] Result faixas:', activeRanges)
    monitor.finish({
      currentDate,
      vendasRows: vendasData?.length ?? 0,
      faixas: dataArray.length,
      faixasAtivas: activeRanges,
      points: dataArray.length,
    })

    return NextResponse.json(result)
  } catch (e) {
    const error = e as Error
    monitor.fail(error)
    console.error('Unexpected error in dashboard-tempo-real/vendas-por-hora API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
