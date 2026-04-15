import type { SupabaseClient } from '@supabase/supabase-js'

import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { createDirectClient } from '@/lib/supabase/admin'

import type {
  CashFlowBaseRow,
  CashFlowMeta,
  CashFlowSummaryResponse,
  CashFlowTableResponse,
  CashFlowFiltersState,
} from '@/components/fluxo-caixa/types'
import {
  buildCashFlowSummary,
  buildCashFlowTableRows,
} from '@/lib/fluxo-caixa/transform'

type CashFlowQueryParams = {
  schema: string
  dataInicio: string
  dataFim: string
  filiais?: string
  filters: Pick<
    CashFlowFiltersState,
    'breakdown' | 'grouping' | 'origin' | 'status' | 'viewMode'
  >
}

type CashFlowMovementBucket = {
  id: string
  date: string
  filialId: string
  filialLabel: string
  saldoInicial: number
  entradasPdv: number
  entradasFaturamento: number
  recebimentosRealizados: number
  recebimentosPrevistos: number
  outrasEntradas: number
  pagamentosRealizados: number
  pagamentosPrevistos: number
  outrasSaidas: number
  ajustes: number
}

type NumericLike = string | number | null | undefined

const MOCK_OPENING_BALANCE_OVERRIDES: Record<string, number> = {
  '1': 125000,
  '4': 98000,
  '9': 142000,
}

function getMockOpeningBalance(filialId: string) {
  if (MOCK_OPENING_BALANCE_OVERRIDES[filialId] !== undefined) {
    return MOCK_OPENING_BALANCE_OVERRIDES[filialId]
  }

  const parsed = Number.parseInt(filialId, 10)
  const offset = Number.isNaN(parsed) ? 2 : parsed % 5

  return 65000 + offset * 17500
}

function toNumber(value: NumericLike) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function isCanceledValue(value: string | null) {
  if (value === null) return false
  return value.trim().length > 0
}

function getOpenAmount(record: { saldo?: NumericLike; total_saldo?: NumericLike }) {
  return Math.max(toNumber(record.saldo), toNumber(record.total_saldo))
}

function getPaidAmount(record: { valor_pago?: NumericLike; total_pago?: NumericLike }) {
  return Math.max(toNumber(record.valor_pago), toNumber(record.total_pago))
}

function getReceivedAmount(record: { valor_recebido?: NumericLike; total_recebido?: NumericLike }) {
  return Math.max(toNumber(record.valor_recebido), toNumber(record.total_recebido))
}

function getOrCreateBucket(
  buckets: Map<string, CashFlowMovementBucket>,
  date: string,
  filialId: string
) {
  const key = `${date}-${filialId}`
  const existing = buckets.get(key)
  if (existing) return existing

  const next: CashFlowMovementBucket = {
    id: key,
    date,
    filialId,
    filialLabel: `Filial ${filialId}`,
    saldoInicial: 0,
    entradasPdv: 0,
    entradasFaturamento: 0,
    recebimentosRealizados: 0,
    recebimentosPrevistos: 0,
    outrasEntradas: 0,
    pagamentosRealizados: 0,
    pagamentosPrevistos: 0,
    outrasSaidas: 0,
    ajustes: 0,
  }

  buckets.set(key, next)
  return next
}

async function resolveAuthorizedFiliais(
  supabase: SupabaseClient,
  userId: string,
  requestedFiliais?: string
) {
  const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, userId)

  if (authorizedBranches === null) {
    return requestedFiliais && requestedFiliais !== 'all'
      ? requestedFiliais
          .split(',')
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => !Number.isNaN(value))
      : null
  }

  if (!requestedFiliais || requestedFiliais === 'all') {
    return authorizedBranches
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => !Number.isNaN(value))
  }

  const requested = requestedFiliais.split(',').map((value) => value.trim())
  const allowed = requested.filter((value) => authorizedBranches.includes(value))

  return (allowed.length > 0 ? allowed : authorizedBranches)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => !Number.isNaN(value))
}

