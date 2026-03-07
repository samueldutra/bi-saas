'use client'

import { RefreshCw } from 'lucide-react'

import { Progress } from '@/components/ui/progress'

import { DASHBOARD_TEMPO_REAL_TEXT } from './config'
import { DashboardTempoRealSectionError } from './section-error'

import type { DashboardLoadingState } from './types'

type DashboardTempoRealLoadingBannerProps = {
  loadingState: DashboardLoadingState
  errorSections?: string[]
}

export function DashboardTempoRealLoadingBanner({
  loadingState,
  errorSections = [],
}: DashboardTempoRealLoadingBannerProps) {
  if (!loadingState.isAnyLoading && errorSections.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {loadingState.isAnyLoading && !loadingState.isComplete && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">{DASHBOARD_TEMPO_REAL_TEXT.loading.title}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {loadingState.loadedCount}/{loadingState.totalCount} {DASHBOARD_TEMPO_REAL_TEXT.loading.sectionSuffix}
            </span>
          </div>
          <Progress value={loadingState.progress} className="h-2" />
          {loadingState.currentLoading && (
            <p className="mt-1 text-xs text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.loading.currentLoadingLabel} {loadingState.currentLoading}
            </p>
          )}
        </div>
      )}

      {errorSections.length > 0 && (
        <DashboardTempoRealSectionError
          message={`${DASHBOARD_TEMPO_REAL_TEXT.loading.globalErrorPrefix} ${errorSections.join(', ')}.`}
        />
      )}
    </div>
  )
}
