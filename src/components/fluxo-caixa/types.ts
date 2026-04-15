export type CashFlowViewMode = 'realizado' | 'projetado' | 'consolidado'
export type CashFlowGrouping = 'diario' | 'semanal' | 'mensal'
export type CashFlowOrigin =
  | 'all'
  | 'pdv'
  | 'faturamento'
  | 'receber'
  | 'pagar'
  | 'ajustes'
export type CashFlowStatusFilter = 'all' | 'saudavel' | 'atencao' | 'critico'
export type CashFlowBreakdown = 'consolidado' | 'por_filial'

export interface CashFlowBaseRow {
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

export interface CashFlowFiltersState {
  filiais: string[]
  viewMode: CashFlowViewMode
  grouping: CashFlowGrouping
  origin: CashFlowOrigin
  status: CashFlowStatusFilter
  breakdown: CashFlowBreakdown
}

export interface CashFlowTableRow {
  id: string
  filialId: string
  periodStart: string
  periodEnd: string
  periodLabel: string
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
  entradasRealizadas: number
  saidasRealizadas: number
  saldoFinal: number
  saldoProjetado: number
  status: 'saudavel' | 'atencao' | 'critico'
}

export interface CashFlowSummary {
  saldoInicial: number
  entradasRealizadas: number
  saidasRealizadas: number
  saldoRealizado: number
  variacaoPrevista: number
  saldoProjetado: number
  filiaisCriticas: number
}

export interface CashFlowMeta {
  openingBalanceSource: 'zero' | 'mock'
  warnings: string[]
  actualSources: string[]
}

export interface CashFlowTableResponse {
  rows: CashFlowTableRow[]
  meta: CashFlowMeta
}

export interface CashFlowSummaryResponse {
  summary: CashFlowSummary
  meta: CashFlowMeta
}
