'use client'

import { BadgePercent, Package, Receipt, TrendingUp, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

import { DASHBOARD_TEMPO_REAL_TEXT } from './config'
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.summary.receita}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold xl:text-[22px]">
                  {formatCurrency(resumo?.receita_total || 0)}
                </p>
                <div className="space-y-1">
                <div className="flex justify-between text-xs xl:text-[11px]">
                  <span className="text-muted-foreground">{DASHBOARD_TEMPO_REAL_TEXT.summary.metaDia}</span>
                  <span>{formatCurrency(resumo?.meta_dia || 0)}</span>
                </div>
                <Progress value={Math.min(resumo?.atingimento_percentual || 0, 100)} className="h-2" />
                <div className="text-right text-[11px] text-muted-foreground">
                  {(resumo?.atingimento_percentual || 0).toFixed(1)}{DASHBOARD_TEMPO_REAL_TEXT.summary.atingidoSuffix}
                </div>
              </div>
            </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.summary.ticketMedio}
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-bold xl:text-[30px]">
                {formatCurrency(resumo?.ticket_medio || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.summary.qtdeCupons}
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-3xl font-bold xl:text-[30px]">
                {formatNumber(resumo?.qtde_cupons || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.summary.qtdeSkus}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-3xl font-bold xl:text-[30px]">
                {formatNumber(resumo?.qtde_skus || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.summary.descontos}
            </CardTitle>
            <BadgePercent className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-bold text-amber-600 xl:text-[30px]">
                {formatCurrency(resumo?.descontos || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.summary.cancelamentos}
            </CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {isLoadingResumo ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-3xl font-bold text-destructive xl:text-[30px]">
                  {formatCurrency(resumo?.cancelamentos || 0)}
                </p>
              <p className="text-sm text-muted-foreground xl:text-[13px]">
                {formatNumber(resumo?.cancelamentos_qtde_skus || 0)} {DASHBOARD_TEMPO_REAL_TEXT.summary.skusCanceladosSuffix}
              </p>
              <p className="text-sm text-muted-foreground xl:text-[13px]">
                {(resumo?.cancelamentos_percentual || 0).toFixed(2)}{DASHBOARD_TEMPO_REAL_TEXT.summary.receitaSuffix}
              </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