export async function buildCashFlowData(
  supabase: SupabaseClient,
  userId: string,
  params: CashFlowQueryParams
): Promise<{
  baseRows: CashFlowBaseRow[]
  rows: CashFlowTableResponse['rows']
  summary: CashFlowSummaryResponse['summary']
  meta: CashFlowMeta
}> {
  const finalFiliais = await resolveAuthorizedFiliais(
    supabase,
    userId,
    params.filiais
  )

  const directSupabase = createDirectClient()
  const schemaClient = directSupabase.schema(params.schema as 'public')
  const warnings: string[] = [
    'Saldo inicial mockado por filial para visualização do módulo em produção, enquanto a fonte oficial de tesouraria não é definida.',
    'Ajustes manuais e compras fiscais da tabela entradas ainda não compõem o saldo financeiro líquido nesta versão.',
  ]

  const contasReceberRealizadasQuery = schemaClient
    .from('contas_receber')
    .select('filial_id, data_recebimento, valor_recebido, total_recebido')
    .not('data_recebimento', 'is', null)
    .gte('data_recebimento', params.dataInicio)
    .lte('data_recebimento', params.dataFim)

  const contasReceberPrevistasQuery = schemaClient
    .from('contas_receber')
    .select('filial_id, data_vencimento, saldo, total_saldo')
    .not('data_vencimento', 'is', null)
    .gte('data_vencimento', params.dataInicio)
    .lte('data_vencimento', params.dataFim)

  const contasPagarRealizadasQuery = schemaClient
    .from('contas_pagar')
    .select('filial_id, data_pagamento, valor_pago, total_pago')
    .not('data_pagamento', 'is', null)
    .gte('data_pagamento', params.dataInicio)
    .lte('data_pagamento', params.dataFim)

  const contasPagarPrevistasQuery = schemaClient
    .from('contas_pagar')
    .select('filial_id, data_vencimento, saldo, total_saldo')
    .not('data_vencimento', 'is', null)
    .gte('data_vencimento', params.dataInicio)
    .lte('data_vencimento', params.dataFim)

  const resumoPdvQuery = schemaClient
    .from('resumo_vendas_caixa')
    .select('filial_id, data, valor_total_vendas')
    .gte('data', params.dataInicio)
    .lte('data', params.dataFim)

  const faturamentoQuery = schemaClient
    .from('faturamento')
    .select('id_saida, filial_id, data_saida, valor_contabil, cancelado')
    .gte('data_saida', params.dataInicio)
    .lte('data_saida', params.dataFim)

  if (finalFiliais && finalFiliais.length > 0) {
    contasReceberRealizadasQuery.in('filial_id', finalFiliais)
    contasReceberPrevistasQuery.in('filial_id', finalFiliais)
    contasPagarRealizadasQuery.in('filial_id', finalFiliais)
    contasPagarPrevistasQuery.in('filial_id', finalFiliais)
    resumoPdvQuery.in('filial_id', finalFiliais)
    faturamentoQuery.in('filial_id', finalFiliais)
  }

  const [
    contasReceberRealizadasResult,
    contasReceberPrevistasResult,
    contasPagarRealizadasResult,
    contasPagarPrevistasResult,
    resumoPdvResult,
    faturamentoResult,
  ] = await Promise.all([
    contasReceberRealizadasQuery,
    contasReceberPrevistasQuery,
    contasPagarRealizadasQuery,
    contasPagarPrevistasQuery,
    resumoPdvQuery,
    faturamentoQuery,
  ])

  if (contasReceberRealizadasResult.error) {
    throw new Error(
      `Erro ao consultar contas_receber realizadas: ${contasReceberRealizadasResult.error.message}`
    )
  }

  if (contasReceberPrevistasResult.error) {
    throw new Error(
      `Erro ao consultar contas_receber previstas: ${contasReceberPrevistasResult.error.message}`
    )
  }

  if (contasPagarRealizadasResult.error) {
    throw new Error(
      `Erro ao consultar contas_pagar realizadas: ${contasPagarRealizadasResult.error.message}`
    )
  }

  if (contasPagarPrevistasResult.error) {
    throw new Error(
      `Erro ao consultar contas_pagar previstas: ${contasPagarPrevistasResult.error.message}`
    )
  }

  if (resumoPdvResult.error) {
    warnings.push(
      `PDV operacional indisponível: ${resumoPdvResult.error.message}`
    )
  }

  if (faturamentoResult.error) {
    warnings.push(
      `Faturamento operacional indisponível: ${faturamentoResult.error.message}`
    )
  }

  const buckets = new Map<string, CashFlowMovementBucket>()

  for (const row of contasReceberRealizadasResult.data ?? []) {
    if (!row.data_recebimento) continue
    const amount = getReceivedAmount(row)
    if (amount <= 0) continue

    const bucket = getOrCreateBucket(
      buckets,
      row.data_recebimento,
      String(row.filial_id)
    )
    bucket.recebimentosRealizados += amount
  }

  for (const row of contasReceberPrevistasResult.data ?? []) {
    if (!row.data_vencimento) continue
    const amount = getOpenAmount(row)
    if (amount <= 0) continue

    const bucket = getOrCreateBucket(
      buckets,
      row.data_vencimento,
      String(row.filial_id)
    )
    bucket.recebimentosPrevistos += amount
  }

  for (const row of contasPagarRealizadasResult.data ?? []) {
    if (!row.data_pagamento) continue
    const amount = getPaidAmount(row)
    if (amount <= 0) continue

    const bucket = getOrCreateBucket(
      buckets,
      row.data_pagamento,
      String(row.filial_id)
    )
    bucket.pagamentosRealizados += amount
  }

  for (const row of contasPagarPrevistasResult.data ?? []) {
    if (!row.data_vencimento) continue
    const amount = getOpenAmount(row)
    if (amount <= 0) continue

    const bucket = getOrCreateBucket(
      buckets,
      row.data_vencimento,
      String(row.filial_id)
    )
    bucket.pagamentosPrevistos += amount
  }

  for (const row of resumoPdvResult.data ?? []) {
    if (!row.data) continue
    const bucket = getOrCreateBucket(
      buckets,
      row.data,
      String(row.filial_id)
    )
    bucket.entradasPdv += toNumber(row.valor_total_vendas)
  }

  const faturamentoByNota = new Map<string, { date: string; filialId: string; valorContabil: number }>()

  for (const row of faturamentoResult.data ?? []) {
    if (!row.data_saida || isCanceledValue(row.cancelado)) continue

    const key = `${row.id_saida}-${row.filial_id}-${row.data_saida}`
    if (faturamentoByNota.has(key)) continue

    faturamentoByNota.set(key, {
      date: row.data_saida,
      filialId: String(row.filial_id),
      valorContabil: toNumber(row.valor_contabil),
    })
  }

  for (const nota of faturamentoByNota.values()) {
    const bucket = getOrCreateBucket(buckets, nota.date, nota.filialId)
    bucket.entradasFaturamento += nota.valorContabil
  }

  const baseRows = Array.from(buckets.values()).sort((a, b) => {
    if (a.date === b.date) {
      return a.filialId.localeCompare(b.filialId)
    }
    return a.date.localeCompare(b.date)
  })

  const openingBalances = new Map<string, number>()
  const filialIds = new Set<string>()

  if (finalFiliais && finalFiliais.length > 0) {
    finalFiliais.forEach((filialId) => filialIds.add(String(filialId)))
  }

  baseRows.forEach((row) => filialIds.add(row.filialId))

  filialIds.forEach((filialId) => {
    openingBalances.set(filialId, getMockOpeningBalance(filialId))
  })

  openingBalances.set(
    'consolidado',
    Array.from(filialIds).reduce(
      (sum, filialId) => sum + getMockOpeningBalance(filialId),
      0
    )
  )

  const rows = buildCashFlowTableRows(baseRows, params.filters, openingBalances)
  const summary = buildCashFlowSummary(rows, params.filters.viewMode)

  return {
    baseRows,
    rows,
    summary,
    meta: {
      openingBalanceSource: 'mock',
      warnings,
      actualSources: [
        'contas_receber',
        'contas_pagar',
        'resumo_vendas_caixa',
        'faturamento',
      ],
    },
  }
}
