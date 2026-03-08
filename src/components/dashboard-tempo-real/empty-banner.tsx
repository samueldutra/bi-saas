'use client'

import { Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { DASHBOARD_TEMPO_REAL_TEXT } from './config'

type DashboardTempoRealEmptyBannerProps = {
  currentDateLabel: string
}

export function DashboardTempoRealEmptyBanner({
  currentDateLabel,
}: DashboardTempoRealEmptyBannerProps) {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>{DASHBOARD_TEMPO_REAL_TEXT.emptyState.title}</AlertTitle>
      <AlertDescription>
        {DASHBOARD_TEMPO_REAL_TEXT.emptyState.descriptionPrefix} {currentDateLabel}.{' '}
        {DASHBOARD_TEMPO_REAL_TEXT.emptyState.descriptionSuffix}
      </AlertDescription>
    </Alert>
  )
}
