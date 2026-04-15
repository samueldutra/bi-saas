import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type {
  CashFlowBaseRow,
  CashFlowFiltersState,
  CashFlowSummary,
  CashFlowTableRow,
  CashFlowViewMode,
} from '@/components/fluxo-caixa/types'

const getRowStatus = (referenceBalance: number): CashFlowTableRow['status'] => {
  if (referenceBalance < 0) return 'critico'
  if (referenceBalance < 25000) return 'atencao'
  return 'saudavel'
}

const applyOriginFilter = (
  row: CashFlowBaseRow,
  origin: CashFlowFiltersState['origin']
) => {
  switch (origin) {
    case 'pdv':
      return {
        ...row,
        entradasFaturamento: 0,
        recebimentosRealizados: 0,
        recebimentosPrevistos: 0,
        outrasEntradas: 0,
        pagamentosRealizados: 0,
        pagamentosPrevistos: 0,
        outrasSaidas: 0,
        ajustes: 0,
      }
    case 'faturamento':
      return {
        ...row,
        entradasPdv: 0,
        recebimentosRealizados: 0,
        recebimentosPrevistos: 0,
        outrasEntradas: 0,
        pagamentosRealizados: 0,
        pagamentosPrevistos: 0,
        outrasSaidas: 0,
        ajustes: 0,
      }
    case 'receber':
      return {
        ...row,
        entradasPdv: 0,
        entradasFaturamento: 0,
        pagamentosRealizados: 0,
        pagamentosPrevistos: 0,
        outrasSaidas: 0,
        ajustes: 0,
      }
    case 'pagar':
      return {
        ...row,
        entradasPdv: 0,
        entradasFaturamento: 0,
        recebimentosRealizados: 0,
        recebimentosPrevistos: 0,
        outrasEntradas: 0,
        ajustes: 0,
      }
    case 'ajustes':
      return {
        ...row,
        entradasPdv: 0,
        entradasFaturamento: 0,
        recebimentosRealizados: 0,
        recebimentosPrevistos: 0,
        outrasEntradas: 0,
        pagamentosRealizados: 0,
        pagamentosPrevistos: 0,
        outrasSaidas: 0,
      }
    default:
      return row
  }
}

const getPeriodWindow = (
  date: Date,
  grouping: CashFlowFiltersState['grouping']
) => {
  if (grouping === 'mensal') {
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    }
  }

  if (grouping === 'semanal') {
    const start = startOfWeek(date, { locale: ptBR })
    const end = endOfWeek(date, { locale: ptBR })

    return {
      start,
      end,
      label: `${format(start, 'dd/MM', { locale: ptBR })} a ${format(end, 'dd/MM', { locale: ptBR })}`,
    }
  }

  return {
    start: date,
    end: date,
    label: format(date, 'dd/MM/yyyy', { locale: ptBR }),
  }
}

