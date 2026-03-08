'use client'

import type { FilialOption } from '@/components/filters'

export interface ResumoData {
  receita_total: number
  meta_dia: number
  atingimento_percentual: number
  ticket_medio: number
  qtde_cupons: number
  qtde_skus: number
  descontos: number
  cancelamentos: number
  cancelamentos_percentual: number
  cancelamentos_qtde_skus: number
  ultima_atualizacao: string
}

export interface VendasPorHoraData {
  data: Array<{
    faixa: string
    total_vendas: number
  }>
}

export interface ProdutoMaisVendido {
  produto_id: number
  descricao: string
  quantidade_vendida: number
  receita: number
  is_oferta: boolean
}

export interface ProdutosResponse {
  produtos: ProdutoMaisVendido[]
}

export interface DepartamentoReceita {
  departamento_id: number
  departamento_nome: string
  receita: number
  participacao_percentual: number
}

export interface DepartamentosResponse {
  receita_total: number
  departamentos: DepartamentoReceita[]
}

export interface RankingOperacional {
  filial_id: number
  filial_nome: string
  caixa: number
  skus_venda: number
  skus_cancelados: number
  valor_cancelamentos: number
  valor_vendido: number
}

export interface RankingResponse {
  ranking: RankingOperacional[]
}

export interface VendaPorLoja {
  filial_id: number
  filial_nome: string
  receita_oferta: number
  receita_normal: number
  receita_total: number
  cor: string
  meta: number
  atingimento_meta: number
}

export interface VendasPorLojaResponse {
  lojas: VendaPorLoja[]
}

export type SortFieldVenda = 'filial_nome' | 'caixa' | 'skus_venda' | 'valor_vendido'
export type SortFieldCancelamento = 'filial_nome' | 'caixa' | 'skus_cancelados' | 'valor_cancelamentos'
export type SortDirection = 'asc' | 'desc'

export interface DashboardLoadingState {
  progress: number
  isAnyLoading: boolean
  isComplete: boolean
  currentLoading: string | null
  loadedCount: number
  totalCount: number
}

export type DashboardTempoRealHeaderProps = {
  branchOptions: FilialOption[]
  filiaisSelecionadas: FilialOption[]
  isLoadingBranches: boolean
  isRefreshing: boolean
  lastUpdateFormatted: string
  onFiliaisChange: (filiais: FilialOption[]) => void
  onRefresh: () => void | Promise<void>
}
