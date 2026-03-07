'use client'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

type DashboardTempoRealSectionErrorProps = {
  message: string
  className?: string
}

export function DashboardTempoRealSectionError({
  message,
  className,
}: DashboardTempoRealSectionErrorProps) {
  return (
    <Alert className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
