'use client'

// Relatório de Perdas - MultiSelect de filiais
import { useState, useEffect, useMemo, memo, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useTenantContext } from '@/contexts/tenant-context'
import { useBranchesOptions } from '@/hooks/use-branches'
import { ChevronDown, ChevronRight, Newspaper, FileDown, Search, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { logModuleAccess } from '@/lib/audit'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from 'recharts'
import { PageHeader } from '@/components/dashboard/page-header'

// Tipos para jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

interface Produto {
  codigo: number
  descricao: string
  filial_id: number
  qtde: number
  valor_perda: number
}

interface DeptNivel1 {
  dept1_id: number
  dept_nivel1: string
  total_qtde: number
  total_valor: number
  venda_setor: number
  produtos: Produto[]
}

interface DeptNivel2 {
  dept2_id: number
  dept_nivel2: string
  total_qtde: number
  total_valor: number
  venda_setor: number
  nivel1: DeptNivel1[]
}

interface DeptNivel3 {
  dept3_id: number
  dept_nivel3: string
  total_qtde: number
  total_valor: number
  venda_setor: number
  nivel2: DeptNivel2[]
}

interface ReportData {
  total_records: number
  page: number
  page_size: number
  total_pages: number
  hierarquia: DeptNivel3[]
  total_vendas_periodo: number
  perdas_por_filial: Record<string, number>
  total_perdas_atual: number
  total_perdas_mes_anterior: number
  mes_anterior: number
  ano_anterior: number
}

// Tipos para ordenação de produtos
type SortField = 'filial_id' | 'codigo' | 'descricao' | 'qtde' | 'valor_perda' | 'percent_setor' | 'percent_geral'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  direction: SortDirection
}

// Componente memoizado para renderização de produtos
const ProdutoTable = memo(function ProdutoTable({
  produtos,
  filtroProduto,
  totalVendasPeriodo,
  vendaSetor
}: {
  produtos: Produto[]
  filtroProduto: string
  totalVendasPeriodo: number
  vendaSetor: number
}) {
  // Estado de ordenação - padrão: Descrição ASC
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'descricao', direction: 'asc' })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatQuantity = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value)
  }

  const formatPercent = (valorPerda: number, totalVendas: number) => {
    if (!totalVendas || totalVendas === 0) return '-'
    const percent = (valorPerda / totalVendas) * 100
    return `${percent.toFixed(2)}%`
  }

  const calcPercent = (valorPerda: number, totalVendas: number): number => {
    if (!totalVendas || totalVendas === 0) return 0
    return (valorPerda / totalVendas) * 100
  }

  const produtoCorrespondeFiltro = (produto: Produto): boolean => {
    if (!filtroProduto || filtroProduto.length < 3) return false
    const termoBusca = filtroProduto.toLowerCase()
    const codigoStr = produto.codigo.toString()
    const descricao = produto.descricao.toLowerCase()
    return codigoStr.includes(termoBusca) || descricao.includes(termoBusca)
  }

  // Função para alternar ordenação
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Ícone de ordenação
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 inline text-primary" />
  }

  // Produtos ordenados
  const sortedProdutos = useMemo(() => {
    const sorted = [...produtos]
    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortConfig.field) {
        case 'filial_id':
          comparison = a.filial_id - b.filial_id
          break
        case 'codigo':
          comparison = a.codigo - b.codigo
          break
        case 'descricao':
          comparison = a.descricao.localeCompare(b.descricao, 'pt-BR')
          break
        case 'qtde':
          comparison = a.qtde - b.qtde
          break
        case 'valor_perda':
          comparison = a.valor_perda - b.valor_perda
          break
        case 'percent_setor':
          comparison = calcPercent(a.valor_perda, vendaSetor) - calcPercent(b.valor_perda, vendaSetor)
          break
        case 'percent_geral':
          comparison = calcPercent(a.valor_perda, totalVendasPeriodo) - calcPercent(b.valor_perda, totalVendasPeriodo)
          break
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [produtos, sortConfig, vendaSetor, totalVendasPeriodo])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('filial_id')}
          >
            Filial
            <SortIcon field="filial_id" />
          </TableHead>
          <TableHead
            className="text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('codigo')}
          >
            Código
            <SortIcon field="codigo" />
          </TableHead>
          <TableHead
            className="text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('descricao')}
          >
            Descrição
            <SortIcon field="descricao" />
          </TableHead>
          <TableHead
            className="text-right text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('qtde')}
          >
            Qtde
            <SortIcon field="qtde" />
          </TableHead>
          <TableHead
            className="text-right text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('valor_perda')}
          >
            Valor Perda
            <SortIcon field="valor_perda" />
          </TableHead>
          <TableHead
            className="text-right text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('percent_setor')}
          >
            % Setor
            <SortIcon field="percent_setor" />
          </TableHead>
          <TableHead
            className="text-right text-xs cursor-pointer hover:bg-muted/50 select-none"
            onClick={() => handleSort('percent_geral')}
          >
            % Geral
            <SortIcon field="percent_geral" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedProdutos.map((produto, idx) => {
          const isHighlighted = filtroProduto.length >= 3 && produtoCorrespondeFiltro(produto)

          return (
            <TableRow
              key={`${produto.codigo}-${produto.filial_id}-${idx}`}
              className={`border-b ${isHighlighted ? 'bg-primary/10' : ''}`}
            >
              <TableCell className="text-xs">{produto.filial_id}</TableCell>
              <TableCell className="text-xs font-mono">{produto.codigo}</TableCell>
              <TableCell className="text-xs">{produto.descricao}</TableCell>
              <TableCell className="text-right text-xs">{formatQuantity(produto.qtde)}</TableCell>
              <TableCell className="text-right text-xs">{formatCurrency(produto.valor_perda)}</TableCell>
              <TableCell className="text-right text-xs">{formatPercent(produto.valor_perda, vendaSetor)}</TableCell>
              <TableCell className="text-right text-xs">{formatPercent(produto.valor_perda, totalVendasPeriodo)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
})

// Cores para os gráficos
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6']

// Componente para renderizar setor ativo do gráfico de pizza (reservado para uso futuro)
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)
  const sx = cx + (outerRadius + 10) * cos
  const sy = cy + (outerRadius + 10) * sin
  const mx = cx + (outerRadius + 30) * cos
  const my = cy + (outerRadius + 30) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * 22
  const ey = my
  const textAnchor = cos >= 0 ? 'start' : 'end'

  const formatCurrencyLocal = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  return (
    <g>
      <text x={cx} y={cy} dy={-5} textAnchor="middle" fill={fill} className="text-sm font-semibold">
        {payload.name}
      </text>
      <text x={cx} y={cy} dy={15} textAnchor="middle" fill="#666" className="text-xs">
        {formatCurrencyLocal(value)}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-xs">
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  )
}

