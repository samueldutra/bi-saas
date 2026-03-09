"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface ProdutoSemVenda {
  filial_id: number
  produto_id: number
  descricao: string
  estoque_atual: number
  data_ultima_venda: string | null
  data_ultima_entrada: string | null
  preco_custo: number
  curva_abcd: string | null
  curva_lucro: string | null
  dias_sem_venda: number
  total_count?: number
}

export const createColumns = (): ColumnDef<ProdutoSemVenda>[] => [
  {
    accessorKey: "filial_id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 justify-center w-full"
        >
          Filial
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <div className="font-medium text-center">
          {row.getValue("filial_id")}
        </div>
      )
    },
  },
  {
    accessorKey: "produto_id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-3 justify-start"
        >
          Código
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "descricao",
    header: "Descrição",
    cell: ({ row }) => {
      return (
        <div className="max-w-[300px] truncate" title={row.getValue("descricao")}>
          {row.getValue("descricao")}
        </div>
      )
    },
  },
  {
    accessorKey: "dias_sem_venda",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-3 justify-start"
        >
          Dias
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const dias = row.getValue("dias_sem_venda") as number
      return (
        <div>
          <Badge variant={dias > 90 ? 'destructive' : 'secondary'}>
            {dias}
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: "estoque_atual",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-3 justify-start"
        >
          Estoque
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const estoque = parseFloat(row.getValue("estoque_atual"))
      return (
        <div>
          {estoque.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </div>
      )
    },
  },
  {
    accessorKey: "data_ultima_venda",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-3 justify-start"
        >
          Últ. Venda
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const data = row.getValue("data_ultima_venda") as string | null
      return data ? (
        format(new Date(data), 'dd/MM/yyyy')
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
  },
  {
    accessorKey: "data_ultima_entrada",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-3 justify-start"
        >
          Últ. Entrada
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const data = row.getValue("data_ultima_entrada") as string | null
      return data ? (
        format(new Date(data), 'dd/MM/yyyy')
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
  },
  {
    accessorKey: "preco_custo",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 -ml-3 justify-start"
        >
          Custo
          <ArrowUpDown className="ml-[2px] h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const custo = parseFloat(row.getValue("preco_custo"))
      return (
        <div>
          R$ {custo.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </div>
      )
    },
  },
  {
    accessorKey: "curva_abcd",
    header: ({ column }) => {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="h-8 px-2 -ml-3 justify-start"
              >
                Curva V.
                <ArrowUpDown className="ml-[2px] h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Curva ABCD de Vendas</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
    cell: ({ row }) => {
      const curva = row.getValue("curva_abcd") as string | null
      return (
        <div>
          {curva ? (
            <Badge variant={
              curva === 'A' ? 'default' :
              curva === 'B' ? 'secondary' :
              'outline'
            }>
              {curva}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "curva_lucro",
    header: ({ column }) => {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="h-8 px-2 -ml-3 justify-start"
              >
                Curva L.
                <ArrowUpDown className="ml-[2px] h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Curva ABCD de Lucro</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
    cell: ({ row }) => {
      const curva = row.getValue("curva_lucro") as string | null
      return (
        <div>
          {curva ? (
            <Badge variant="outline">{curva}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      )
    },
  },
]
