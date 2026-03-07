import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAuthorizedRealtimeFiliais,
  getBranchNameMapForTenant,
  getDashboardTempoRealFilialColor,
  getRealtimeDirectClient,
  getTenantIdBySchema,
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
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = querySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema: requestedSchema, filiais } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const finalFiliais = await getAuthorizedRealtimeFiliais(supabase, user.id, filiais)

    // Direct Supabase client for schema queries
    const directSupabase = getRealtimeDirectClient()

    // Query vendas por hora
    let vendasQuery = directSupabase
      .schema(requestedSchema as 'public')
      .from('vendas_hoje')
      .select('filial_id, horario, valor_total')
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

    const tenantId = await getTenantIdBySchema(supabase, requestedSchema)
    const branchNameMap = await getBranchNameMapForTenant(supabase, tenantId)

    // Group data by hour and filial
    const hourlyData: Record<string, Record<string, number>> = {}
    const filiaisSet = new Set<number>()

    // Initialize hours from 06:00 to 23:00
    for (let h = 6; h <= 23; h++) {
      const hourKey = `${h.toString().padStart(2, '0')}:00`
      hourlyData[hourKey] = {}
    }

    if (vendasData) {
      vendasData.forEach((venda) => {
        const horario = venda.horario
        if (!horario) return

        // Extract hour from horario (format: "HH:MM:SS" or timestamp)
        let hour: number
        if (typeof horario === 'string') {
          const parts = horario.split(':')
          hour = parseInt(parts[0], 10)
        } else {
          const date = new Date(horario)
          hour = date.getHours()
        }

        if (hour < 6 || hour > 23) return

        const hourKey = `${hour.toString().padStart(2, '0')}:00`
        const filialId = venda.filial_id
        const valor = parseFloat(venda.valor_total) || 0

        filiaisSet.add(filialId)

        if (!hourlyData[hourKey][filialId]) {
          hourlyData[hourKey][filialId] = 0
        }
        hourlyData[hourKey][filialId] += valor
      })
    }

    // Build filiais array with colors
    const filiaisArray = Array.from(filiaisSet).sort((a, b) => a - b)
    const filiaisInfo = filiaisArray.map((id, index) => ({
      id,
      nome: branchNameMap.get(id.toString()) || `Filial ${id}`,
      cor: getDashboardTempoRealFilialColor(index),
    }))

    // Convert hourly data to array format with cumulative values
    const dataArray: Array<{ hora: string; [key: string]: string | number }> = []
    const cumulativeByFilial: Record<number, number> = {}

    // Initialize cumulative values
    filiaisArray.forEach((id) => {
      cumulativeByFilial[id] = 0
    })

    // Build data array with cumulative values
    for (let h = 6; h <= 23; h++) {
      const hourKey = `${h.toString().padStart(2, '0')}:00`
      const row: { hora: string; [key: string]: string | number } = { hora: hourKey }

      filiaisArray.forEach((filialId) => {
        const valorHora = hourlyData[hourKey][filialId] || 0
        cumulativeByFilial[filialId] += valorHora
        row[filialId.toString()] = cumulativeByFilial[filialId]
      })

      dataArray.push(row)
    }

    const result = {
      data: dataArray,
      filiais: filiaisInfo,
    }

    console.log('[API/DASHBOARD-TEMPO-REAL/VENDAS-POR-HORA] Result filiais:', filiaisInfo.length)

    return NextResponse.json(result)
  } catch (e) {
    const error = e as Error
    console.error('Unexpected error in dashboard-tempo-real/vendas-por-hora API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
