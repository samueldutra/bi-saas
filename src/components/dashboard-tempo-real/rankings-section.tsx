'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { formatCurrency, formatNumber } from './formatters'
import type {
  RankingOperacional,
  SortDirection,
  SortFieldCancelamento,
  SortFieldVenda,
} from './types'

type DashboardTempoRealRankingsSectionProps = {
  isLoadingRanking: boolean
  sortedRankingVenda: RankingOperacional[]
  sortedRankingCancelamentos: RankingOperacional[]
  vendaSortField: SortFieldVenda
  vendaSortDirection: SortDirection
  cancelamentoSortField: SortFieldCancelamento
  cancelamentoSortDirection: SortDirection
  onVendaSortClick: (field: SortFieldVenda) => void
  onCancelamentoSortClick: (field: SortFieldCancelamento) => void
}

type SortIconProps = {
  active: boolean
  direction: SortDirection
}

function SortIcon({ active, direction }: SortIconProps) {
  if (!active) {
    return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
  }

  return direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
}

export function DashboardTempoRealRankingsSection({
  isLoadingRanking,
  sortedRankingVenda,
  sortedRankingCancelamentos,
  vendaSortField,
  vendaSortDirection,
  cancelamentoSortField,
  cancelamentoSortDirection,
  onVendaSortClick,
  onCancelamentoSortClick,
}: DashboardTempoRealRankingsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ranking Operacional - Venda</CardTitle>
          <CardDescription>Desempenho de vendas por filial e caixa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-auto">
            {isLoadingRanking ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sortedRankingVenda.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => onVendaSortClick('filial_nome')}
                    >
                      <div className="flex items-center gap-1">
                        Filial
                        <SortIcon
                          active={vendaSortField === 'filial_nome'}
                          direction={vendaSortDirection}
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-20 cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => onVendaSortClick('caixa')}
                    >
                      <div className="flex items-center gap-1">
                        Caixa
                        <SortIcon active={vendaSortField === 'caixa'} direction={vendaSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-24 cursor-pointer select-none text-right hover:bg-muted/50"
                      onClick={() => onVendaSortClick('skus_venda')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        SKUs
                        <SortIcon
                          active={vendaSortField === 'skus_venda'}
                          direction={vendaSortDirection}
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-32 cursor-pointer select-none text-right hover:bg-muted/50"
                      onClick={() => onVendaSortClick('valor_vendido')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Valor Vendido
                        <SortIcon
                          active={vendaSortField === 'valor_vendido'}
                          direction={vendaSortDirection}
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRankingVenda.map((item) => (
                    <TableRow key={`venda-${item.filial_id}-${item.caixa}`}>
                      <TableCell className="max-w-[150px] truncate" title={item.filial_nome}>
                        {item.filial_nome}
                      </TableCell>
                      <TableCell>{item.caixa}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.skus_venda)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.valor_vendido)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Nenhum dado de venda disponível
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking Operacional - Cancelamentos</CardTitle>
          <CardDescription>Cancelamentos por filial e caixa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-auto">
            {isLoadingRanking ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sortedRankingCancelamentos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => onCancelamentoSortClick('filial_nome')}
                    >
                      <div className="flex items-center gap-1">
                        Filial
                        <SortIcon
                          active={cancelamentoSortField === 'filial_nome'}
                          direction={cancelamentoSortDirection}
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-20 cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => onCancelamentoSortClick('caixa')}
                    >
                      <div className="flex items-center gap-1">
                        Caixa
                        <SortIcon
                          active={cancelamentoSortField === 'caixa'}
                          direction={cancelamentoSortDirection}
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-24 cursor-pointer select-none text-right hover:bg-muted/50"
                      onClick={() => onCancelamentoSortClick('skus_cancelados')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        SKUs
                        <SortIcon
                          active={cancelamentoSortField === 'skus_cancelados'}
                          direction={cancelamentoSortDirection}
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-32 cursor-pointer select-none text-right hover:bg-muted/50"
                      onClick={() => onCancelamentoSortClick('valor_cancelamentos')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Valor Canc.
                        <SortIcon
                          active={cancelamentoSortField === 'valor_cancelamentos'}
                          direction={cancelamentoSortDirection}
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRankingCancelamentos.map((item) => (
                    <TableRow key={`canc-${item.filial_id}-${item.caixa}`}>
                      <TableCell className="max-w-[150px] truncate" title={item.filial_nome}>
                        {item.filial_nome}
                      </TableCell>
                      <TableCell>{item.caixa}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatNumber(item.skus_cancelados)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatCurrency(item.valor_cancelamentos)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Nenhum cancelamento registrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
