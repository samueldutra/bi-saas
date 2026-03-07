'use client'

import { Package, Receipt, TrendingUp, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

import { formatCurrency, formatNumber } from './formatters'
import { DashboardTempoRealSectionError } from './section-error'
import type { ResumoData } from './types'

type DashboardTempoRealSummaryCardsProps = {
  resumo?: ResumoData
  isLoadingResumo: boolean
  errorMessage?: string | null
}

export function DashboardTempoRealSummaryCards({
  resumo,
  isLoadingResumo,
  errorMessage,
}: DashboardTempoRealSummaryCardsProps) {
  if (errorMessage && !isLoadingResumo && !resumo) {
    return <DashboardTempoRealSectionError message={errorMessage} />
  }

  return (
    <div className="space-y-3">
      {errorMessage && <DashboardTempoRealSectionError message={errorMessage} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-[26px] font-bold">
                  {formatCurrency(resumo?.receita_total || 0)}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Meta dia:</span>
                    <span>{formatCurrency(resumo?.meta_dia || 0)}</span>
                  </div>
                  <Progress value={Math.min(resumo?.atingimento_percentual || 0, 100)} className="h-2" />
                  <div className="text-right text-xs text-muted-foreground">
                    {(resumo?.atingimento_percentual || 0).toFixed(1)}% atingido
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket Médio
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-[36px] font-bold">
                {formatCurrency(resumo?.ticket_medio || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Qtde Cupons
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-[36px] font-bold">
                {formatNumber(resumo?.qtde_cupons || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Qtde SKUs
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-[36px] font-bold">
                {formatNumber(resumo?.qtde_skus || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cancelamentos
            </CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-[36px] font-bold text-destructive">
                  {formatCurrency(resumo?.cancelamentos || 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(resumo?.cancelamentos_qtde_skus || 0)} SKUs cancelados
                </p>
                <p className="text-sm text-muted-foreground">
                  {(resumo?.cancelamentos_percentual || 0).toFixed(2)}% da receita
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
