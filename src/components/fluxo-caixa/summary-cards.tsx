'use client'

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { formatCompactCurrency, formatDelta } from './formatters'
import type { CashFlowSummary, CashFlowViewMode } from './types'

interface CashFlowSummaryCardsProps {
  summary: CashFlowSummary
  viewMode: CashFlowViewMode
}

export function CashFlowSummaryCards({
  summary,
  viewMode,
}: CashFlowSummaryCardsProps) {
  const cards = [
    {
      title: 'Saldo inicial',
      value: formatCompactCurrency(summary.saldoInicial),
      description: 'Base do período filtrado',
      icon: Landmark,
    },
    {
      title: 'Entradas realizadas',
      value: formatCompactCurrency(summary.entradasRealizadas),
      description: 'PDV, faturamento e recebimentos baixados',
      icon: ArrowUpCircle,
    },
    {
      title: 'Saídas realizadas',
      value: formatCompactCurrency(summary.saidasRealizadas),
      description: 'Pagamentos e outras saídas efetivas',
      icon: ArrowDownCircle,
    },
    {
      title: 'Saldo realizado',
      value: formatCompactCurrency(summary.saldoRealizado),
      description: viewMode === 'realizado' ? 'Visão principal ativa' : 'Caixa após movimentos realizados',
      icon: Wallet,
    },
    {
      title: 'Variação prevista',
      value: formatDelta(summary.variacaoPrevista),
      description: 'Recebimentos previstos menos pagamentos previstos',
      icon: TrendingUp,
    },
    {
      title: 'Filiais críticas',
      value: summary.filiaisCriticas.toString(),
      description: 'Saldo projetado negativo no recorte',
      icon: AlertTriangle,
      badge: summary.filiaisCriticas > 0 ? 'Ação necessária' : 'Sem risco',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                {card.badge && (
                  <Badge variant={summary.filiaisCriticas > 0 ? 'destructive' : 'secondary'}>
                    {card.badge}
                  </Badge>
                )}
              </div>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
