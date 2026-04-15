'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { formatCurrency } from './formatters'
import type { CashFlowTableRow, CashFlowViewMode } from './types'

type SortField =
  | 'periodStart'
  | 'filialLabel'
  | 'saldoInicial'
  | 'entradasRealizadas'
  | 'saidasRealizadas'
  | 'saldoFinal'
  | 'saldoProjetado'

interface CashFlowTableProps {
  rows: CashFlowTableRow[]
  viewMode: CashFlowViewMode
}

const statusVariantMap = {
  saudavel: 'secondary',
  atencao: 'outline',
  critico: 'destructive',
} as const

const statusLabelMap = {
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
} as const

export function CashFlowTable({ rows, viewMode }: CashFlowTableProps) {
  const [sortField, setSortField] = useState<SortField>('periodStart')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const sortedRows = useMemo(() => {
    const next = [...rows]
    next.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      if (sortField === 'filialLabel') {
        return a.filialLabel.localeCompare(b.filialLabel) * direction
      }

      if (sortField === 'periodStart') {
        return a.periodStart.localeCompare(b.periodStart) * direction
      }

      return ((a[sortField] as number) - (b[sortField] as number)) * direction
    })
    return next
  }, [rows, sortDirection, sortField])

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(field === 'periodStart' ? 'desc' : 'asc')
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (field !== sortField) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />
    }

    return sortDirection === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3" />
      : <ChevronDown className="ml-1 h-3 w-3" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Tabela de Fluxo</CardTitle>
        <CardDescription>
          Visão {viewMode} com saldo inicial, movimentos realizados, projeção líquida e status por período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort('periodStart')}>
                    Período
                    <SortIcon field="periodStart" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort('filialLabel')}>
                    Visão
                    <SortIcon field="filialLabel" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="ml-auto h-8 px-2" onClick={() => handleSort('saldoInicial')}>
                    Saldo inicial
                    <SortIcon field="saldoInicial" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">PDV</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Recebimentos</TableHead>
                <TableHead className="text-right">Pagamentos</TableHead>
                <TableHead className="text-right">Outras saídas</TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="ml-auto h-8 px-2" onClick={() => handleSort('saldoFinal')}>
                    Saldo realizado
                    <SortIcon field="saldoFinal" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="ml-auto h-8 px-2" onClick={() => handleSort('saldoProjetado')}>
                    Saldo projetado
                    <SortIcon field="saldoProjetado" />
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top">
                    <div className="font-medium">
                      {format(parseISO(row.periodStart), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                    {row.periodStart !== row.periodEnd && (
                      <div className="text-xs text-muted-foreground">
                        até {format(parseISO(row.periodEnd), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium">{row.filialLabel}</div>
                    <div className="text-xs text-muted-foreground">{row.periodLabel}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.saldoInicial)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.entradasPdv)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.entradasFaturamento)}</TableCell>
                  <TableCell className="text-right">
                    <div>{formatCurrency(row.recebimentosRealizados)}</div>
                    {row.recebimentosPrevistos > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Prev.: {formatCurrency(row.recebimentosPrevistos)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatCurrency(row.pagamentosRealizados)}</div>
                    {row.pagamentosPrevistos > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Prev.: {formatCurrency(row.pagamentosPrevistos)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.outrasSaidas)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.saldoFinal)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.saldoProjetado)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariantMap[row.status]}>
                      {statusLabelMap[row.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
