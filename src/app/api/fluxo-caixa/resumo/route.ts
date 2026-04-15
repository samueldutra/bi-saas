import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'
import { buildCashFlowData } from '@/lib/fluxo-caixa/server'

import { cashFlowQuerySchema, getCashFlowFilters } from '../_shared'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    const validation = cashFlowQuerySchema.safeParse(queryParams)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const query = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, query.schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await buildCashFlowData(supabase, user.id, {
      schema: query.schema,
      dataInicio: query.data_inicio,
      dataFim: query.data_fim,
      filiais: query.filiais,
      filters: getCashFlowFilters(query),
    })

    return NextResponse.json({
      summary: data.summary,
      meta: data.meta,
    })
  } catch (error) {
    console.error('[API/FLUXO-CAIXA/RESUMO] Unexpected error:', error)

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
