'use client'

import { useState, useEffect } from 'react'
import { useTenantContext } from '@/contexts/tenant-context'
import { useBranchesOptions } from '@/hooks/use-branches'
import { logModuleAccess } from '@/lib/audit'
import { PageHeader } from '@/components/dashboard/page-header'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { MultiSelect } from '@/components/ui/multi-select'
import { DepartmentFilterPopover, SectorFilterPopover } from '@/components/filters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertTriangle,
  Package,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react'

// Tipos para jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

// Interfaces
interface Produto {
  id: number
  descricao: string
  filial_id: number
  filial_nome: string
  departamento_id: number
  departamento_nome: string
  curva_abcd: string
  estoque_atual: number
  venda_media_diaria_60d: number
  dias_de_estoque: number
  previsao_ruptura: string
}

interface Departamento {
  departamento_id: number
  departamento_nome: string
  produtos: Produto[]
}

interface ReportData {
  total_records: number
  page: number
  page_size: number
  total_pages: number
  departamentos: Departamento[]
}

// Interface para agrupamento por setor
interface SetorAgrupado {
  setor_id: number
  setor_nome: string
  departamentos: Departamento[]
  total_produtos: number
}

interface Setor {
  id: number
  nome: string
  departamento_nivel: number
  departamento_ids: number[]
  departamento_ids_nivel_1: number[] // IDs de departamentos de nível 1 mapeados
  ativo: boolean
}

// Opções de curvas
const curvasOptions = [
  { value: 'A', label: 'Curva A' },
  { value: 'B', label: 'Curva B' },
  { value: 'C', label: 'Curva C' },
  { value: 'D', label: 'Curva D' },
]

