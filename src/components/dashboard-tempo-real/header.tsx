'use client'

import { Radio, RefreshCw } from 'lucide-react'

import { MultiFilialFilter } from '@/components/filters'
import { Button } from '@/components/ui/button'

import type { DashboardTempoRealHeaderProps } from './types'

export function DashboardTempoRealHeader({
  branchOptions,
  filiaisSelecionadas,
  isLoadingBranches,
  isRefreshing,
  lastUpdateFormatted,
  onFiliaisChange,
  onRefresh,
}: DashboardTempoRealHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Radio className="h-6 w-6 animate-pulse-live" />
          Dashboard Tempo Real
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento de vendas do dia com atualização automática
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="w-full sm:w-[250px]">
          <MultiFilialFilter
            filiais={branchOptions}
            selectedFiliais={filiaisSelecionadas}
            onChange={onFiliaisChange}
            disabled={isLoadingBranches}
            placeholder="Todas as filiais..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <span className="whitespace-nowrap text-sm text-muted-foreground">
            Última atualização: {lastUpdateFormatted}
          </span>
        </div>
      </div>
    </div>
  )
}
