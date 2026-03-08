'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useTenantContext } from '@/contexts/tenant-context'
import { useBranchesOptions } from '@/hooks/use-branches'
import type { FilialOption } from '@/components/filters'
import { DashboardTempoRealChartsSection } from '@/components/dashboard-tempo-real/charts-section'
import {
  DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL,
  DASHBOARD_TEMPO_REAL_SECTION_NAMES,
  DASHBOARD_TEMPO_REAL_TEXT,
} from '@/components/dashboard-tempo-real/config'
import { DashboardTempoRealEmptyBanner } from '@/components/dashboard-tempo-real/empty-banner'
import { DashboardTempoRealHeader } from '@/components/dashboard-tempo-real/header'
import { DashboardTempoRealLoadingBanner } from '@/components/dashboard-tempo-real/loading-banner'
import { DashboardTempoRealRankingsSection } from '@/components/dashboard-tempo-real/rankings-section'
import { DashboardTempoRealSummaryCards } from '@/components/dashboard-tempo-real/summary-cards'
import { DashboardTempoRealTablesSection } from '@/components/dashboard-tempo-real/tables-section'
import type {
  DepartamentosResponse,
  ProdutosResponse,
  RankingResponse,
  ResumoData,
  SortDirection,
  SortFieldCancelamento,
  SortFieldVenda,
  VendasPorHoraData,
  VendasPorLojaResponse,
} from '@/components/dashboard-tempo-real/types'

// Fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Falha na requisicao (${res.status})`)
  }
  return res.json()
}

const getErrorMessage = (error: unknown, sectionName: string): string => {
  if (error instanceof Error && error.message) {
    return `${sectionName}: ${error.message}`
  }

  return `${sectionName}: erro inesperado ao carregar dados`
}