export default function PerdasPage() {
  const { currentTenant, userProfile } = useTenantContext()
  const { options: filiaisOptions } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
  })

  // Estados
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filtros
  const currentDate = new Date()
  const [mes, setMes] = useState((currentDate.getMonth() + 1).toString())
  const [ano, setAno] = useState(currentDate.getFullYear().toString())
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<{ value: string; label: string }[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 50

  // Estados de expansão
  const [expandedDept1, setExpandedDept1] = useState<Record<string, boolean>>({})
  const [expandedDept2, setExpandedDept2] = useState<Record<string, boolean>>({})
  const [expandedDept3, setExpandedDept3] = useState<Record<string, boolean>>({})

  // Estado para gráfico de pizza (active index) - reservado para uso futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activePieIndex, setActivePieIndex] = useState(0)

  // Filtro de produto - COM DEBOUNCE REAL
  const [filtroProduto, setFiltroProduto] = useState('')
  const [inputValue, setInputValue] = useState('')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Efeito de debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (inputValue.length < 3) {
      setFiltroProduto('')
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      setFiltroProduto(inputValue)
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [inputValue])

  // Log de acesso ao módulo
  useEffect(() => {
    if (userProfile && currentTenant) {
      logModuleAccess({
        module: 'relatorios_perdas',
        action: 'view',
        tenantId: currentTenant.id,
        userName: userProfile.full_name,
      })
    }
  }, [userProfile, currentTenant])

  // Aplicar filtros automaticamente quando mudarem
  useEffect(() => {
    if (currentTenant?.supabase_schema && mes && ano) {
      fetchData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano, filiaisSelecionadas, currentTenant?.supabase_schema])

  // Carregar dados quando a página mudar
  useEffect(() => {
    if (currentTenant?.supabase_schema && page > 1) {
      fetchData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Calcular hierarquia filtrada usando useMemo
  const hierarquiaFiltrada = useMemo(() => {
    if (!data?.hierarquia) return []
    if (!filtroProduto || filtroProduto.length < 3) return data.hierarquia

    const produtoCorresponde = (produto: Produto, termo: string): boolean => {
      const termoBusca = termo.toLowerCase()
      const codigoStr = produto.codigo.toString()
      const descricao = produto.descricao.toLowerCase()
      return codigoStr.includes(termoBusca) || descricao.includes(termoBusca)
    }

    const resultado: DeptNivel3[] = []

    for (const dept3 of data.hierarquia) {
      const nivel2Filtrado: DeptNivel2[] = []

      if (dept3.nivel2) {
        for (const dept2 of dept3.nivel2) {
          const nivel1Filtrado: DeptNivel1[] = []

          if (dept2.nivel1) {
            for (const dept1 of dept2.nivel1) {
              if (dept1.produtos?.some(p => produtoCorresponde(p, filtroProduto))) {
                nivel1Filtrado.push(dept1)
              }
            }
          }

          if (nivel1Filtrado.length > 0) {
            nivel2Filtrado.push({
              ...dept2,
              nivel1: nivel1Filtrado
            })
          }
        }
      }

      if (nivel2Filtrado.length > 0) {
        resultado.push({
          ...dept3,
          nivel2: nivel2Filtrado
        })
      }
    }

    return resultado
  }, [data?.hierarquia, filtroProduto])

  // Calcular totais gerais
  const totaisGerais = useMemo(() => {
    if (!hierarquiaFiltrada || hierarquiaFiltrada.length === 0) {
      return { totalQuantidade: 0, totalValor: 0 }
    }

    return hierarquiaFiltrada.reduce(
      (acc, dept3) => ({
        totalQuantidade: acc.totalQuantidade + (dept3.total_qtde || 0),
        totalValor: acc.totalValor + (dept3.total_valor || 0)
      }),
      { totalQuantidade: 0, totalValor: 0 }
    )
  }, [hierarquiaFiltrada])

  // Dados para o gráfico de pizza (perdas por filial)
  const pieChartData = useMemo(() => {
    if (!data?.perdas_por_filial) return []

    return Object.entries(data.perdas_por_filial)
      .map(([filialId, valor]) => {
        const filialInfo = filiaisOptions.find(f => f.value === filialId)
        return {
          name: filialInfo?.label || `Filial ${filialId}`,
          value: valor,
          filialId
        }
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [data?.perdas_por_filial, filiaisOptions])

  // Dados para o gráfico de barras horizontais (perdas por departamento nível 3)
  const barChartData = useMemo(() => {
    if (!hierarquiaFiltrada || hierarquiaFiltrada.length === 0) return []

    return hierarquiaFiltrada
      .map(dept3 => ({
        name: dept3.dept_nivel3.length > 20 ? dept3.dept_nivel3.substring(0, 20) + '...' : dept3.dept_nivel3,
        fullName: dept3.dept_nivel3,
        value: dept3.total_valor
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Limitar aos 10 maiores
  }, [hierarquiaFiltrada])

  // Calcular variação percentual em relação ao mês anterior
  const variacaoMesAnterior = useMemo(() => {
    if (!data) return { percentual: 0, direcao: 'igual' as 'alta' | 'baixa' | 'igual' }

    const atual = data.total_perdas_atual || 0
    const anterior = data.total_perdas_mes_anterior || 0

    if (anterior === 0) {
      return { percentual: atual > 0 ? 100 : 0, direcao: atual > 0 ? 'alta' as const : 'igual' as const }
    }

    const percentual = ((atual - anterior) / anterior) * 100

    return {
      percentual: Math.abs(percentual),
      direcao: percentual > 0 ? 'alta' as const : percentual < 0 ? 'baixa' as const : 'igual' as const
    }
  }, [data])

  // Expandir automaticamente os collapsibles quando houver filtro ativo
  useEffect(() => {
    if (filtroProduto.length >= 3 && hierarquiaFiltrada.length > 0) {
      const newExpandedDept3: Record<string, boolean> = {}
      const newExpandedDept2: Record<string, boolean> = {}
      const newExpandedDept1: Record<string, boolean> = {}

      hierarquiaFiltrada.forEach(dept3 => {
        newExpandedDept3[dept3.dept3_id.toString()] = true

        dept3.nivel2?.forEach(dept2 => {
          newExpandedDept2[dept2.dept2_id.toString()] = true

          dept2.nivel1?.forEach(dept1 => {
            newExpandedDept1[dept1.dept1_id.toString()] = true
          })
        })
      })

      setExpandedDept3(newExpandedDept3)
      setExpandedDept2(newExpandedDept2)
      setExpandedDept1(newExpandedDept1)
    } else if (filtroProduto.length < 3) {
      setExpandedDept3({})
      setExpandedDept2({})
      setExpandedDept1({})
    }
  }, [filtroProduto, hierarquiaFiltrada])

  // Buscar dados
  const fetchData = async () => {
    if (!currentTenant?.supabase_schema) return

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        mes,
        ano,
        page: page.toString(),
        page_size: pageSize.toString(),
      })

      // Adicionar filiais apenas se selecionadas (senão API busca todas)
      if (filiaisSelecionadas.length > 0) {
        params.set('filial_id', filiaisSelecionadas.map(f => f.value).join(','))
      }

      const response = await fetch(`/api/relatorios/perdas?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar dados')
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados')
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Exportar PDF
  const handleExportarPDF = async () => {
    if (!currentTenant?.supabase_schema) return

    try {
      setLoading(true)

      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      // Buscar TODOS os dados sem paginação
      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        mes,
        ano,
        page: '1',
        page_size: '10000'
      })

      // Adicionar filiais apenas se selecionadas (senão API busca todas)
      if (filiaisSelecionadas.length > 0) {
        params.set('filial_id', filiaisSelecionadas.map(f => f.value).join(','))
      }

      const response = await fetch(`/api/relatorios/perdas?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao buscar dados para exportação')
      }

      const allData = await response.json()

      // Criar PDF em orientação paisagem
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      doc.setFont('helvetica')

      // Cabeçalho
      const filialNome = filiaisSelecionadas.length === 0
        ? 'Todas as filiais'
        : filiaisSelecionadas.length === 1
          ? (filiaisOptions.find(f => f.value === filiaisSelecionadas[0].value)?.label || filiaisSelecionadas[0].label)
          : `${filiaisSelecionadas.length} filiais selecionadas`
      const mesNome = meses.find(m => m.value === mes)?.label || mes

      doc.setFontSize(16)
      doc.text('Relatório de Perdas', doc.internal.pageSize.width / 2, 15, { align: 'center' })

      doc.setFontSize(10)
      doc.text(`Filial: ${filialNome}`, 14, 25)
      doc.text(`Período: ${mesNome}/${ano}`, 14, 30)
      doc.text(`Total de departamentos: ${allData.hierarquia?.length || 0}`, 14, 35)
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 40)

      // Preparar dados da tabela
      const tableData: (string | number | { content: string; colSpan: number; styles: { fillColor: number[]; fontStyle: string; textColor?: number[] } })[][] = []

      allData.hierarquia?.forEach((dept3: DeptNivel3) => {
        tableData.push([
          {
            content: `${dept3.dept_nivel3} - Qtde: ${formatQuantity(dept3.total_qtde)} | Valor: ${formatCurrency(dept3.total_valor)}`,
            colSpan: 5,
            styles: {
              fillColor: [220, 38, 38],
              fontStyle: 'bold',
              textColor: [255, 255, 255]
            }
          }
        ])

        dept3.nivel2?.forEach((dept2: DeptNivel2) => {
          tableData.push([
            {
              content: `  ${dept2.dept_nivel2} - Qtde: ${formatQuantity(dept2.total_qtde)} | Valor: ${formatCurrency(dept2.total_valor)}`,
              colSpan: 5,
              styles: {
                fillColor: [254, 202, 202],
                fontStyle: 'bold'
              }
            }
          ])

          dept2.nivel1?.forEach((dept1: DeptNivel1) => {
            tableData.push([
              {
                content: `    ${dept1.dept_nivel1} - Qtde: ${formatQuantity(dept1.total_qtde)} | Valor: ${formatCurrency(dept1.total_valor)}`,
                colSpan: 5,
                styles: {
                  fillColor: [254, 226, 226],
                  fontStyle: 'bold'
                }
              }
            ])

            dept1.produtos?.forEach((produto: Produto) => {
              tableData.push([
                produto.filial_id.toString(),
                produto.codigo.toString(),
                produto.descricao.substring(0, 50),
                formatQuantity(produto.qtde),
                formatCurrency(produto.valor_perda)
              ])
            })
          })
        })
      })

      const headers = ['Filial', 'Código', 'Descrição', 'Qtde', 'Valor Perda']

      const columnStyles: Record<number, { cellWidth?: number; halign?: 'center' | 'right' | 'left' }> = {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 25 },
        2: { cellWidth: 120 },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' },
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      autoTable(doc as any, {
        head: [headers],
        body: tableData as any,
        /* eslint-enable @typescript-eslint/no-explicit-any */
        startY: 45,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        columnStyles,
        margin: { top: 45, left: 10, right: 10 },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages()
          doc.setFontSize(8)
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          )
        },
      })

      const fileName = `perdas-${filialNome.replace(/\s+/g, '-')}-${mesNome}-${ano}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao exportar PDF'
      alert(`Erro ao exportar PDF: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Funções de toggle
  const toggleDept1 = (id: string) => {
    setExpandedDept1(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleDept2 = (id: string) => {
    setExpandedDept2(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleDept3 = (id: string) => {
    setExpandedDept3(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Funções auxiliares
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatQuantity = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value)
  }

  const formatPercent = (valorPerda: number, totalVendas: number) => {
    if (!totalVendas || totalVendas === 0) return '-'
    const percent = (valorPerda / totalVendas) * 100
    return `${percent.toFixed(2)}%`
  }

  // Total de vendas do período para cálculo do percentual
  const totalVendasPeriodo = data?.total_vendas_periodo || 0

  const meses = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ]

  const anos = Array.from({ length: 5 }, (_, i) => {
    const year = currentDate.getFullYear() - i
    return { value: year.toString(), label: year.toString() }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        section="Perdas"
        title="Relatório de Perdas"
        description="Análise detalhada de perdas por período e filial"
        icon={Newspaper}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4">
            {/* Filiais */}
            <div className="flex flex-col gap-2 flex-1">
              <Label>Filiais</Label>
              <div className="h-10">
                <MultiSelect
                  options={filiaisOptions}
                  value={filiaisSelecionadas}
                  onValueChange={(value) => {
                    setFiliaisSelecionadas(value)
                    setPage(1)
                  }}
                  placeholder="Todas as filiais"
                  className="w-full h-10"
                />
              </div>
            </div>

            {/* Mês */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Label>Mês</Label>
              <div className="h-10">
                <Select value={mes} onValueChange={(value) => { setMes(value); setPage(1) }}>
                  <SelectTrigger className="w-full sm:w-[160px] h-10">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ano */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Label>Ano</Label>
              <div className="h-10">
                <Select value={ano} onValueChange={(value) => { setAno(value); setPage(1) }}>
                  <SelectTrigger className="w-full sm:w-[120px] h-10">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtro de Produto */}
            <div className="flex flex-col gap-2 flex-[0.8] min-w-0">
              <Label>Filtrar Produto</Label>
              <div className="h-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Digite código ou nome (mín. 3 caracteres)"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full h-10 pl-9"
                />
                {inputValue.length > 0 && inputValue.length < 3 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Mín. 3 caracteres
                  </span>
                )}
                {inputValue.length >= 3 && filtroProduto !== inputValue && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500">
                    Filtrando...
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo e Gráficos */}
      {!loading && data && data.hierarquia && data.hierarquia.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: Total de Perdas com Comparativo */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Perdas</CardDescription>
              <CardTitle className="text-2xl">
                {formatCurrency(data.total_perdas_atual || 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                {variacaoMesAnterior.direcao === 'alta' && (
                  <>
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    <span className="text-red-500 font-medium">
                      +{variacaoMesAnterior.percentual.toFixed(1)}%
                    </span>
                  </>
                )}
                {variacaoMesAnterior.direcao === 'baixa' && (
                  <>
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    <span className="text-green-500 font-medium">
                      -{variacaoMesAnterior.percentual.toFixed(1)}%
                    </span>
                  </>
                )}
                {variacaoMesAnterior.direcao === 'igual' && (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">0%</span>
                  </>
                )}
                <span className="text-muted-foreground">vs mês anterior</span>
              </div>
              <div className="mt-2 pt-2 border-t">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {meses.find(m => m.value === data.mes_anterior?.toString())?.label || data.mes_anterior}/{data.ano_anterior}:
                  </span>
                  <span className="font-medium">
                    {formatCurrency(data.total_perdas_mes_anterior || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Gráfico de Pizza - Perdas por Filial */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Perdas por Filial</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              {pieChartData.length > 0 ? (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        dataKey="value"
                        label={({ cx, cy, midAngle, outerRadius, index }) => {
                          const RADIAN = Math.PI / 180
                          const radius = outerRadius + 25
                          const x = cx + radius * Math.cos(-midAngle * RADIAN)
                          const y = cy + radius * Math.sin(-midAngle * RADIAN)
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={COLORS[index % COLORS.length]}
                              textAnchor={x > cx ? 'start' : 'end'}
                              dominantBaseline="central"
                              className="text-[10px] font-medium"
                            >
                              {`Filial ${pieChartData[index].filialId}`}
                            </text>
                          )
                        }}
                        labelLine={{ stroke: '#999', strokeWidth: 1 }}
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados para exibir
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Gráfico de Barras Horizontal - Perdas por Departamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Top 10 Setores</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              {barChartData.length > 0 ? (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={barChartData}
                      margin={{ top: 0, right: 70, left: 5, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={5}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            return payload[0].payload.fullName
                          }
                          return label
                        }}
                        contentStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#333', fontWeight: 'bold' }}
                      />
                      <Bar
                        dataKey="value"
                        fill="#F06D54"
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                        label={({ x, y, width, height, value }) => {
                          const maxValue = Math.max(...barChartData.map(d => d.value))
                          const isSmallBar = (value as number) < maxValue * 0.3
                          const formattedValue = new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(value as number)

                          return (
                            <text
                              x={isSmallBar ? (x as number) + (width as number) + 5 : (x as number) + (width as number) - 5}
                              y={(y as number) + (height as number) / 2}
                              fill={isSmallBar ? '#666' : '#fff'}
                              textAnchor={isSmallBar ? 'start' : 'end'}
                              dominantBaseline="middle"
                              className="text-[8px] font-medium"
                            >
                              {formattedValue}
                            </text>
                          )
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados para exibir
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Erro */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dados */}
      {!loading && data && data.hierarquia && data.hierarquia.length > 0 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5" />
                  Perdas por Departamento
                </CardTitle>
                <CardDescription>
                  Total de {data.total_records} departamentos encontrados
                </CardDescription>
              </div>
              <Button
                onClick={handleExportarPDF}
                disabled={loading}
                variant="outline"
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            </CardHeader>
            <CardContent>
              {/* Banner Totalizador */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 mb-4">
                <div className="flex items-center gap-6">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Receita Bruta:</span>
                    <span className="ml-2 font-semibold">{formatCurrency(totalVendasPeriodo)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Qtde Total:</span>
                    <span className="ml-2 font-semibold">{formatQuantity(totaisGerais.totalQuantidade)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Valor Total de Perda:</span>
                    <span className="ml-2 font-bold text-base">{formatCurrency(totaisGerais.totalValor)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">% Geral:</span>
                    <span className="ml-2 font-bold text-base">{formatPercent(totaisGerais.totalValor, totalVendasPeriodo)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {hierarquiaFiltrada.map((dept3) => (
                  <Collapsible
                    key={dept3.dept3_id}
                    open={expandedDept3[dept3.dept3_id.toString()]}
                    onOpenChange={() => toggleDept3(dept3.dept3_id.toString())}
                  >
                    <div className="rounded-lg border bg-card">
                      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-accent/50">
                        <div className="flex items-center gap-2">
                          {expandedDept3[dept3.dept3_id.toString()] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-bold text-base">
                            {dept3.dept_nivel3}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Quantidade</div>
                            <div className="font-semibold text-sm">
                              {formatQuantity(dept3.total_qtde)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Valor Perda</div>
                            <div className="font-semibold text-sm">
                              {formatCurrency(dept3.total_valor)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Venda Setor</div>
                            <div className="font-semibold text-sm">
                              {formatCurrency(dept3.venda_setor || 0)}
                            </div>
                          </div>
                          <div className="text-right min-w-[55px]">
                            <div className="text-xs text-muted-foreground">% Setor</div>
                            <div className="font-semibold text-sm">
                              {formatPercent(dept3.total_valor, dept3.venda_setor || 0)}
                            </div>
                          </div>
                          <div className="text-right min-w-[55px]">
                            <div className="text-xs text-muted-foreground">% Geral</div>
                            <div className="font-semibold text-sm">
                              {formatPercent(dept3.total_valor, totalVendasPeriodo)}
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t p-4 space-y-2">
                          {dept3.nivel2?.map((dept2) => (
                            <Collapsible
                              key={dept2.dept2_id}
                              open={expandedDept2[dept2.dept2_id.toString()]}
                              onOpenChange={() => toggleDept2(dept2.dept2_id.toString())}
                            >
                              <div className="rounded-lg border bg-card/50">
                                <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-accent/50">
                                  <div className="flex items-center gap-2">
                                    {expandedDept2[dept2.dept2_id.toString()] ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <span className="font-semibold text-sm">
                                      {dept2.dept_nivel2}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <div className="text-xs text-muted-foreground">Quantidade</div>
                                      <div className="font-medium text-xs">
                                        {formatQuantity(dept2.total_qtde)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs text-muted-foreground">Valor Perda</div>
                                      <div className="font-medium text-xs">
                                        {formatCurrency(dept2.total_valor)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs text-muted-foreground">Venda Setor</div>
                                      <div className="font-medium text-xs">
                                        {formatCurrency(dept2.venda_setor || 0)}
                                      </div>
                                    </div>
                                    <div className="text-right min-w-[50px]">
                                      <div className="text-xs text-muted-foreground">% Setor</div>
                                      <div className="font-medium text-xs">
                                        {formatPercent(dept2.total_valor, dept2.venda_setor || 0)}
                                      </div>
                                    </div>
                                    <div className="text-right min-w-[50px]">
                                      <div className="text-xs text-muted-foreground">% Geral</div>
                                      <div className="font-medium text-xs">
                                        {formatPercent(dept2.total_valor, totalVendasPeriodo)}
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="border-t p-3 space-y-2">
                                    {dept2.nivel1?.map((dept1) => (
                                      <Collapsible
                                        key={dept1.dept1_id}
                                        open={expandedDept1[dept1.dept1_id.toString()]}
                                        onOpenChange={() => toggleDept1(dept1.dept1_id.toString())}
                                      >
                                        <div className="rounded-lg border bg-card/30">
                                          <CollapsibleTrigger className="flex w-full items-center justify-between p-2.5 hover:bg-accent/30">
                                            <div className="flex items-center gap-2">
                                              {expandedDept1[dept1.dept1_id.toString()] ? (
                                                <ChevronDown className="h-3.5 w-3.5" />
                                              ) : (
                                                <ChevronRight className="h-3.5 w-3.5" />
                                              )}
                                              <span className="font-medium text-xs">
                                                {dept1.dept_nivel1}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="text-right">
                                                <div className="text-[10px] text-muted-foreground">Quantidade</div>
                                                <div className="font-medium text-xs">
                                                  {formatQuantity(dept1.total_qtde)}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="text-[10px] text-muted-foreground">Valor Perda</div>
                                                <div className="font-medium text-xs">
                                                  {formatCurrency(dept1.total_valor)}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="text-[10px] text-muted-foreground">Venda Setor</div>
                                                <div className="font-medium text-xs">
                                                  {formatCurrency(dept1.venda_setor || 0)}
                                                </div>
                                              </div>
                                              <div className="text-right min-w-[45px]">
                                                <div className="text-[10px] text-muted-foreground">% Setor</div>
                                                <div className="font-medium text-xs">
                                                  {formatPercent(dept1.total_valor, dept1.venda_setor || 0)}
                                                </div>
                                              </div>
                                              <div className="text-right min-w-[45px]">
                                                <div className="text-[10px] text-muted-foreground">% Geral</div>
                                                <div className="font-medium text-xs">
                                                  {formatPercent(dept1.total_valor, totalVendasPeriodo)}
                                                </div>
                                              </div>
                                            </div>
                                          </CollapsibleTrigger>

                                          <CollapsibleContent>
                                            <div className="border-t">
                                              {dept1.produtos && dept1.produtos.length > 0 && (
                                                <ProdutoTable produtos={dept1.produtos} filtroProduto={filtroProduto} totalVendasPeriodo={totalVendasPeriodo} vendaSetor={dept1.venda_setor || 0} />
                                              )}
                                            </div>
                                          </CollapsibleContent>
                                        </div>
                                      </Collapsible>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Paginação */}
          {data.total_pages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                    const pageNum = i + 1
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                      className={page === data.total_pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Sem dados */}
      {!loading && data && (!data.hierarquia || data.hierarquia.length === 0) && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Newspaper className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum dado encontrado</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Não há perdas registradas para o período e filial selecionados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
