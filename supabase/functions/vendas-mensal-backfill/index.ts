import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type BackfillRequest = {
  schema?: string
  start?: string
  end?: string
  mode?: string
  filiais?: number[]
  sleep_seconds?: number
  max_operations?: number
  cursor?: number
  dry_run?: boolean
}

type Operation = {
  year: number
  month: number
  filial: number
}

const DEFAULT_FILIAIS = [5, 12, 23, 28, 30, 31, 32, 33, 34, 35, 41, 46, 56, 57, 74, 78, 79, 80, 82, 84, 85, 86]
const DEFAULT_SLEEP_SECONDS = 1
const DEFAULT_MAX_OPS = 20

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000))

const isValidDate = (value: string) => !Number.isNaN(Date.parse(value))

const buildOperations = (start: string, end: string, filiais: number[]): Operation[] => {
  const ops: Operation[] = []
  const cursor = new Date(start + "T00:00:00Z")
  const endDate = new Date(end + "T00:00:00Z")

  while (cursor < endDate) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth() + 1
    for (const filial of filiais) {
      ops.push({ year, month, filial })
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return ops
}

const buildOperationsForMonths = (months: Array<{ year: number; month: number }>, filiais: number[]): Operation[] => {
  const ops: Operation[] = []
  for (const item of months) {
    for (const filial of filiais) {
      ops.push({ year: item.year, month: item.month, filial })
    }
  }
  return ops
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Use POST" })
  }

  const token = req.headers.get("x-backfill-token")
  const expectedToken = Deno.env.get("BACKFILL_TOKEN")
  if (expectedToken && token !== expectedToken) {
    return jsonResponse(401, { error: "Unauthorized" })
  }

  let payload: BackfillRequest = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  const schema = payload.schema?.trim()
  const start = payload.start?.trim()
  const end = payload.end?.trim()
  const mode = payload.mode?.trim()
  const filiais = payload.filiais?.length ? payload.filiais : DEFAULT_FILIAIS
  const sleepSeconds = payload.sleep_seconds ?? DEFAULT_SLEEP_SECONDS
  const maxOps = payload.max_operations ?? DEFAULT_MAX_OPS
  const cursor = payload.cursor ?? 0
  const dryRun = payload.dry_run ?? false

  if (!schema) {
    return jsonResponse(400, { error: "schema é obrigatório" })
  }
  if (mode !== "auto_current_prev") {
    if (!start || !end || !isValidDate(start) || !isValidDate(end)) {
      return jsonResponse(400, { error: "start/end inválidos. Use YYYY-MM-DD" })
    }
  }

  if (!Array.isArray(filiais) || filiais.length === 0) {
    return jsonResponse(400, { error: "filiais deve conter ao menos um ID" })
  }

  let ops: Operation[] = []
  let autoMonths: Array<{ year: number; month: number }> | null = null
  if (mode === "auto_current_prev") {
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1
    const prevDate = new Date(Date.UTC(currentYear, now.getUTCMonth() - 1, 1))
    autoMonths = [
      { year: prevDate.getUTCFullYear(), month: prevDate.getUTCMonth() + 1 },
      { year: currentYear, month: currentMonth },
    ]
    ops = buildOperationsForMonths(autoMonths, filiais)
  } else {
    ops = buildOperations(start as string, end as string, filiais)
  }
  if (cursor < 0 || cursor > ops.length) {
    return jsonResponse(400, { error: "cursor inválido" })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const results: Array<Record<string, unknown>> = []
  let nextCursor = cursor
  const endCursor = Math.min(ops.length, cursor + maxOps)

  for (let i = cursor; i < endCursor; i += 1) {
    const op = ops[i]
    const startedAt = Date.now()
    let rows = 0
    let error: string | null = null

    if (!dryRun) {
      try {
        const rpcResult = await supabase.rpc("backfill_vendas_mensal_produto", {
          p_schema: schema,
          p_ano: op.year,
          p_mes: op.month,
          p_filial_id: op.filial,
        })

        if (!rpcResult) {
          error = "RPC retornou resposta vazia"
        } else if (rpcResult.error) {
          error = rpcResult.error.message
        } else {
          rows = typeof rpcResult.data === "number" ? rpcResult.data : 0
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "Erro desconhecido ao chamar RPC"
      }
    }

    const durationMs = Date.now() - startedAt
    results.push({
      year: op.year,
      month: op.month,
      filial: op.filial,
      rows,
      duration_ms: durationMs,
      error,
    })

    nextCursor = i + 1

    if (sleepSeconds > 0) {
      await sleep(sleepSeconds)
    }
  }

  const hasMore = nextCursor < ops.length

  return jsonResponse(200, {
    schema,
    start: mode === "auto_current_prev" ? null : start,
    end: mode === "auto_current_prev" ? null : end,
    mode: mode ?? "range",
    auto_months: autoMonths,
    filiais,
    cursor,
    next_cursor: hasMore ? nextCursor : null,
    total_operations: ops.length,
    processed: results.length,
    dry_run: dryRun,
    results,
  })
})