export function buildCashFlowTableRows(
  baseRows: CashFlowBaseRow[],
  filters: Pick<CashFlowFiltersState, 'breakdown' | 'grouping' | 'origin' | 'status' | 'viewMode'>,
  openingBalances?: Map<string, number>
): CashFlowTableRow[] {
  const grouped = new Map<
    string,
    Omit<CashFlowTableRow, 'saldoInicial' | 'saldoFinal' | 'saldoProjetado' | 'status'> & {
      periodSortKey: string
    }
  >()

  baseRows.forEach((row) => {
    const filteredRow = applyOriginFilter(row, filters.origin)
    const date = parseISO(filteredRow.date)
    const period = getPeriodWindow(date, filters.grouping)
    const filialId = filters.breakdown === 'por_filial' ? filteredRow.filialId : 'consolidado'
    const filialLabel =
      filters.breakdown === 'por_filial'
        ? filteredRow.filialLabel || `Filial ${filteredRow.filialId}`
        : 'Consolidado'
    const key = `${format(period.start, 'yyyy-MM-dd')}-${filialId}`

    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, {
        id: key,
        filialId,
        filialLabel,
        periodStart: format(period.start, 'yyyy-MM-dd'),
        periodEnd: format(period.end, 'yyyy-MM-dd'),
        periodLabel: period.label,
        periodSortKey: format(period.start, 'yyyy-MM-dd'),
        entradasPdv: filteredRow.entradasPdv,
        entradasFaturamento: filteredRow.entradasFaturamento,
        recebimentosRealizados: filteredRow.recebimentosRealizados,
        recebimentosPrevistos: filteredRow.recebimentosPrevistos,
        outrasEntradas: filteredRow.outrasEntradas,
        pagamentosRealizados: filteredRow.pagamentosRealizados,
        pagamentosPrevistos: filteredRow.pagamentosPrevistos,
        outrasSaidas: filteredRow.outrasSaidas,
        ajustes: filteredRow.ajustes,
        entradasRealizadas:
          filteredRow.entradasPdv +
          filteredRow.entradasFaturamento +
          filteredRow.recebimentosRealizados +
          filteredRow.outrasEntradas,
        saidasRealizadas:
          filteredRow.pagamentosRealizados + filteredRow.outrasSaidas,
      })
      return
    }

    existing.entradasPdv += filteredRow.entradasPdv
    existing.entradasFaturamento += filteredRow.entradasFaturamento
    existing.recebimentosRealizados += filteredRow.recebimentosRealizados
    existing.recebimentosPrevistos += filteredRow.recebimentosPrevistos
    existing.outrasEntradas += filteredRow.outrasEntradas
    existing.pagamentosRealizados += filteredRow.pagamentosRealizados
    existing.pagamentosPrevistos += filteredRow.pagamentosPrevistos
    existing.outrasSaidas += filteredRow.outrasSaidas
    existing.ajustes += filteredRow.ajustes
    existing.entradasRealizadas +=
      filteredRow.entradasPdv +
      filteredRow.entradasFaturamento +
      filteredRow.recebimentosRealizados +
      filteredRow.outrasEntradas
    existing.saidasRealizadas +=
      filteredRow.pagamentosRealizados + filteredRow.outrasSaidas
  })

  const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
    if (a.periodSortKey === b.periodSortKey) {
      return a.filialId.localeCompare(b.filialId)
    }

    return a.periodSortKey.localeCompare(b.periodSortKey)
  })

  const runningBalances = new Map<string, number>()

  const rows = sortedGroups.map((group) => {
    const balanceKey =
      filters.breakdown === 'por_filial' ? group.filialId : 'consolidado'
    const saldoInicial =
      runningBalances.get(balanceKey) ?? openingBalances?.get(balanceKey) ?? 0
    const saldoFinal =
      saldoInicial +
      group.entradasRealizadas -
      group.saidasRealizadas +
      group.ajustes
    const saldoProjetado =
      saldoFinal +
      group.recebimentosPrevistos -
      group.pagamentosPrevistos
    const carryBalance =
      filters.viewMode === 'realizado' ? saldoFinal : saldoProjetado

    runningBalances.set(balanceKey, carryBalance)

    const row: CashFlowTableRow = {
      id: group.id,
      filialId: group.filialId,
      filialLabel: group.filialLabel,
      periodStart: group.periodStart,
      periodEnd: group.periodEnd,
      periodLabel: group.periodLabel,
      saldoInicial,
      entradasPdv: group.entradasPdv,
      entradasFaturamento: group.entradasFaturamento,
      recebimentosRealizados: group.recebimentosRealizados,
      recebimentosPrevistos: group.recebimentosPrevistos,
      outrasEntradas: group.outrasEntradas,
      pagamentosRealizados: group.pagamentosRealizados,
      pagamentosPrevistos: group.pagamentosPrevistos,
      outrasSaidas: group.outrasSaidas,
      ajustes: group.ajustes,
      entradasRealizadas: group.entradasRealizadas,
      saidasRealizadas: group.saidasRealizadas,
      saldoFinal,
      saldoProjetado,
      status: getRowStatus(
        filters.viewMode === 'realizado' ? saldoFinal : saldoProjetado
      ),
    }

    return row
  })

  return rows.filter((row) => {
    if (filters.status === 'all') return true
    return row.status === filters.status
  })
}

export function buildCashFlowSummary(
  rows: CashFlowTableRow[],
  viewMode: CashFlowViewMode
): CashFlowSummary {
  const firstOpeningByFilial = new Map<string, number>()
  const uniqueCriticalFiliais = new Set<string>()
  let ajustesTotal = 0
  let projectedDelta = 0

  rows.forEach((row) => {
    if (!firstOpeningByFilial.has(row.filialId)) {
      firstOpeningByFilial.set(row.filialId, row.saldoInicial)
    }

    if (row.status === 'critico') {
      uniqueCriticalFiliais.add(row.filialId)
    }

    ajustesTotal += row.ajustes
    projectedDelta += row.recebimentosPrevistos - row.pagamentosPrevistos
  })

  const saldoInicial = Array.from(firstOpeningByFilial.values()).reduce(
    (sum, value) => sum + value,
    0
  )
  const entradasRealizadas = rows.reduce(
    (sum, row) => sum + row.entradasRealizadas,
    0
  )
  const saidasRealizadas = rows.reduce(
    (sum, row) => sum + row.saidasRealizadas,
    0
  )
  const saldoRealizado =
    saldoInicial + entradasRealizadas - saidasRealizadas + ajustesTotal
  const variacaoPrevista = viewMode === 'realizado' ? 0 : projectedDelta
  const saldoProjetado =
    viewMode === 'realizado'
      ? saldoRealizado
      : saldoRealizado + variacaoPrevista

  return {
    saldoInicial,
    entradasRealizadas,
    saidasRealizadas,
    saldoRealizado,
    variacaoPrevista,
    saldoProjetado,
    filiaisCriticas: uniqueCriticalFiliais.size,
  }
}
