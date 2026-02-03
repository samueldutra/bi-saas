#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

const DEFAULT_SCHEMA = "paraiso"
const DEFAULT_START = "2025-01-01"
const DEFAULT_END = "2026-02-01"
const DEFAULT_FILIAIS = [
  5, 12, 23, 28, 30, 31, 32, 33, 34, 35, 41, 46, 56, 57, 74, 78, 79, 80, 82, 84, 85, 86
]

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i]
    if (!key.startsWith("--")) continue
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true"
    args[key.slice(2)] = value
    if (value !== "true") i += 1
  }
  return args
}

function isValidDate(value) {
  return !Number.isNaN(Date.parse(value))
}

function buildOperations(start, end, filiais) {
  const ops = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)

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

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000))
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const schema = args.schema || DEFAULT_SCHEMA
  const start = args.start || DEFAULT_START
  const end = args.end || DEFAULT_END
  const filiais = (args.filiais ? args.filiais.split(",") : DEFAULT_FILIAIS).map((v) => Number(v)).filter(Boolean)
  const sleepSeconds = args.sleep ? Number(args.sleep) : 1
  const cursor = args.cursor ? Number(args.cursor) : 0
  const limit = args.limit ? Number(args.limit) : null
  const dryRun = args.dry_run === "true"

  if (!isValidDate(start) || !isValidDate(end)) {
    console.error("start/end inválidos. Use YYYY-MM-DD")
    process.exit(1)
  }
  if (!Array.isArray(filiais) || filiais.length === 0) {
    console.error("filiais deve conter ao menos um ID")
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const ops = buildOperations(start, end, filiais)

  if (cursor < 0 || cursor > ops.length) {
    console.error("cursor inválido")
    process.exit(1)
  }

  const endCursor = limit ? Math.min(ops.length, cursor + limit) : ops.length
  console.log(`Ops totais: ${ops.length} | Executando de ${cursor} até ${endCursor - 1}`)

  for (let i = cursor; i < endCursor; i += 1) {
    const op = ops[i]
    const startedAt = Date.now()
    let rows = 0

    if (!dryRun) {
      const { data, error } = await supabase.rpc("backfill_vendas_mensal_produto", {
        p_schema: schema,
        p_ano: op.year,
        p_mes: op.month,
        p_filial_id: op.filial,
      })
      if (error) {
        console.error(`[${i}] ${op.year}-${op.month} filial ${op.filial} ERROR:`, error.message)
        continue
      }
      rows = typeof data === "number" ? data : 0
    }

    const durationMs = Date.now() - startedAt
    console.log(`[${i}] ${op.year}-${String(op.month).padStart(2, "0")} filial ${op.filial} | linhas ${rows} | ${durationMs} ms`)

    if (sleepSeconds > 0) {
      await sleep(sleepSeconds)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
