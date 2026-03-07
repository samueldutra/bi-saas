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

import { formatCurrency, formatNumber } from './formatters'
import type { DepartamentosResponse, ProdutosResponse } from './types'

type DashboardTempoRealTablesSectionProps = {
  produtosData?: ProdutosResponse
  departamentosData?: DepartamentosResponse
  isLoadingProdutos: boolean
  isLoadingDepartamentos: boolean
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
            <CardTitle>Produtos Mais Vendidos</CardTitle>
            <CardDescription>Top produtos do dia</CardDescription>
          </div>
          <Select value={limitProdutos} onValueChange={onLimitProdutosChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-auto">
            {isLoadingProdutos ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : produtosData?.produtos &&
              Array.isArray(produtosData.produtos) &&
              produtosData.produtos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-16 text-center" />
                    <TableHead className="w-20">SKU</TableHead>
                    <TableHead className="w-20 text-right">Qtd</TableHead>
                    <TableHead className="w-28 text-right">Receita</TableHead>
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
                            Oferta
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
                Nenhum produto vendido hoje
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Receita por Departamento</CardTitle>
            <CardDescription>Participação por departamento</CardDescription>
          </div>
          <Select value={limitDepartamentos} onValueChange={onLimitDepartamentosChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-auto">
            {isLoadingDepartamentos ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : departamentosData?.departamentos &&
              Array.isArray(departamentosData.departamentos) &&
              departamentosData.departamentos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="w-28 text-right">Receita</TableHead>
                    <TableHead className="w-20 text-right">%</TableHead>
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
                Nenhum departamento com vendas hoje
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
