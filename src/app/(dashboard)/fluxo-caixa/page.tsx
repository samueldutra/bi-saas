'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { endOfMonth, startOfMonth } from 'date-fns'
import { Wallet } from 'lucide-react'

import type { FilialOption } from '@/components/filters'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranchesOptions } from '@/hooks/use-branches'
import { useTenantContext } from '@/contexts/tenant-context'

import { CashFlowEmptyState } from '@/components/fluxo-caixa/empty-state'
import { CashFlowFilters } from '@/components/fluxo-caixa/filters'
import { CASH_FLOW_BRANCH_OPTIONS } from '@/components/fluxo-caixa/mock-data'
import { CashFlowSummaryCards } from '@/components/fluxo-caixa/summary-cards'
import { CashFlowTable } from '@/components/fluxo-caixa/cash-flow-table'
import type {
  CashFlowFiltersState,
  CashFlowSummaryResponse,
  CashFlowTableResponse,
} from '@/components/fluxo-caixa/types'

import type { FilterType } from '@/components/dashboard/dashboard-filter'

const DEFAULT_FILTERS: CashFlowFiltersState = {
  filiais: [],
  viewMode: 'consolidado',
  grouping: 'diario',
  origin: 'all',
  status: 'all',
  breakdown: 'consolidado',
}

function areSameFiliais(a: FilialOption[], b: FilialOption[]) {
  if (a.length !== b.length) return false

  return a.every((item, index) => {
    const other = b[index]
    return other && item.value === other.value && item.label === other.label
  })
}

