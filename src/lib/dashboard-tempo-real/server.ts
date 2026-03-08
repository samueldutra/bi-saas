import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { createDirectClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export const DASHBOARD_TEMPO_REAL_FILIAL_COLORS = [
  'hsl(142, 76%, 45%)',
  'hsl(200, 70%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 55%)',
  'hsl(350, 70%, 55%)',
  'hsl(170, 60%, 45%)',
  'hsl(60, 70%, 50%)',
  'hsl(320, 60%, 50%)',
] as const

export function getDashboardTempoRealFilialColor(index: number) {
  return DASHBOARD_TEMPO_REAL_FILIAL_COLORS[index % DASHBOARD_TEMPO_REAL_FILIAL_COLORS.length]
}

export function resolveFiliaisFromAuthorization(
  requestedFiliais: string | undefined,
  authorizedBranches: string[] | null
): number[] | null {
  if (authorizedBranches === null) {
    if (requestedFiliais && requestedFiliais !== 'all') {
      return requestedFiliais
        .split(',')
        .map((filial) => parseInt(filial.trim(), 10))
        .filter((value) => !isNaN(value))
    }

    return null
  }

  const authorizedIds = authorizedBranches
    .map((filial) => parseInt(filial, 10))
    .filter((value) => !isNaN(value))

  if (!requestedFiliais || requestedFiliais === 'all') {
    return authorizedIds
  }

  const allowedFiliais = requestedFiliais
    .split(',')
    .filter((filial) => authorizedBranches.includes(filial))

  if (allowedFiliais.length > 0) {
    return allowedFiliais
      .map((filial) => parseInt(filial, 10))
      .filter((value) => !isNaN(value))
  }

  return authorizedIds
}

export async function getAuthorizedRealtimeFiliais(
  supabase: ServerSupabaseClient,
  userId: string,
  requestedFiliais?: string
) {
  const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, userId)
  return resolveFiliaisFromAuthorization(requestedFiliais, authorizedBranches)
}

export function getRealtimeDirectClient() {
  return createDirectClient()
}

type UntypedRpcClient = {
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

export async function callRealtimeRpc<T>(
  supabase: ServerSupabaseClient,
  fn: string,
  params?: Record<string, unknown>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const rpcClient = supabase as unknown as UntypedRpcClient
  const result = await rpcClient.rpc(fn, params)

  return {
    data: (result.data as T[] | null) ?? null,
    error: result.error,
  }
}

export function getRealtimeCurrentDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
}

export async function getTenantIdBySchema(
  supabase: ServerSupabaseClient,
  schema: string
): Promise<string | null> {
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('supabase_schema', schema)
    .single() as { data: { id: string } | null }

  return data?.id ?? null
}

export async function getBranchNameMapForTenant(
  supabase: ServerSupabaseClient,
  tenantId: string | null
): Promise<Map<string, string>> {
  const branchNameMap = new Map<string, string>()

  if (!tenantId) {
    return branchNameMap
  }

  const { data } = await supabase
    .from('branches')
    .select('branch_code, descricao')
    .eq('tenant_id', tenantId) as { data: { branch_code: string; descricao: string | null }[] | null }

  if (data) {
    data.forEach((branch) => {
      branchNameMap.set(
        branch.branch_code,
        branch.descricao || `Filial ${branch.branch_code}`
      )
    })
  }

  return branchNameMap
}

export function parseRealtimeNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function calculateRealtimeItemRevenue(item: {
  quantidade_vendida?: string | number | null
  preco_venda?: string | number | null
  valor_desconto?: string | number | null
  valor_acrescimo?: string | number | null
}) {
  const quantidade = parseRealtimeNumber(item.quantidade_vendida)
  const preco = parseRealtimeNumber(item.preco_venda)
  const desconto = parseRealtimeNumber(item.valor_desconto)
  const acrescimo = parseRealtimeNumber(item.valor_acrescimo)

  return quantidade * preco - desconto + acrescimo
}

export function calculateSimpleItemRevenue(item: {
  quantidade_vendida?: string | number | null
  preco_venda?: string | number | null
}) {
  return parseRealtimeNumber(item.quantidade_vendida) * parseRealtimeNumber(item.preco_venda)
}

export function isOfertaItem(ofertaId: unknown) {
  const normalized = ofertaId ? String(ofertaId).trim() : ''
  return normalized.length > 0
}

export function calculatePercentage(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return (value / total) * 100
}

type RealtimeMonitorMeta = Record<string, string | number | boolean | null | undefined>

type RealtimeMonitorStep = {
  step: string
  durationMs: number
  meta?: RealtimeMonitorMeta
}

export function createRealtimeRouteMonitor(route: string) {
  const startedAt = Date.now()
  let lastMark = startedAt
  const steps: RealtimeMonitorStep[] = []

  return {
    mark(step: string, meta?: RealtimeMonitorMeta) {
      const now = Date.now()
      steps.push({
        step,
        durationMs: now - lastMark,
        ...(meta ? { meta } : {}),
      })
      lastMark = now
    },
    finish(meta?: RealtimeMonitorMeta) {
      console.info(`[${route}] PERF`, {
        route,
        totalMs: Date.now() - startedAt,
        steps,
        ...(meta ? { meta } : {}),
      })
    },
    fail(error: unknown, meta?: RealtimeMonitorMeta) {
      console.error(`[${route}] PERF_ERROR`, {
        route,
        totalMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown_error',
        steps,
        ...(meta ? { meta } : {}),
      })
    },
  }
}
