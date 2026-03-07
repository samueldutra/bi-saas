'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import {
  DASHBOARD_TEMPO_REAL_LIMIT_OPTIONS,
  DASHBOARD_TEMPO_REAL_TEXT,
} from './config'
import { formatCurrency, formatNumber } from './formatters'
import { DashboardTempoRealSectionError } from './section-error'
import type { DepartamentosResponse, ProdutosResponse } from './types'

type DashboardTempoRealTablesSectionProps = {
  produtosData?: ProdutosResponse
  departamentosData?: DepartamentosResponse
  isLoadingProdutos: boolean
  isLoadingDepartamentos: boolean
  errorProdutos?: string | null
  errorDepartamentos?: string | null
  limitProdutos: string
  limitDepartamentos: string
  onLimitProdutosChange: (value: string) => void
  onLimitDepartamentosChange: (value: string) => void
}

export function DashboardTempoRealTablesSection({
  produtosData,
  departamentosData,
  isLoadingProdutos,
  isLoadingDepartamentos,
  errorProdutos,
  errorDepartamentos,
  limitProdutos,
  limitDepartamentos,
  onLimitProdutosChange,
  onLimitDepartamentosChange,
}: DashboardTempoRealTablesSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{DASHBOARD_TEMPO_REAL_TEXT.tables.produtosTitle}</CardTitle>
            <CardDescription>{DASHBOARD_TEMPO_REAL_TEXT.tables.produtosDescription}</CardDescription>
          </div>
          <Select value={limitProdutos} onValueChange={onLimitProdutosChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_TEMPO_REAL_LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-auto">
            {errorProdutos && (isLoadingProdutos || produtosData) && (
              <DashboardTempoRealSectionError
                className="mb-4"
                message={errorProdutos}
              />
            )}
            {isLoadingProdutos ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : errorProdutos && !produtosData ? (
              <div className="flex h-full items-center justify-center">
                <DashboardTempoRealSectionError message={errorProdutos} />
              </div>
            ) : produtosData?.produtos &&
              Array.isArray(produtosData.produtos) &&
              produtosData.produtos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{DASHBOARD_TEMPO_REAL_TEXT.tables.produtoColumn}</TableHead>
                    <TableHead className="w-16 text-center" />
                    <TableHead className="w-20">{DASHBOARD_TEMPO_REAL_TEXT.tables.skuColumn}</TableHead>
                    <TableHead className="w-20 text-right">{DASHBOARD_TEMPO_REAL_TEXT.tables.quantidadeColumn}</TableHead>
                    <TableHead className="w-28 text-right">{DASHBOARD_TEMPO_REAL_TEXT.tables.receitaColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosData.produtos.map((produto) => (
                    <TableRow key={produto.produto_id}>
                      <TableCell className="max-w-[180px] truncate" title={produto.descricao}>
                        {produto.descricao}
                      </TableCell>
                      <TableCell className="text-center">
                        {produto.is_oferta && (
                          <Badge className="bg-orange-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-orange-600">
                            {DASHBOARD_TEMPO_REAL_TEXT.tables.ofertaBadge}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{produto.produto_id}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(produto.quantidade_vendida)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(produto.receita)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {DASHBOARD_TEMPO_REAL_TEXT.tables.noProducts}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{DASHBOARD_TEMPO_REAL_TEXT.tables.departamentosTitle}</CardTitle>
            <CardDescription>{DASHBOARD_TEMPO_REAL_TEXT.tables.departamentosDescription}</CardDescription>
          </div>
          <Select value={limitDepartamentos} onValueChange={onLimitDepartamentosChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_TEMPO_REAL_LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-auto">
            {errorDepartamentos && (isLoadingDepartamentos || departamentosData) && (
              <DashboardTempoRealSectionError
                className="mb-4"
                message={errorDepartamentos}
              />
            )}
            {isLoadingDepartamentos ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : errorDepartamentos && !departamentosData ? (
              <div className="flex h-full items-center justify-center">
                <DashboardTempoRealSectionError message={errorDepartamentos} />
              </div>
            ) : departamentosData?.departamentos &&
              Array.isArray(departamentosData.departamentos) &&
              departamentosData.departamentos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{DASHBOARD_TEMPO_REAL_TEXT.tables.departamentoColumn}</TableHead>
                    <TableHead className="w-28 text-right">{DASHBOARD_TEMPO_REAL_TEXT.tables.receitaColumn}</TableHead>
                    <TableHead className="w-20 text-right">{DASHBOARD_TEMPO_REAL_TEXT.tables.percentualColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departamentosData.departamentos.map((departamento) => (
                    <TableRow key={departamento.departamento_id}>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={departamento.departamento_nome}
                      >
                        {departamento.departamento_nome}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(departamento.receita)}
                      </TableCell>
                      <TableCell className="text-right">
                        {departamento.participacao_percentual.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {DASHBOARD_TEMPO_REAL_TEXT.tables.noDepartments}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
