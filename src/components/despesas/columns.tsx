"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import { format } from "date-fns"

export type DespesaRow = {
  id: string
  tipo: 'receita' | 'receita_pdv' | 'receita_faturamento' | 'cmv' | 'cmv_pdv' | 'cmv_faturamento' | 'lucro_bruto' | 'total' | 'departamento' | 'tipo' | 'despesa' | 'lucro_liquido'
  descricao: string
  data_despesa?: string
  data_emissao?: string
  numero_nota?: number | null
  serie_nota?: string | null
  observacao?: string | null
  total: number
  percentual: number
  valores_filiais: Record<number, number>
  filiais: number[]
  subRows?: DespesaRow[]
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return format(date, 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

export const createColumns = (
  filiais: number[],
  getFilialNome: (id: number) => string,
  receitaBruta: number = 0,
  branchTotals: Record<number, number> = {},
  receitaBrutaPorFilial: Record<number, number> = {}
): ColumnDef<DespesaRow>[] => {
  const columns: ColumnDef<DespesaRow>[] = [
    {
      id: "descricao",
      accessorKey: "descricao",
      header: "Descrição",
      cell: ({ row }) => {
        const canExpand = row.getCanExpand()
        const tipo = row.original.tipo
        
        let paddingClass = "pl-3"
        if (tipo === 'tipo') paddingClass = "pl-10"
        if (tipo === 'despesa') paddingClass = "pl-16"
        // Sublinhas de receita e CMV
        if (tipo === 'receita_pdv' || tipo === 'receita_faturamento') paddingClass = "pl-10"
        if (tipo === 'cmv_pdv' || tipo === 'cmv_faturamento') paddingClass = "pl-10"

        let fontClass = "font-medium"
        let textSize = "text-sm"

        if (tipo === 'receita') {
          fontClass = "font-bold"
          textSize = "text-base"
        }
        if (tipo === 'receita_pdv' || tipo === 'receita_faturamento') {
          fontClass = "font-medium"
          textSize = "text-sm"
        }
        if (tipo === 'cmv') {
          fontClass = "font-bold"
          textSize = "text-base"
        }
        if (tipo === 'cmv_pdv' || tipo === 'cmv_faturamento') {
          fontClass = "font-medium"
          textSize = "text-sm"
        }
        if (tipo === 'lucro_bruto') {
          fontClass = "font-bold"
          textSize = "text-base"
        }
        if (tipo === 'total') {
          fontClass = "font-bold"
          textSize = "text-base"
        }
        if (tipo === 'lucro_liquido') {
          fontClass = "font-bold"
          textSize = "text-base"
        }
        if (tipo === 'departamento') {
          fontClass = "font-semibold"
        }
        if (tipo === 'despesa') {
          fontClass = "font-normal"
          textSize = "text-xs"
        }
        
        return (
          <div className={`flex items-start gap-2 ${paddingClass} py-1`}>
            {canExpand ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-muted rounded-sm"
                onClick={() => row.toggleExpanded()}
              >
                {row.getIsExpanded() ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            ) : tipo === 'despesa' ? (
              <div className="h-5 w-5 flex items-center justify-center">
                <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              </div>
            ) : null}
            
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className={`${fontClass} ${textSize} ${
                tipo === 'receita' ? 'text-green-600 dark:text-green-400' :
                tipo === 'receita_pdv' ? 'text-green-500 dark:text-green-300' :
                tipo === 'receita_faturamento' ? 'text-emerald-600 dark:text-emerald-400' :
                tipo === 'cmv' ? 'text-purple-600 dark:text-purple-400' :
                tipo === 'cmv_pdv' ? 'text-purple-500 dark:text-purple-300' :
                tipo === 'cmv_faturamento' ? 'text-violet-600 dark:text-violet-400' :
                tipo === 'lucro_bruto' ? 'text-orange-600 dark:text-orange-400' :
                tipo === 'lucro_liquido' ? 'text-blue-600 dark:text-blue-400' :
                tipo === 'total' ? 'text-primary' : ''
              }`}>
                {row.original.descricao}
              </span>
              {tipo === 'despesa' && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(row.original.data_despesa || row.original.data_emissao)}
                  {row.original.numero_nota && ` • Nota: ${row.original.numero_nota}`}
                  {row.original.serie_nota && `-${row.original.serie_nota}`}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: "total",
      accessorKey: "total",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="h-8 p-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total
            {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : ""}
          </Button>
        )
      },
      cell: ({ row }) => {
        const tipo = row.original.tipo
        const fontClass = tipo === 'receita' || tipo === 'cmv' || tipo === 'lucro_bruto' || tipo === 'total' || tipo === 'departamento' || tipo === 'lucro_liquido' ? 'font-bold' :
                         tipo === 'receita_pdv' || tipo === 'receita_faturamento' || tipo === 'cmv_pdv' || tipo === 'cmv_faturamento' ? 'font-medium' :
                         tipo === 'tipo' ? 'font-semibold' : 'font-normal'
        const textSize = tipo === 'despesa' ? 'text-xs' : 'text-sm'

        // Calcular % em relação à Receita Bruta
        const percentualRB = receitaBruta > 0 ? (row.original.total / receitaBruta) * 100 : 0

        // Para linha de receita, não mostrar os percentuais
        if (tipo === 'receita') {
          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-green-600 dark:text-green-400`}>
                {formatCurrency(row.original.total)}
              </div>
            </div>
          )
        }

        // Para sublinhas de receita (PDV e Faturamento), mostrar percentual sobre total receita
        if (tipo === 'receita_pdv') {
          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-green-500 dark:text-green-300`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}% da Receita
              </div>
            </div>
          )
        }

        if (tipo === 'receita_faturamento') {
          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-emerald-600 dark:text-emerald-400`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}% da Receita
              </div>
            </div>
          )
        }

        // Para linha de CMV, mostrar percentual sobre receita bruta
        if (tipo === 'cmv') {
          const percentualCMV = receitaBruta > 0 ? (row.original.total / receitaBruta) * 100 : 0

          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-purple-600 dark:text-purple-400`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                % RB: {percentualCMV.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Para sublinhas de CMV (PDV e Faturamento), mostrar percentual sobre total CMV
        if (tipo === 'cmv_pdv') {
          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-purple-500 dark:text-purple-300`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}% do CMV
              </div>
            </div>
          )
        }

        if (tipo === 'cmv_faturamento') {
          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-violet-600 dark:text-violet-400`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}% do CMV
              </div>
            </div>
          )
        }

        // Para linha de lucro bruto, mostrar margem de lucro bruto
        if (tipo === 'lucro_bruto') {
          const margemLucroBruto = receitaBruta > 0 ? (row.original.total / receitaBruta) * 100 : 0

          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-orange-600 dark:text-orange-400`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Margem: {margemLucroBruto.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Para linha de lucro líquido, mostrar margem de lucro líquido
        if (tipo === 'lucro_liquido') {
          // Calcular Margem de Lucro Líquido: (Lucro Líquido / Receita Bruta) × 100
          const margemLucroLiquido = receitaBruta > 0 ? (row.original.total / receitaBruta) * 100 : 0

          return (
            <div className="text-left">
              <div className={`${fontClass} ${textSize} text-blue-600 dark:text-blue-400`}>
                {formatCurrency(row.original.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Margem: {margemLucroLiquido.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        return (
          <div className="text-left">
            <div className={`${fontClass} ${textSize}`}>
              {formatCurrency(row.original.total)}
            </div>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div>% TD: {row.original.percentual.toFixed(2).replace('.', ',')}%</div>
              <div className="text-orange-600 dark:text-orange-400">
                % RB: {percentualRB.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          </div>
        )
      },
    },
  ]

  // Adicionar coluna para cada filial com cores alternadas
  filiais.forEach((filialId, index) => {
    // Cores alternadas: índice par (0,2,4...) usa cor 1, ímpar (1,3,5...) usa cor 2
    const bgColorClass = index % 2 === 0 ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-slate-50/50 dark:bg-slate-900/20'
    const hoverBgClass = index % 2 === 0 ? 'hover:bg-blue-100/50 dark:hover:bg-blue-900/30' : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
    
    columns.push({
      id: `filial_${filialId}`,
      accessorFn: (row) => row.valores_filiais[filialId] || 0,
      header: ({ column }) => {
        return (
          <div className={`${bgColorClass}`}>
            <Button
              variant="ghost"
              className={`h-8 p-0 hover:bg-transparent ${hoverBgClass}`}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              {getFilialNome(filialId)}
              {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : ""}
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const valorFilial = row.original.valores_filiais[filialId] || 0
        const totalFilial = branchTotals[filialId] || 0

        const tipo = row.original.tipo
        const fontClass = tipo === 'receita' || tipo === 'cmv' || tipo === 'lucro_bruto' || tipo === 'total' || tipo === 'lucro_liquido' ? 'font-bold' :
                         tipo === 'receita_pdv' || tipo === 'receita_faturamento' || tipo === 'cmv_pdv' || tipo === 'cmv_faturamento' ? 'font-medium' :
                         tipo === 'departamento' ? 'font-medium' :
                         tipo === 'tipo' ? 'font-normal' : 'font-normal'
        const textSize = tipo === 'despesa' ? 'text-xs' : 'text-sm'

        // Para linha de receita, não mostrar os percentuais
        if (tipo === 'receita') {
          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-green-600 dark:text-green-400`}>
                {formatCurrency(valorFilial)}
              </div>
            </div>
          )
        }

        // Para sublinhas de receita (PDV e Faturamento)
        if (tipo === 'receita_pdv') {
          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-green-500 dark:text-green-300`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        if (tipo === 'receita_faturamento') {
          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-emerald-600 dark:text-emerald-400`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Para linha de CMV, mostrar percentual sobre receita bruta
        if (tipo === 'cmv') {
          const receitaBrutaFilial = receitaBrutaPorFilial[filialId] || 0
          const percentualCMV = receitaBrutaFilial > 0 ? (valorFilial / receitaBrutaFilial) * 100 : 0

          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-purple-600 dark:text-purple-400`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                % RB: {percentualCMV.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Para sublinhas de CMV (PDV e Faturamento)
        if (tipo === 'cmv_pdv') {
          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-purple-500 dark:text-purple-300`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        if (tipo === 'cmv_faturamento') {
          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-violet-600 dark:text-violet-400`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.percentual.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Para linha de lucro bruto, mostrar margem de lucro bruto
        if (tipo === 'lucro_bruto') {
          const receitaBrutaFilial = receitaBrutaPorFilial[filialId] || 0
          const margemLucroBruto = receitaBrutaFilial > 0 ? (valorFilial / receitaBrutaFilial) * 100 : 0

          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-orange-600 dark:text-orange-400`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Margem: {margemLucroBruto.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Para linha de lucro líquido, mostrar margem de lucro líquido
        if (tipo === 'lucro_liquido') {
          // Calcular Margem de Lucro Líquido: (Lucro Líquido / Receita Bruta) × 100
          // Usar receita bruta da filial específica
          const receitaBrutaFilial = receitaBrutaPorFilial[filialId] || 0
          const margemLucroLiquido = receitaBrutaFilial > 0 ? (valorFilial / receitaBrutaFilial) * 100 : 0

          return (
            <div className={`text-left ${bgColorClass} px-2 py-1`}>
              <div className={`${fontClass} ${textSize} text-blue-600 dark:text-blue-400`}>
                {formatCurrency(valorFilial)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Margem: {margemLucroLiquido.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          )
        }

        // Calcular % TDF (em relação ao total da filial) e % RB (em relação à receita bruta da filial)
        const percentualTDF = totalFilial > 0 ? (valorFilial / totalFilial) * 100 : 0
        const receitaBrutaFilial = receitaBrutaPorFilial[filialId] || 0
        const percentualRB = receitaBrutaFilial > 0 ? (valorFilial / receitaBrutaFilial) * 100 : 0

        // % TD da coluna Total (para comparação)
        const percentualTD = row.original.percentual

        // Determinar cor do % TDF baseado na comparação com % TD
        let tdfColorClass = 'text-muted-foreground'
        if (percentualTDF < percentualTD) {
          tdfColorClass = 'text-blue-600 dark:text-blue-400'
        } else if (percentualTDF > percentualTD) {
          tdfColorClass = 'text-red-600 dark:text-red-400'
        }

        if (valorFilial === 0 && tipo === 'despesa') {
          return (
            <div className={`text-left text-xs text-muted-foreground ${bgColorClass} px-2 py-1`}>
              -
            </div>
          )
        }

        return (
          <div className={`text-left ${bgColorClass} px-2 py-1`}>
            <div className={`${fontClass} ${textSize}`}>
              {formatCurrency(valorFilial)}
            </div>
            <div className="text-[10px] space-y-0.5">
              <div className={tdfColorClass}>% TDF: {percentualTDF.toFixed(2).replace('.', ',')}%</div>
              <div className="text-orange-600 dark:text-orange-400">
                % RB: {percentualRB.toFixed(2).replace('.', ',')}%
              </div>
            </div>
          </div>
        )
      },
      meta: {
        className: bgColorClass, // Adiciona classe de fundo na meta da coluna
      },
    })
  })

  return columns
}