export default function PrevisaoRupturaPage() {
  const { currentTenant, userProfile } = useTenantContext()
  const { options: filiaisOptions } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
    includeAll: false,
  })

  // Estados dos filtros
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<
    { value: string; label: string }[]
  >([])
  const [diasMin, setDiasMin] = useState('1')
  const [diasMax, setDiasMax] = useState('7')
  const [tipoBusca, setTipoBusca] = useState<'departamento' | 'setor' | 'produto'>('departamento')
  const [busca, setBusca] = useState('')

  // Estados para filtro de departamentos
  const [departamentosDisponiveis, setDepartamentosDisponiveis] = useState<
    { id: number; departamento_id: number; descricao: string }[]
  >([])
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(false)
  const [departamentosSelecionados, setDepartamentosSelecionados] = useState<number[]>([])

  // Estados para filtro de setores
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<Setor[]>([])
  const [loadingSetores, setLoadingSetores] = useState(false)
  const [setoresSelecionados, setSetoresSelecionados] = useState<number[]>([])
  const [curvasSelecionadas, setCurvasSelecionadas] = useState<
    { value: string; label: string }[]
  >([
    { value: 'A', label: 'Curva A' },
    { value: 'B', label: 'Curva B' },
    { value: 'C', label: 'Curva C' },
  ])
  const [page, setPage] = useState(1)

  // Estados de dados
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Estado para controle de expansão dos departamentos
  const [collapsedDepts, setCollapsedDepts] = useState<Set<number>>(new Set())

  // Estado para controle de expansão dos setores
  const [collapsedSetores, setCollapsedSetores] = useState<Set<number>>(new Set())

  const handleToggleDept = (deptId: number) => {
    setCollapsedDepts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(deptId)) {
        newSet.delete(deptId)
      } else {
        newSet.add(deptId)
      }
      return newSet
    })
  }

  const handleToggleSetor = (setorId: number) => {
    setCollapsedSetores((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(setorId)) {
        newSet.delete(setorId)
      } else {
        newSet.add(setorId)
      }
      return newSet
    })
  }

  // Função para agrupar dados por setor
  // Usa departamento_ids_nivel_1 que é o mapeamento correto dos departamentos de nível 1
  const agruparPorSetor = (
    departamentos: Departamento[],
    setores: Setor[],
    setoresSelecionadosIds: number[]
  ): SetorAgrupado[] => {
    // Filtrar apenas setores selecionados
    const setoresFiltrados = setores.filter((s) =>
      setoresSelecionadosIds.includes(s.id)
    )

    // Criar mapa de departamento_id (nível 1) para setor
    // Usa departamento_ids_nivel_1 que contém os IDs de nível 1 mapeados
    const deptToSetorMap = new Map<number, Setor>()
    setoresFiltrados.forEach((setor) => {
      // Usar departamento_ids_nivel_1 que é o array correto de departamentos nível 1
      const nivel1Ids = setor.departamento_ids_nivel_1 || []
      nivel1Ids.forEach((deptId) => {
        deptToSetorMap.set(deptId, setor)
      })
    })

    // Agrupar departamentos por setor
    const setorMap = new Map<number, SetorAgrupado>()

    departamentos.forEach((dept) => {
      // Encontrar o setor para este departamento usando o ID de nível 1
      const setor = deptToSetorMap.get(dept.departamento_id)

      if (setor) {
        if (!setorMap.has(setor.id)) {
          setorMap.set(setor.id, {
            setor_id: setor.id,
            setor_nome: setor.nome,
            departamentos: [],
            total_produtos: 0,
          })
        }
        const setorAgrupado = setorMap.get(setor.id)!
        setorAgrupado.departamentos.push(dept)
        setorAgrupado.total_produtos += dept.produtos.length
      }
    })

    // Converter para array e ordenar por nome do setor
    return Array.from(setorMap.values()).sort((a, b) =>
      a.setor_nome.localeCompare(b.setor_nome, 'pt-BR')
    )
  }

  // Dados agrupados por setor (computado quando necessário)
  const dadosAgrupadosPorSetor: SetorAgrupado[] =
    tipoBusca === 'setor' && data?.departamentos
      ? agruparPorSetor(data.departamentos, setoresDisponiveis, setoresSelecionados)
      : []

  // Log de acesso
  useEffect(() => {
    if (currentTenant && userProfile) {
      logModuleAccess({
        module: 'relatorios',
        subModule: 'previsao-ruptura',
        tenantId: currentTenant.id,
        userName: userProfile.full_name,
      })
    }
  }, [currentTenant, userProfile])

  // Carregar departamentos ao mudar tenant
  useEffect(() => {
    const loadDepartamentos = async () => {
      if (!currentTenant?.supabase_schema) return

      setLoadingDepartamentos(true)
      try {
        const response = await fetch(
          `/api/setores/departamentos?schema=${currentTenant.supabase_schema}&nivel=1`
        )
        const data = await response.json()
        // Ordenar alfabeticamente
        const sorted = [...data].sort((a: { descricao: string }, b: { descricao: string }) =>
          a.descricao.localeCompare(b.descricao, 'pt-BR')
        )
        setDepartamentosDisponiveis(sorted)
        // Selecionar todos por padrão
        setDepartamentosSelecionados(sorted.map((d: { departamento_id: number }) => d.departamento_id))
      } catch (error) {
        console.error('Erro ao carregar departamentos:', error)
      } finally {
        setLoadingDepartamentos(false)
      }
    }

    loadDepartamentos()
  }, [currentTenant?.supabase_schema])

  // Carregar setores ao mudar tenant (com mapeamento de departamentos nível 1)
  useEffect(() => {
    const loadSetores = async () => {
      if (!currentTenant?.supabase_schema) return

      setLoadingSetores(true)
      try {
        // Usar include_level1=true para obter departamento_ids_nivel_1 mapeados
        const response = await fetch(
          `/api/setores?schema=${currentTenant.supabase_schema}&include_level1=true`
        )
        const data = await response.json()
        // Filtrar apenas setores ativos e ordenar alfabeticamente
        const ativos = (data as Setor[])
          .filter((s) => s.ativo)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        setSetoresDisponiveis(ativos)
        // Selecionar todos por padrão
        setSetoresSelecionados(ativos.map((s) => s.id))
      } catch (error) {
        console.error('Erro ao carregar setores:', error)
      } finally {
        setLoadingSetores(false)
      }
    }

    loadSetores()
  }, [currentTenant?.supabase_schema])

  // Fetch dados
  const fetchData = async (resetPage = false) => {
    if (!currentTenant?.supabase_schema) return

    setLoading(true)
    setError(null)

    const currentPage = resetPage ? 1 : page
    if (resetPage) setPage(1)

    const params = new URLSearchParams({
      schema: currentTenant.supabase_schema,
      dias_min: diasMin || '1',
      dias_max: diasMax || '7',
      curvas: curvasSelecionadas.map((c) => c.value).join(',') || 'A,B,C',
      apenas_ativos: 'true',
      page: currentPage.toString(),
      page_size: '50',
    })

    if (filiaisSelecionadas.length > 0) {
      params.set('filial_ids', filiaisSelecionadas.map((f) => f.value).join(','))
    }

    // Filtrar por departamentos, setores OU busca por produto
    if (tipoBusca === 'departamento') {
      // Se não selecionou todos, envia os IDs selecionados
      if (
        departamentosSelecionados.length > 0 &&
        departamentosSelecionados.length < departamentosDisponiveis.length
      ) {
        params.set('departamento_ids', departamentosSelecionados.join(','))
      }
    } else if (tipoBusca === 'setor') {
      // Se não selecionou todos, envia os IDs de setores selecionados
      if (
        setoresSelecionados.length > 0 &&
        setoresSelecionados.length < setoresDisponiveis.length
      ) {
        params.set('setor_ids', setoresSelecionados.join(','))
      } else if (setoresSelecionados.length > 0) {
        // Se selecionou todos, envia todos os IDs para filtrar apenas produtos dos setores
        params.set('setor_ids', setoresSelecionados.join(','))
      }
    } else if (tipoBusca === 'produto' && busca.trim()) {
      params.set('busca', busca.trim())
      params.set('tipo_busca', 'produto')
    }

    try {
      const response = await fetch(`/api/relatorios/previsao-ruptura?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar dados')
      }

      setData(result)
    } catch (err) {
      const error = err as Error
      setError(error.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // Trigger inicial
  useEffect(() => {
    if (currentTenant?.supabase_schema) {
      fetchData(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.supabase_schema])

  // Trigger de paginação
  useEffect(() => {
    if (page > 1 && currentTenant?.supabase_schema) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Aplicar filtros
  const handleAplicarFiltros = () => {
    fetchData(true)
  }

  // Formatar moeda
  const formatNumber = (value: number, decimals = 2) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  // Badge de curva
  const getCurvaBadge = (curva: string) => {
    const config: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      A: 'destructive',
      B: 'default',
      C: 'secondary',
      D: 'outline',
    }
    return <Badge variant={config[curva] || 'outline'}>{curva}</Badge>
  }

  // Exportar PDF
  const handleExportPDF = async () => {
    if (!currentTenant?.supabase_schema) return

    setExporting(true)
    try {
      // Importação dinâmica para reduzir bundle inicial
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      // Buscar todos os dados
      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        dias_min: diasMin || '1',
        dias_max: diasMax || '7',
        curvas: curvasSelecionadas.map((c) => c.value).join(',') || 'A,B,C',
        apenas_ativos: 'true',
        page: '1',
        page_size: '10000',
      })

      if (filiaisSelecionadas.length > 0) {
        params.set('filial_ids', filiaisSelecionadas.map((f) => f.value).join(','))
      }

      // Filtrar por departamentos, setores OU busca por produto
      if (tipoBusca === 'departamento') {
        if (
          departamentosSelecionados.length > 0 &&
          departamentosSelecionados.length < departamentosDisponiveis.length
        ) {
          params.set('departamento_ids', departamentosSelecionados.join(','))
        }
      } else if (tipoBusca === 'setor') {
        if (
          setoresSelecionados.length > 0 &&
          setoresSelecionados.length < setoresDisponiveis.length
        ) {
          params.set('setor_ids', setoresSelecionados.join(','))
        } else if (setoresSelecionados.length > 0) {
          params.set('setor_ids', setoresSelecionados.join(','))
        }
      } else if (tipoBusca === 'produto' && busca.trim()) {
        params.set('busca', busca.trim())
        params.set('tipo_busca', 'produto')
      }

      const response = await fetch(`/api/relatorios/previsao-ruptura?${params}`)
      const allData: ReportData = await response.json()

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      // Título
      doc.setFontSize(16)
      doc.text('Previsão de Ruptura', doc.internal.pageSize.width / 2, 15, {
        align: 'center',
      })

      doc.setFontSize(10)
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 25)
      doc.text(`Dias para Ruptura: ${diasMin} a ${diasMax} dias`, 14, 30)
      doc.text(`Total de Produtos: ${allData.total_records}`, 14, 35)

      /* eslint-disable @typescript-eslint/no-explicit-any */

      // Se filtro por setor, organizar hierarquicamente
      if (tipoBusca === 'setor') {
        // Agrupar por setor para PDF
        const setoresAgrupados = agruparPorSetor(
          allData.departamentos,
          setoresDisponiveis,
          setoresSelecionados
        )

        // Largura útil da página (A4 landscape = 297mm, margem 10mm cada lado)
        const pageWidth = doc.internal.pageSize.width
        const marginLeft = 10
        const marginRight = 10
        const contentWidth = pageWidth - marginLeft - marginRight

        let startY = 45

        setoresAgrupados.forEach((setor, setorIndex) => {
          // Verificar se precisa de nova página
          if (startY > doc.internal.pageSize.height - 50) {
            doc.addPage()
            startY = 20
          }

          // Título do Setor (em linha separada)
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(59, 130, 246) // Cor primary (azul)
          doc.text(setor.setor_nome, marginLeft, startY)

          // Subtítulo do setor (nova linha)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 100, 100) // Cinza
          doc.text(
            `(${setor.departamentos.length} departamentos, ${setor.total_produtos} produtos)`,
            marginLeft,
            startY + 4
          )
          doc.setTextColor(0, 0, 0) // Volta para preto
          startY += 10

          // Iterar pelos departamentos do setor
          setor.departamentos
            .sort((a, b) => a.departamento_nome.localeCompare(b.departamento_nome, 'pt-BR'))
            .forEach((dept) => {
              // Verificar se precisa de nova página
              if (startY > doc.internal.pageSize.height - 35) {
                doc.addPage()
                startY = 20
              }

              // Título do Departamento (em linha separada)
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(60, 60, 60)
              doc.text(dept.departamento_nome, marginLeft + 4, startY)

              // Contador de produtos
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(8)
              doc.setTextColor(120, 120, 120)
              doc.text(` (${dept.produtos.length} produtos)`, marginLeft + 4, startY + 3.5)
              doc.setTextColor(0, 0, 0)
              startY += 7

              // Tabela do departamento - ocupando toda a largura
              const tableData = dept.produtos.map((p) => [
                p.id,
                p.descricao.substring(0, 50),
                p.filial_nome || '-',
                p.curva_abcd,
                formatNumber(p.estoque_atual, 0),
                formatNumber(p.venda_media_diaria_60d, 2),
                formatNumber(p.dias_de_estoque, 1),
                formatDate(p.previsao_ruptura),
              ])

              autoTable(doc as any, {
                head: [['Código', 'Descrição', 'Filial', 'Curva', 'Estoque', 'Venda/Dia', 'Dias', 'Previsão']],
                body: tableData as any,
                startY: startY,
                tableWidth: contentWidth - 8, // Largura total menos indentação
                styles: { fontSize: 7, cellPadding: 1.5 },
                headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                  0: { cellWidth: 22 },  // Código
                  1: { cellWidth: 'auto' },  // Descrição - expande automaticamente
                  2: { cellWidth: 35 },  // Filial
                  3: { cellWidth: 18, halign: 'center' },  // Curva
                  4: { cellWidth: 25, halign: 'right' },  // Estoque
                  5: { cellWidth: 28, halign: 'right' },  // Venda/Dia
                  6: { cellWidth: 20, halign: 'right' },  // Dias
                  7: { cellWidth: 28, halign: 'center' },  // Previsão
                },
                margin: { left: marginLeft + 4, right: marginRight },
              })

              startY = doc.lastAutoTable.finalY + 6
            })

          // Separador entre setores
          if (setorIndex < setoresAgrupados.length - 1) {
            startY += 4
          }
        })

        // Adicionar número de páginas
        const pageCount = doc.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i)
          doc.setFontSize(8)
          doc.text(
            `Página ${i} de ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          )
        }
      } else {
        // Layout padrão - por departamento
        const allProdutos = allData.departamentos.flatMap((dept) =>
          dept.produtos.map((p) => ({
            ...p,
            departamento_nome: dept.departamento_nome,
          }))
        )

        const tableData = allProdutos.map((p) => [
          p.departamento_nome.substring(0, 25),
          p.id,
          p.descricao.substring(0, 40),
          p.filial_nome || '-',
          p.curva_abcd,
          formatNumber(p.estoque_atual, 0),
          formatNumber(p.venda_media_diaria_60d, 2),
          formatNumber(p.dias_de_estoque, 1),
          formatDate(p.previsao_ruptura),
        ])

        autoTable(doc as any, {
          head: [
            [
              'Departamento',
              'Código',
              'Descrição',
              'Filial',
              'Curva',
              'Estoque',
              'Venda/Dia',
              'Dias',
              'Previsão',
            ],
          ],
          body: tableData as any,
          startY: 40,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 18 },
            2: { cellWidth: 55 },
            3: { cellWidth: 28 },
            4: { cellWidth: 14, halign: 'center' },
            5: { cellWidth: 20, halign: 'right' },
            6: { cellWidth: 20, halign: 'right' },
            7: { cellWidth: 16, halign: 'right' },
            8: { cellWidth: 24, halign: 'center' },
          },
          margin: { top: 40, left: 14, right: 14 },
          didDrawPage: (hookData) => {
            const pageCount = doc.getNumberOfPages()
            doc.setFontSize(8)
            doc.text(
              `Página ${hookData.pageNumber} de ${pageCount}`,
              doc.internal.pageSize.width / 2,
              doc.internal.pageSize.height - 10,
              { align: 'center' }
            )
          },
        })
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */

      doc.save(`previsao-ruptura-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      alert('Erro ao exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  // Exportar Excel
  const handleExportExcel = async () => {
    if (!currentTenant?.supabase_schema) return

    setExporting(true)
    try {
      const ExcelJS = await import('exceljs')

      // Buscar todos os dados
      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        dias_min: diasMin || '1',
        dias_max: diasMax || '7',
        curvas: curvasSelecionadas.map((c) => c.value).join(',') || 'A,B,C',
        apenas_ativos: 'true',
        page: '1',
        page_size: '10000',
      })

      if (filiaisSelecionadas.length > 0) {
        params.set('filial_ids', filiaisSelecionadas.map((f) => f.value).join(','))
      }

      // Filtrar por departamentos, setores OU busca por produto
      if (tipoBusca === 'departamento') {
        if (
          departamentosSelecionados.length > 0 &&
          departamentosSelecionados.length < departamentosDisponiveis.length
        ) {
          params.set('departamento_ids', departamentosSelecionados.join(','))
        }
      } else if (tipoBusca === 'setor') {
        if (
          setoresSelecionados.length > 0 &&
          setoresSelecionados.length < setoresDisponiveis.length
        ) {
          params.set('setor_ids', setoresSelecionados.join(','))
        } else if (setoresSelecionados.length > 0) {
          params.set('setor_ids', setoresSelecionados.join(','))
        }
      } else if (tipoBusca === 'produto' && busca.trim()) {
        params.set('busca', busca.trim())
        params.set('tipo_busca', 'produto')
      }

      const response = await fetch(`/api/relatorios/previsao-ruptura?${params}`)
      const allData: ReportData = await response.json()

      const workbook = new ExcelJS.Workbook()

      // Se filtro por setor, organizar hierarquicamente com coluna Setor
      if (tipoBusca === 'setor') {
        // Agrupar por setor para Excel
        const setoresAgrupados = agruparPorSetor(
          allData.departamentos,
          setoresDisponiveis,
          setoresSelecionados
        )

        // Criar rows com hierarquia Setor > Departamento > Produto
        const rows: {
          Setor: string
          Departamento: string
          Código: number
          Descrição: string
          Filial: string
          Curva: string
          'Estoque Atual': number
          'Venda Média/Dia': number
          'Dias de Estoque': number
          'Previsão Ruptura': string
        }[] = []

        setoresAgrupados.forEach((setor) => {
          setor.departamentos
            .sort((a, b) => a.departamento_nome.localeCompare(b.departamento_nome, 'pt-BR'))
            .forEach((dept) => {
              dept.produtos.forEach((p) => {
                rows.push({
                  Setor: setor.setor_nome,
                  Departamento: dept.departamento_nome,
                  Código: p.id,
                  Descrição: p.descricao,
                  Filial: p.filial_nome || '-',
                  Curva: p.curva_abcd,
                  'Estoque Atual': p.estoque_atual,
                  'Venda Média/Dia': p.venda_media_diaria_60d,
                  'Dias de Estoque': p.dias_de_estoque,
                  'Previsão Ruptura': p.previsao_ruptura,
                })
              })
            })
        })

        const worksheet = workbook.addWorksheet('Previsão por Setor')

        // Add headers from first row keys
        if (rows.length > 0) {
          worksheet.columns = Object.keys(rows[0]).map(key => ({
            header: key,
            key: key,
            width: key === 'Descrição' ? 45 :
                   key === 'Setor' || key === 'Departamento' ? 25 :
                   key === 'Filial' ? 15 :
                   key === 'Venda Média/Dia' || key === 'Dias de Estoque' || key === 'Previsão Ruptura' ? 14 :
                   key === 'Estoque Atual' ? 12 :
                   key === 'Código' ? 10 :
                   key === 'Curva' ? 8 : 15
          }))
          worksheet.addRows(rows)
        }
      } else {
        // Layout padrão - por departamento
        const allProdutos = allData.departamentos.flatMap((dept) =>
          dept.produtos.map((p) => ({
            ...p,
            departamento_nome: dept.departamento_nome,
          }))
        )

        const rows = allProdutos.map((p) => ({
          Departamento: p.departamento_nome,
          Código: p.id,
          Descrição: p.descricao,
          Filial: p.filial_nome || '-',
          Curva: p.curva_abcd,
          'Estoque Atual': p.estoque_atual,
          'Venda Média/Dia': p.venda_media_diaria_60d,
          'Dias de Estoque': p.dias_de_estoque,
          'Previsão Ruptura': p.previsao_ruptura,
        }))

        const worksheet = workbook.addWorksheet('Previsão Ruptura')

        // Add headers from first row keys
        if (rows.length > 0) {
          worksheet.columns = Object.keys(rows[0]).map(key => ({
            header: key,
            key: key,
            width: key === 'Descrição' ? 45 :
                   key === 'Departamento' ? 25 :
                   key === 'Filial' ? 15 :
                   key === 'Venda Média/Dia' || key === 'Dias de Estoque' || key === 'Previsão Ruptura' ? 14 :
                   key === 'Estoque Atual' ? 12 :
                   key === 'Código' ? 10 :
                   key === 'Curva' ? 8 : 15
          }))
          worksheet.addRows(rows)
        }
      }

      // Download file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `previsao-ruptura-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
      alert('Erro ao exportar Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Ruptura"
        title="Previsão de Ruptura"
        description="Previsão de produtos que entrarão em ruptura baseado no histórico de vendas"
        icon={TrendingDown}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Primeira linha: Filiais e Curvas */}
            <div className="flex flex-col gap-4 lg:flex-row lg:gap-4">
              {/* Filiais */}
              <div className="flex flex-col gap-2 flex-1">
                <Label>Filiais</Label>
                <div className="h-10">
                  <MultiSelect
                    options={filiaisOptions}
                    value={filiaisSelecionadas}
                    onValueChange={setFiliaisSelecionadas}
                    placeholder="Todas as filiais"
                    className="w-full h-10"
                  />
                </div>
              </div>

              {/* Curvas */}
              <div className="flex flex-col gap-2 flex-1">
                <Label>Curvas ABCD</Label>
                <div className="h-10">
                  <MultiSelect
                    options={curvasOptions}
                    value={curvasSelecionadas}
                    onValueChange={setCurvasSelecionadas}
                    placeholder="Selecione..."
                    className="w-full h-10"
                  />
                </div>
              </div>
            </div>

            {/* Segunda linha: Dias para Ruptura (Min/Max), Busca e Botão */}
            <div className="flex flex-col gap-4 lg:flex-row lg:gap-4">
              {/* Dias para Ruptura - Min */}
              <div className="flex flex-col gap-2 w-full lg:w-[120px]">
                <Label>Dias Min</Label>
                <div className="h-10">
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={diasMin}
                    onChange={(e) => setDiasMin(e.target.value)}
                    placeholder="1"
                    className="w-full h-10"
                  />
                </div>
              </div>

              {/* Dias para Ruptura - Max */}
              <div className="flex flex-col gap-2 w-full lg:w-[120px]">
                <Label>Dias Max</Label>
                <div className="h-10">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={diasMax}
                    onChange={(e) => setDiasMax(e.target.value)}
                    placeholder="7"
                    className="w-full h-10"
                  />
                </div>
              </div>

              {/* Filtrar por */}
              <div className="flex flex-col gap-2 w-full lg:w-[180px]">
                <Label>Filtrar por</Label>
                <div className="h-10">
                  <Select
                    value={tipoBusca}
                    onValueChange={(value: 'departamento' | 'setor' | 'produto') => setTipoBusca(value)}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="departamento">Departamentos</SelectItem>
                      <SelectItem value="setor">Setores</SelectItem>
                      <SelectItem value="produto">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Condicional: Popover de Departamentos, Setores OU Campo de Busca */}
              {tipoBusca === 'departamento' && (
                <div className="flex flex-col gap-2 flex-1">
                  <Label>Departamentos</Label>
                  <div className="h-10">
                    <DepartmentFilterPopover
                      departamentos={departamentosDisponiveis}
                      selectedIds={departamentosSelecionados}
                      onChange={setDepartamentosSelecionados}
                      disabled={loading}
                      loading={loadingDepartamentos}
                    />
                  </div>
                </div>
              )}
              {tipoBusca === 'setor' && (
                <div className="flex flex-col gap-2 flex-1">
                  <Label>Setores</Label>
                  <div className="h-10">
                    <SectorFilterPopover
                      setores={setoresDisponiveis}
                      selectedIds={setoresSelecionados}
                      onChange={setSetoresSelecionados}
                      disabled={loading}
                      loading={loadingSetores}
                    />
                  </div>
                </div>
              )}
              {tipoBusca === 'produto' && (
                <div className="flex flex-col gap-2 flex-1">
                  <Label>Nome do Produto</Label>
                  <div className="relative h-10">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite o nome do produto..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-8 w-full h-10"
                    />
                  </div>
                </div>
              )}

              {/* Botão Aplicar */}
              <div className="flex flex-col gap-2 w-full lg:w-auto lg:self-end">
                <Button
                  onClick={handleAplicarFiltros}
                  disabled={loading}
                  className="w-full lg:w-auto h-10"
                >
                  {loading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TrendingDown className="mr-2 h-4 w-4" />
                  )}
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Produtos em Risco de Ruptura</CardTitle>
            <CardDescription>
              {data
                ? `${data.total_records} produtos encontrados`
                : 'Aplique os filtros para ver os resultados'}
            </CardDescription>
          </div>
          {data && data.total_records > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={handleExportExcel}
                disabled={exporting}
                variant="outline"
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button
                onClick={handleExportPDF}
                disabled={exporting}
                variant="outline"
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-semibold">Erro ao carregar dados</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : !data || data.departamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold">Nenhum produto encontrado</p>
              <p className="text-muted-foreground">
                Ajuste os filtros para ver resultados
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Layout hierárquico quando filtrar por Setor */}
                {tipoBusca === 'setor' && dadosAgrupadosPorSetor.length > 0 ? (
                  dadosAgrupadosPorSetor.map((setor) => (
                    <Collapsible
                      key={setor.setor_id}
                      open={!collapsedSetores.has(setor.setor_id)}
                      onOpenChange={() => handleToggleSetor(setor.setor_id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="cursor-pointer hover:bg-primary/10 transition-colors border-2 border-primary/30 rounded-lg p-4 mb-2 bg-primary/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {collapsedSetores.has(setor.setor_id) ? (
                                <ChevronRight className="h-5 w-5 text-primary" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-primary" />
                              )}
                              <h2 className="font-bold text-lg text-primary">{setor.setor_nome}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-primary/50">
                                {setor.departamentos.length} {setor.departamentos.length === 1 ? 'departamento' : 'departamentos'}
                              </Badge>
                              <Badge variant="secondary">
                                {setor.total_produtos} {setor.total_produtos === 1 ? 'produto' : 'produtos'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="ml-4 space-y-2">
                          {setor.departamentos
                            .sort((a, b) => a.departamento_nome.localeCompare(b.departamento_nome, 'pt-BR'))
                            .map((dept) => (
                            <Collapsible
                              key={`${setor.setor_id}-${dept.departamento_id}`}
                              open={!collapsedDepts.has(dept.departamento_id)}
                              onOpenChange={() => handleToggleDept(dept.departamento_id)}
                            >
                              <CollapsibleTrigger asChild>
                                <div className="cursor-pointer hover:bg-accent/50 transition-colors border rounded-lg p-3 mb-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {collapsedDepts.has(dept.departamento_id) ? (
                                        <ChevronRight className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                      <h3 className="font-semibold">{dept.departamento_nome}</h3>
                                    </div>
                                    <Badge variant="secondary">
                                      {dept.produtos.length} {dept.produtos.length === 1 ? 'produto' : 'produtos'}
                                    </Badge>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="rounded-md border mb-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[80px]">Código</TableHead>
                                        <TableHead className="min-w-[200px]">Descrição</TableHead>
                                        <TableHead className="w-[120px]">Filial</TableHead>
                                        <TableHead className="text-center w-[70px]">Curva</TableHead>
                                        <TableHead className="text-right w-[90px]">Estoque</TableHead>
                                        <TableHead className="text-right w-[90px]">Venda/Dia</TableHead>
                                        <TableHead className="text-right w-[70px]">Dias</TableHead>
                                        <TableHead className="text-center w-[100px]">Previsão</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {dept.produtos.map((produto) => (
                                        <TableRow key={`${produto.id}-${produto.filial_id}`}>
                                          <TableCell className="font-mono text-sm w-[80px]">
                                            {produto.id}
                                          </TableCell>
                                          <TableCell className="min-w-[200px]">
                                            <div className="truncate" title={produto.descricao}>
                                              {produto.descricao}
                                            </div>
                                          </TableCell>
                                          <TableCell className="w-[120px]">
                                            {produto.filial_nome || '-'}
                                          </TableCell>
                                          <TableCell className="text-center w-[70px]">
                                            {getCurvaBadge(produto.curva_abcd)}
                                          </TableCell>
                                          <TableCell className="text-right w-[90px]">
                                            {formatNumber(produto.estoque_atual, 0)}
                                          </TableCell>
                                          <TableCell className="text-right w-[90px]">
                                            {formatNumber(produto.venda_media_diaria_60d, 2)}
                                          </TableCell>
                                          <TableCell className="text-right w-[70px]">
                                            {formatNumber(produto.dias_de_estoque, 1)}
                                          </TableCell>
                                          <TableCell className="text-center w-[100px]">
                                            {formatDate(produto.previsao_ruptura)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                ) : (
                  /* Layout padrão por Departamento */
                  data.departamentos.map((dept) => (
                    <Collapsible
                      key={dept.departamento_id}
                      open={!collapsedDepts.has(dept.departamento_id)}
                      onOpenChange={() => handleToggleDept(dept.departamento_id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="cursor-pointer hover:bg-accent/50 transition-colors border rounded-lg p-4 mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {collapsedDepts.has(dept.departamento_id) ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <h3 className="font-semibold">{dept.departamento_nome}</h3>
                            </div>
                            <Badge variant="secondary">
                              {dept.produtos.length} {dept.produtos.length === 1 ? 'produto' : 'produtos'}
                            </Badge>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="rounded-md border mb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[80px]">Código</TableHead>
                                <TableHead className="min-w-[200px]">Descrição</TableHead>
                                <TableHead className="w-[120px]">Filial</TableHead>
                                <TableHead className="text-center w-[70px]">Curva</TableHead>
                                <TableHead className="text-right w-[90px]">Estoque</TableHead>
                                <TableHead className="text-right w-[90px]">Venda/Dia</TableHead>
                                <TableHead className="text-right w-[70px]">Dias</TableHead>
                                <TableHead className="text-center w-[100px]">Previsão</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dept.produtos.map((produto) => (
                                <TableRow key={`${produto.id}-${produto.filial_id}`}>
                                  <TableCell className="font-mono text-sm w-[80px]">
                                    {produto.id}
                                  </TableCell>
                                  <TableCell className="min-w-[200px]">
                                    <div className="truncate" title={produto.descricao}>
                                      {produto.descricao}
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-[120px]">
                                    {produto.filial_nome || '-'}
                                  </TableCell>
                                  <TableCell className="text-center w-[70px]">
                                    {getCurvaBadge(produto.curva_abcd)}
                                  </TableCell>
                                  <TableCell className="text-right w-[90px]">
                                    {formatNumber(produto.estoque_atual, 0)}
                                  </TableCell>
                                  <TableCell className="text-right w-[90px]">
                                    {formatNumber(produto.venda_media_diaria_60d, 2)}
                                  </TableCell>
                                  <TableCell className="text-right w-[70px]">
                                    {formatNumber(produto.dias_de_estoque, 1)}
                                  </TableCell>
                                  <TableCell className="text-center w-[100px]">
                                    {formatDate(produto.previsao_ruptura)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
              </div>

              {/* Paginação */}
              {data.total_pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {data.page} de {data.total_pages} • {data.total_records}{' '}
                    registros
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={
                            page === 1
                              ? 'pointer-events-none opacity-50'
                              : 'cursor-pointer'
                          }
                        />
                      </PaginationItem>

                      {[...Array(Math.min(5, data.total_pages))].map((_, i) => {
                        let pageNum: number
                        if (data.total_pages <= 5) {
                          pageNum = i + 1
                        } else if (page <= 3) {
                          pageNum = i + 1
                        } else if (page >= data.total_pages - 2) {
                          pageNum = data.total_pages - 4 + i
                        } else {
                          pageNum = page - 2 + i
                        }

                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setPage(pageNum)}
                              isActive={pageNum === page}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setPage((p) => Math.min(data.total_pages, p + 1))
                          }
                          className={
                            page === data.total_pages
                              ? 'pointer-events-none opacity-50'
                              : 'cursor-pointer'
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