export default function DashboardTempoRealPage() {
  const { currentTenant } = useTenantContext()
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<FilialOption[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [limitProdutos, setLimitProdutos] = useState('10')
  const [limitDepartamentos, setLimitDepartamentos] = useState('10')

  // Estado de ordenação para Ranking Venda
  const [vendaSortField, setVendaSortField] = useState<SortFieldVenda>('valor_vendido')
  const [vendaSortDirection, setVendaSortDirection] = useState<SortDirection>('desc')

  // Estado de ordenação para Ranking Cancelamentos
  const [cancelamentoSortField, setCancelamentoSortField] = useState<SortFieldCancelamento>('valor_cancelamentos')
  const [cancelamentoSortDirection, setCancelamentoSortDirection] = useState<SortDirection>('desc')

  // Branch options
  const { branchOptions, isLoading: isLoadingBranches } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
    includeAll: false,
  })

  // API params
  const apiParams = useMemo(() => ({
    schema: currentTenant?.supabase_schema,
    filiais: filiaisSelecionadas.length > 0
      ? filiaisSelecionadas.map(f => f.value).join(',')
      : 'all'
  }), [currentTenant, filiaisSelecionadas])

  // Build URLs for each API endpoint
  const resumoUrl = useMemo(() => {
    if (!apiParams.schema) return null
    const params = new URLSearchParams({
      schema: apiParams.schema,
      filiais: apiParams.filiais,
    })
    return `/api/dashboard-tempo-real/resumo?${params.toString()}`
  }, [apiParams])

  const vendasHoraUrl = useMemo(() => {
    if (!apiParams.schema) return null
    const params = new URLSearchParams({
      schema: apiParams.schema,
      filiais: apiParams.filiais,
    })
    return `/api/dashboard-tempo-real/vendas-por-hora?${params.toString()}`
  }, [apiParams])

  const produtosUrl = useMemo(() => {
    if (!apiParams.schema) return null
    const params = new URLSearchParams({
      schema: apiParams.schema,
      filiais: apiParams.filiais,
      limit: limitProdutos,
    })
    return `/api/dashboard-tempo-real/produtos-mais-vendidos?${params.toString()}`
  }, [apiParams, limitProdutos])

  const departamentosUrl = useMemo(() => {
    if (!apiParams.schema) return null
    const params = new URLSearchParams({
      schema: apiParams.schema,
      filiais: apiParams.filiais,
      limit: limitDepartamentos,
    })
    return `/api/dashboard-tempo-real/departamentos-receita?${params.toString()}`
  }, [apiParams, limitDepartamentos])

  const rankingUrl = useMemo(() => {
    if (!apiParams.schema) return null
    const params = new URLSearchParams({
      schema: apiParams.schema,
      filiais: apiParams.filiais,
    })
    return `/api/dashboard-tempo-real/ranking-operacional?${params.toString()}`
  }, [apiParams])

  const vendasPorLojaUrl = useMemo(() => {
    if (!apiParams.schema) return null
    const params = new URLSearchParams({
      schema: apiParams.schema,
      filiais: apiParams.filiais,
    })
    return `/api/dashboard-tempo-real/vendas-por-loja?${params.toString()}`
  }, [apiParams])

  // SWR hooks for each endpoint
  const { data: resumo, error: resumoError, mutate: mutateResumo, isLoading: isLoadingResumo } = useSWR<ResumoData>(
    resumoUrl,
    fetcher,
    { refreshInterval: DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL }
  )

  const { data: vendasPorHora, error: vendasHoraError, mutate: mutateVendasHora, isLoading: isLoadingVendasHora } = useSWR<VendasPorHoraData>(
    vendasHoraUrl,
    fetcher,
    { refreshInterval: DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL }
  )

  const { data: produtosData, error: produtosError, mutate: mutateProdutos, isLoading: isLoadingProdutos } = useSWR<ProdutosResponse>(
    produtosUrl,
    fetcher,
    { refreshInterval: DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL }
  )

  const { data: departamentosData, error: departamentosError, mutate: mutateDepartamentos, isLoading: isLoadingDepartamentos } = useSWR<DepartamentosResponse>(
    departamentosUrl,
    fetcher,
    { refreshInterval: DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL }
  )

  const { data: rankingData, error: rankingError, mutate: mutateRanking, isLoading: isLoadingRanking } = useSWR<RankingResponse>(
    rankingUrl,
    fetcher,
    { refreshInterval: DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL }
  )

  const { data: vendasPorLojaData, error: vendasPorLojaError, mutate: mutateVendasPorLoja, isLoading: isLoadingVendasPorLoja } = useSWR<VendasPorLojaResponse>(
    vendasPorLojaUrl,
    fetcher,
    { refreshInterval: DASHBOARD_TEMPO_REAL_REFRESH_INTERVAL }
  )

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([
      mutateResumo(),
      mutateVendasHora(),
      mutateProdutos(),
      mutateDepartamentos(),
      mutateRanking(),
      mutateVendasPorLoja(),
    ])
    setIsRefreshing(false)
  }, [mutateResumo, mutateVendasHora, mutateProdutos, mutateDepartamentos, mutateRanking, mutateVendasPorLoja])

  // Sort ranking venda
  const sortedRankingVenda = useMemo(() => {
    if (!rankingData?.ranking || !Array.isArray(rankingData.ranking)) return []
    const sorted = [...rankingData.ranking]
    sorted.sort((a, b) => {
      let aVal: string | number = a[vendaSortField]
      let bVal: string | number = b[vendaSortField]

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
        if (vendaSortDirection === 'asc') {
          return aVal.localeCompare(bVal as string)
        }
        return (bVal as string).localeCompare(aVal)
      }

      if (vendaSortDirection === 'asc') {
        return (aVal as number) - (bVal as number)
      }
      return (bVal as number) - (aVal as number)
    })
    return sorted
  }, [rankingData, vendaSortField, vendaSortDirection])

  // Sort ranking cancelamentos
  const sortedRankingCancelamentos = useMemo(() => {
    if (!rankingData?.ranking || !Array.isArray(rankingData.ranking)) return []
    const sorted = [...rankingData.ranking]
    sorted.sort((a, b) => {
      let aVal: string | number = a[cancelamentoSortField]
      let bVal: string | number = b[cancelamentoSortField]

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
        if (cancelamentoSortDirection === 'asc') {
          return aVal.localeCompare(bVal as string)
        }
        return (bVal as string).localeCompare(aVal)
      }

      if (cancelamentoSortDirection === 'asc') {
        return (aVal as number) - (bVal as number)
      }
      return (bVal as number) - (aVal as number)
    })
    return sorted
  }, [rankingData, cancelamentoSortField, cancelamentoSortDirection])

  // Handle sort click para venda
  const handleVendaSortClick = useCallback((field: SortFieldVenda) => {
    if (vendaSortField === field) {
      setVendaSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setVendaSortField(field)
      setVendaSortDirection('desc')
    }
  }, [vendaSortField])

  // Handle sort click para cancelamentos
  const handleCancelamentoSortClick = useCallback((field: SortFieldCancelamento) => {
    if (cancelamentoSortField === field) {
      setCancelamentoSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setCancelamentoSortField(field)
      setCancelamentoSortDirection('desc')
    }
  }, [cancelamentoSortField])

  // Chart config for area chart
  const areaChartConfig = useMemo(() => {
    if (!Array.isArray(vendasPorHora?.filiais)) return {}
    const config: Record<string, { label: string; color: string }> = {}
    vendasPorHora.filiais.forEach(filial => {
      config[filial.id.toString()] = {
        label: filial.nome,
        color: filial.cor,
      }
    })
    return config
  }, [vendasPorHora])

  // Format last update time (timezone São Paulo)
  const lastUpdateFormatted = useMemo(() => {
    if (!resumo?.ultima_atualizacao) return '--:--:--'
    try {
      const date = new Date(resumo.ultima_atualizacao)
      if (isNaN(date.getTime())) return '--:--:--'
      return date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return '--:--:--'
    }
  }, [resumo])

  const currentDateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date())
    } catch {
      return new Date().toLocaleDateString('pt-BR')
    }
  }, [])

  // Estado global de carregamento
  const loadingState = useMemo(() => {
    const sections = [
      { name: DASHBOARD_TEMPO_REAL_SECTION_NAMES.resumo, isLoading: isLoadingResumo, isLoaded: !!resumo },
      { name: DASHBOARD_TEMPO_REAL_SECTION_NAMES.vendasHora, isLoading: isLoadingVendasHora, isLoaded: !!vendasPorHora },
      { name: DASHBOARD_TEMPO_REAL_SECTION_NAMES.vendasPorLoja, isLoading: isLoadingVendasPorLoja, isLoaded: !!vendasPorLojaData },
      { name: DASHBOARD_TEMPO_REAL_SECTION_NAMES.produtos, isLoading: isLoadingProdutos, isLoaded: !!produtosData },
      { name: DASHBOARD_TEMPO_REAL_SECTION_NAMES.departamentos, isLoading: isLoadingDepartamentos, isLoaded: !!departamentosData },
      { name: DASHBOARD_TEMPO_REAL_SECTION_NAMES.ranking, isLoading: isLoadingRanking, isLoaded: !!rankingData },
    ]

    const loadedCount = sections.filter(s => s.isLoaded).length
    const isAnyLoading = sections.some(s => s.isLoading)
    const currentLoading = sections.find(s => s.isLoading)?.name || null

    return {
      progress: (loadedCount / sections.length) * 100,
      isAnyLoading,
      isComplete: loadedCount === sections.length,
      currentLoading,
      loadedCount,
      totalCount: sections.length,
    }
  }, [isLoadingResumo, isLoadingVendasHora, isLoadingVendasPorLoja, isLoadingProdutos, isLoadingDepartamentos, isLoadingRanking, resumo, vendasPorHora, vendasPorLojaData, produtosData, departamentosData, rankingData])

  const errorMessages = useMemo(() => ({
    resumo: resumoError ? getErrorMessage(resumoError, 'Resumo') : null,
    vendasHora: vendasHoraError ? getErrorMessage(vendasHoraError, 'Vendas por Hora') : null,
    vendasPorLoja: vendasPorLojaError ? getErrorMessage(vendasPorLojaError, 'Vendas por Loja') : null,
    produtos: produtosError ? getErrorMessage(produtosError, 'Produtos') : null,
    departamentos: departamentosError ? getErrorMessage(departamentosError, 'Departamentos') : null,
    ranking: rankingError ? getErrorMessage(rankingError, 'Ranking') : null,
  }), [resumoError, vendasHoraError, vendasPorLojaError, produtosError, departamentosError, rankingError])

  const globalErrorSections = useMemo(() => {
    return Object.values(errorMessages).filter((message): message is string => Boolean(message))
  }, [errorMessages])

  const hasNoDataForToday = useMemo(() => {
    const resumoSemDados = Boolean(
      resumo &&
      resumo.receita_total === 0 &&
      resumo.qtde_cupons === 0 &&
      resumo.qtde_skus === 0 &&
      resumo.cancelamentos === 0 &&
      resumo.cancelamentos_qtde_skus === 0
    )

    return (
      loadingState.isComplete &&
      !loadingState.isAnyLoading &&
      globalErrorSections.length === 0 &&
      resumoSemDados &&
      Boolean(vendasPorHora && vendasPorHora.filiais.length === 0) &&
      Boolean(vendasPorLojaData && vendasPorLojaData.lojas.length === 0) &&
      Boolean(produtosData && produtosData.produtos.length === 0) &&
      Boolean(departamentosData && departamentosData.departamentos.length === 0) &&
      Boolean(rankingData && rankingData.ranking.length === 0)
    )
  }, [
    loadingState,
    globalErrorSections,
    resumo,
    vendasPorHora,
    vendasPorLojaData,
    produtosData,
    departamentosData,
    rankingData,
  ])

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">{DASHBOARD_TEMPO_REAL_TEXT.header.missingTenant}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DashboardTempoRealHeader
        branchOptions={branchOptions}
        filiaisSelecionadas={filiaisSelecionadas}
        isLoadingBranches={isLoadingBranches}
        isRefreshing={isRefreshing}
        lastUpdateFormatted={lastUpdateFormatted}
        onFiliaisChange={setFiliaisSelecionadas}
        onRefresh={handleRefresh}
      />

      <DashboardTempoRealLoadingBanner
        loadingState={loadingState}
        errorSections={globalErrorSections}
      />

      {hasNoDataForToday && (
        <DashboardTempoRealEmptyBanner currentDateLabel={currentDateLabel} />
      )}

      <DashboardTempoRealSummaryCards
        resumo={resumo}
        isLoadingResumo={isLoadingResumo}
        errorMessage={errorMessages.resumo}
      />

      <DashboardTempoRealChartsSection
        vendasPorHora={vendasPorHora}
        vendasPorLojaData={vendasPorLojaData}
        isLoadingVendasHora={isLoadingVendasHora}
        isLoadingVendasPorLoja={isLoadingVendasPorLoja}
        areaChartConfig={areaChartConfig}
        errorVendasHora={errorMessages.vendasHora}
        errorVendasPorLoja={errorMessages.vendasPorLoja}
      />

      <DashboardTempoRealTablesSection
        produtosData={produtosData}
        departamentosData={departamentosData}
        isLoadingProdutos={isLoadingProdutos}
        isLoadingDepartamentos={isLoadingDepartamentos}
        errorProdutos={errorMessages.produtos}
        errorDepartamentos={errorMessages.departamentos}
        limitProdutos={limitProdutos}
        limitDepartamentos={limitDepartamentos}
        onLimitProdutosChange={setLimitProdutos}
        onLimitDepartamentosChange={setLimitDepartamentos}
      />

      <DashboardTempoRealRankingsSection
        isLoadingRanking={isLoadingRanking}
        sortedRankingVenda={sortedRankingVenda}
        sortedRankingCancelamentos={sortedRankingCancelamentos}
        vendaSortField={vendaSortField}
        vendaSortDirection={vendaSortDirection}
        cancelamentoSortField={cancelamentoSortField}
        cancelamentoSortDirection={cancelamentoSortDirection}
        errorMessage={errorMessages.ranking}
        onVendaSortClick={handleVendaSortClick}
        onCancelamentoSortClick={handleCancelamentoSortClick}
      />
    </div>
  )
}