function areSameValues(a: string[], b: string[]) {
  if (a.length !== b.length) return false

  return a.every((value, index) => value === b[index])
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Falha na requisição (${response.status})`)
  }

  return response.json()
}

export default function FluxoCaixaPage() {
  const { currentTenant } = useTenantContext()
  const { branchOptions } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
    includeAll: false,
  })

  const availableBranches = useMemo(
    () => (branchOptions.length > 0 ? branchOptions : CASH_FLOW_BRANCH_OPTIONS),
    [branchOptions]
  )
  const [selectedFiliais, setSelectedFiliais] = useState<FilialOption[]>(availableBranches)
  const [filters, setFilters] = useState<CashFlowFiltersState>({
    ...DEFAULT_FILTERS,
    filiais: availableBranches.map((branch) => branch.value),
  })
  const [period, setPeriod] = useState<{
    dataInicial: Date
    dataFinal: Date
    filterType: FilterType
  }>({
    dataInicial: startOfMonth(new Date()),
    dataFinal: endOfMonth(new Date()),
    filterType: 'month',
  })
  const selectedFiliaisParam = useMemo(
    () => selectedFiliais.map((filial) => filial.value).join(','),
    [selectedFiliais]
  )
  const filialLabelMap = useMemo(
    () => new Map(availableBranches.map((branch) => [branch.value, branch.label])),
    [availableBranches]
  )

  useEffect(() => {
    setSelectedFiliais((current) => {
      if (current.length === 0) {
        return areSameFiliais(current, availableBranches) ? current : availableBranches
      }

      const next = current.filter((filial) =>
        availableBranches.some((branch) => branch.value === filial.value)
      )

      const resolved = next.length > 0 ? next : availableBranches

      return areSameFiliais(current, resolved) ? current : resolved
    })

    setFilters((current) => {
      const nextFiliais = (
        current.filiais.length > 0
          ? current.filiais
          : availableBranches.map((branch) => branch.value)
      ).filter((value) =>
        availableBranches.some((branch) => branch.value === value)
      )

      if (areSameValues(current.filiais, nextFiliais)) {
        return current
      }

      return {
        ...current,
        filiais: nextFiliais,
      }
    })
  }, [availableBranches])

  const summaryUrl = useMemo(() => {
    if (!currentTenant?.supabase_schema || selectedFiliais.length === 0) {
      return null
    }

    const params = new URLSearchParams({
      schema: currentTenant.supabase_schema,
      data_inicio: period.dataInicial.toISOString().slice(0, 10),
      data_fim: period.dataFinal.toISOString().slice(0, 10),
      filiais: selectedFiliaisParam,
      view_mode: filters.viewMode,
      grouping: filters.grouping,
      origin: filters.origin,
      status: filters.status,
      breakdown: filters.breakdown,
    })

    return `/api/fluxo-caixa/resumo?${params.toString()}`
  }, [
    currentTenant?.supabase_schema,
    filters.breakdown,
    filters.grouping,
    filters.origin,
    filters.status,
    filters.viewMode,
    period.dataFinal,
    period.dataInicial,
    selectedFiliais.length,
    selectedFiliaisParam,
  ])

  const tableUrl = useMemo(() => {
    if (!currentTenant?.supabase_schema || selectedFiliais.length === 0) {
      return null
    }

    const params = new URLSearchParams({
      schema: currentTenant.supabase_schema,
      data_inicio: period.dataInicial.toISOString().slice(0, 10),
      data_fim: period.dataFinal.toISOString().slice(0, 10),
      filiais: selectedFiliaisParam,
      view_mode: filters.viewMode,
      grouping: filters.grouping,
      origin: filters.origin,
      status: filters.status,
      breakdown: filters.breakdown,
    })

    return `/api/fluxo-caixa/tabela?${params.toString()}`
  }, [
    currentTenant?.supabase_schema,
    filters.breakdown,
    filters.grouping,
    filters.origin,
    filters.status,
    filters.viewMode,
    period.dataFinal,
    period.dataInicial,
    selectedFiliais.length,
    selectedFiliaisParam,
  ])

  const {
    data: summaryData,
    error: summaryError,
    isLoading: isLoadingSummary,
  } = useSWR<CashFlowSummaryResponse>(summaryUrl, fetcher)

  const {
    data: tableData,
    error: tableError,
    isLoading: isLoadingTable,
  } = useSWR<CashFlowTableResponse>(tableUrl, fetcher)

  const tableRows = useMemo(
    () =>
      (tableData?.rows ?? []).map((row) => ({
        ...row,
        filialLabel:
          row.filialId === 'consolidado'
            ? 'Consolidado'
            : filialLabelMap.get(row.filialId) ?? row.filialLabel,
      })),
    [filialLabelMap, tableData?.rows]
  )

  const isLoading = isLoadingSummary || isLoadingTable
  const error = summaryError ?? tableError

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <p className="max-w-4xl text-sm text-muted-foreground">
          Estrutura inicial do módulo para consolidar PDV, faturamento, contas a pagar, contas a receber e saldos por período e filial.
        </p>
      </div>
      <CashFlowFilters
        branches={availableBranches}
        selectedFiliais={selectedFiliais}
        onSelectedFiliaisChange={(filiais) => {
          setSelectedFiliais(filiais)
          setFilters((current) => ({
            ...current,
            filiais: filiais.map((filial) => filial.value),
          }))
        }}
        filters={filters}
        onViewModeChange={(value) => setFilters((current) => ({ ...current, viewMode: value }))}
        onGroupingChange={(value) => setFilters((current) => ({ ...current, grouping: value }))}
        onOriginChange={(value) => setFilters((current) => ({ ...current, origin: value }))}
        onStatusChange={(value) => setFilters((current) => ({ ...current, status: value }))}
        onBreakdownChange={(value) => setFilters((current) => ({ ...current, breakdown: value }))}
        onPeriodChange={(dataInicial, dataFinal, filterType) =>
          setPeriod({ dataInicial, dataFinal, filterType })
        }
      />

      {selectedFiliais.length === 0 ? (
        <CashFlowEmptyState
          title="Nenhuma filial selecionada"
          description="Selecione ao menos uma filial para consultar o fluxo de caixa no período."
        />
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar fluxo de caixa</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Não foi possível consultar os dados do módulo.'}
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 pt-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        </>
      ) : tableRows.length === 0 || !summaryData ? (
        <CashFlowEmptyState />
      ) : (
        <>
          <CashFlowSummaryCards summary={summaryData.summary} viewMode={filters.viewMode} />
          <CashFlowTable rows={tableRows} viewMode={filters.viewMode} />
        </>
      )}
    </div>
  )
}
