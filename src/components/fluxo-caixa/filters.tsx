'use client'

import type { FilialOption } from '@/components/filters'
import { MultiFilialFilter } from '@/components/filters'
import { DashboardFilter, type FilterType } from '@/components/dashboard/dashboard-filter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filter } from 'lucide-react'

import type {
  CashFlowBreakdown,
  CashFlowFiltersState,
  CashFlowGrouping,
  CashFlowOrigin,
  CashFlowStatusFilter,
  CashFlowViewMode,
} from './types'

interface CashFlowFiltersProps {
  branches: FilialOption[]
  selectedFiliais: FilialOption[]
  onSelectedFiliaisChange: (filiais: FilialOption[]) => void
  filters: CashFlowFiltersState
  onViewModeChange: (value: CashFlowViewMode) => void
  onGroupingChange: (value: CashFlowGrouping) => void
  onOriginChange: (value: CashFlowOrigin) => void
  onStatusChange: (value: CashFlowStatusFilter) => void
  onBreakdownChange: (value: CashFlowBreakdown) => void
  onPeriodChange: (dataInicial: Date, dataFinal: Date, filterType: FilterType) => void
}

export function CashFlowFilters({
  branches,
  selectedFiliais,
  onSelectedFiliaisChange,
  filters,
  onViewModeChange,
  onGroupingChange,
  onOriginChange,
  onStatusChange,
  onBreakdownChange,
  onPeriodChange,
}: CashFlowFiltersProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Filtros do Fluxo
        </CardTitle>
        <CardDescription>
          Combine período, filiais e visão de caixa para analisar realizado, previsto e posição final.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,1.6fr)_repeat(4,minmax(160px,1fr))]">
          <div className="space-y-2">
            <Label>Filiais</Label>
            <MultiFilialFilter
              filiais={branches}
              selectedFiliais={selectedFiliais}
              onChange={onSelectedFiliaisChange}
              placeholder="Selecione uma ou mais filiais"
            />
          </div>

          <div className="space-y-2">
            <Label>Visão</Label>
            <Select value={filters.viewMode} onValueChange={(value) => onViewModeChange(value as CashFlowViewMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consolidado">Consolidado</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="projetado">Projetado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Agrupamento</Label>
            <Select value={filters.grouping} onValueChange={(value) => onGroupingChange(value as CashFlowGrouping)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={filters.origin} onValueChange={(value) => onOriginChange(value as CashFlowOrigin)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pdv">PDV</SelectItem>
                <SelectItem value="faturamento">Faturamento</SelectItem>
                <SelectItem value="receber">Contas a Receber</SelectItem>
                <SelectItem value="pagar">Contas a Pagar</SelectItem>
                <SelectItem value="ajustes">Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status do caixa</Label>
            <Select value={filters.status} onValueChange={(value) => onStatusChange(value as CashFlowStatusFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="saudavel">Saudável</SelectItem>
                <SelectItem value="atencao">Atenção</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(220px,280px)_1fr] xl:items-end">
          <div className="space-y-2">
            <Label>Quebra</Label>
            <Select value={filters.breakdown} onValueChange={(value) => onBreakdownChange(value as CashFlowBreakdown)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consolidado">Consolidado</SelectItem>
                <SelectItem value="por_filial">Por filial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DashboardFilter onPeriodChange={onPeriodChange} />
        </div>
      </CardContent>
    </Card>
  )
}
