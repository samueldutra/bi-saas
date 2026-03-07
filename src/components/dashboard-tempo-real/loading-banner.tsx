'use client'

import { RefreshCw } from 'lucide-react'

import { Progress } from '@/components/ui/progress'

import type { DashboardLoadingState } from './types'

type DashboardTempoRealLoadingBannerProps = {
  loadingState: DashboardLoadingState
}

export function DashboardTempoRealLoadingBanner({
  loadingState,
}: DashboardTempoRealLoadingBannerProps) {
  if (!loadingState.isAnyLoading || loadingState.isComplete) {
    return null
  }

  return (
    <div className="rounded-lg border bg-muted/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Carregando dados...</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {loadingState.loadedCount}/{loadingState.totalCount} seções
        </span>
      </div>
      <Progress value={loadingState.progress} className="h-2" />
      {loadingState.currentLoading && (
        <p className="mt-1 text-xs text-muted-foreground">
          Carregando: {loadingState.currentLoading}
        </p>
      )}
    </div>
  )
}
