'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { MultiSelect } from '@/components/ui/multi-select'
import { DepartmentFilterPopover, SectorFilterPopover } from '@/components/filters'
import { ChevronDown, ChevronRight, Package, AlertTriangle, FileDown, FileSpreadsheet, Search } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'
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
  produto_id: number
  filial_id: number
  filial_nome?: string
  produto_descricao: string
  curva_venda: string
  estoque_atual: number
  dias_com_venda_60d: number
  dias_com_venda_ultimos_3d: number
  venda_media_diaria_60d: number
  valor_estoque_parado: number
  nivel_ruptura: 'CRÍTICO' | 'ALTO' | 'MÉDIO' | 'BAIXO' | 'NORMAL'
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
  departamento_ids_nivel_1: number[]
  ativo: boolean
}

export default function RupturaVenda60dPage() {
  const { currentTenant, userProfile } = useTenantContext()
  const { options: filiaisOptions } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
  })

  // Estados dos filtros
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<{ value: string; label: string }[]>([])
  const [diasMinimos, setDiasMinimos] = useState<string>('20')
  const [curvasSelecionadas, setCurvasSelecionadas] = useState<{ value: string; label: string }[]>([
    { value: 'A', label: 'Curva A' },
    { value: 'B', label: 'Curva B' },
    { value: 'C', label: 'Curva C' },
  ])
  const [tipoBusca, setTipoBusca] = useState<'departamento' | 'setor' | 'produto'>('departamento')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)

  // Opções de filtros
  const diasMinimosOptions = [
    { value: '10', label: '≥ 10 dias' },
    { value: '20', label: '≥ 20 dias' },
    { value: '30', label: '≥ 30 dias' },
    { value: '40', label: '≥ 40 dias' },
    { value: '50', label: '≥ 50 dias' },
  ]

  const curvasOptions = [
    { value: 'A', label: 'Curva A' },
    { value: 'B', label: 'Curva B' },
    { value: 'C', label: 'Curva C' },
    { value: 'D', label: 'Curva D' },
  ]

  // Estados dos dados
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Estados para filtro de departamentos
  const [departamentosDisponiveis, setDepartamentosDisponiveis] = useState<
    { id: number; departamento_id: number; descricao: string }[]
  >([])
  const [departamentosSelecionados, setDepartamentosSelecionados] = useState<number[]>([])
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(false)

  // Estados para filtro de setores
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<Setor[]>([])
  const [setoresSelecionados, setSetoresSelecionados] = useState<number[]>([])
  const [loadingSetores, setLoadingSetores] = useState(false)

  // Estados de colapso
  const [collapsedDepts, setCollapsedDepts] = useState<Set<number>>(new Set())
  const [collapsedSetores, setCollapsedSetores] = useState<Set<number>>(new Set())

  // Log de acesso ao módulo
  useEffect(() => {
    if (currentTenant?.id && userProfile?.id) {
      logModuleAccess({
        module: 'relatorios',
        subModule: 'ruptura_venda_60d',
        tenantId: currentTenant.id,
        userName: userProfile.full_name || 'Usuário',
        userEmail: userProfile.id
      })
    }
  }, [currentTenant?.id, userProfile?.id, userProfile?.full_name])

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

  const agruparPorSetor = (
    departamentos: Departamento[],
    setores: Setor[],
    setoresSelecionadosIds: number[]
  ): SetorAgrupado[] => {
    const setoresFiltrados = setores.filter((s) =>
      setoresSelecionadosIds.includes(s.id)
    )

    const deptToSetorMap = new Map<number, Setor>()
    setoresFiltrados.forEach((setor) => {
      const nivel1Ids = setor.departamento_ids_nivel_1 || []
      nivel1Ids.forEach((deptId) => {
        deptToSetorMap.set(deptId, setor)
      })
    })

    const setorMap = new Map<number, SetorAgrupado>()

    departamentos.forEach((dept) => {
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

    return Array.from(setorMap.values()).sort((a, b) =>
      a.setor_nome.localeCompare(b.setor_nome, 'pt-BR')
    )
  }

  const dadosAgrupadosPorSetor: SetorAgrupado[] =
    tipoBusca === 'setor' && data?.departamentos
      ? agruparPorSetor(data.departamentos, setoresDisponiveis, setoresSelecionados)
      : []

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
        const sorted = [...data].sort((a: { descricao: string }, b: { descricao: string }) =>
          a.descricao.localeCompare(b.descricao, 'pt-BR')
        )
        setDepartamentosDisponiveis(sorted)
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
        const response = await fetch(
          `/api/setores?schema=${currentTenant.supabase_schema}&include_level1=true`
        )
        const data = await response.json()
        const ativos = (data as Setor[])
          .filter((s) => s.ativo)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        setSetoresDisponiveis(ativos)
        setSetoresSelecionados(ativos.map((s) => s.id))
      } catch (error) {
        console.error('Erro ao carregar setores:', error)
      } finally {
        setLoadingSetores(false)
      }
    }

    loadSetores()
  }, [currentTenant?.supabase_schema])

  const fetchData = async (resetPage = false) => {
    if (!currentTenant?.supabase_schema) return

    setLoading(true)
    setError(null)

    const nextPage = resetPage ? 1 : page
    if (resetPage) {
      setPage(1)
    }

    try {
      const filiais = filiaisSelecionadas.length > 0
        ? filiaisSelecionadas.map(f => parseInt(f.value))
        : null

      const curvas = curvasSelecionadas.length > 0
        ? curvasSelecionadas.map(c => c.value)
        : null

      const departamentoIds =
        tipoBusca === 'departamento' &&
        departamentosSelecionados.length > 0 &&
        departamentosSelecionados.length < departamentosDisponiveis.length
          ? departamentosSelecionados
          : null

      const setorIds =
        tipoBusca === 'setor'
          ? setoresSelecionados.length > 0
            ? setoresSelecionados
            : null
          : null

      const buscaProduto = tipoBusca === 'produto' && busca.trim()
        ? busca.trim()
        : null

      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error: rpcError } = await (supabase.rpc as any)('get_ruptura_venda_60d_report', {
        schema_name: currentTenant.supabase_schema,
        p_filiais: filiais,
        p_limite_minimo_dias: parseInt(diasMinimos),
        p_curvas: curvas,
        p_page: nextPage,
        p_page_size: 50,
        p_departamento_ids: departamentoIds,
        p_setor_ids: setorIds,
        p_busca: buscaProduto
      })

      if (rpcError) {
        console.error('[Ruptura 60d] Erro RPC:', rpcError)
        throw rpcError
      }

      if (result && result.length > 0) {
        const row = result[0]
        setData({
          total_records: row.total_records || 0,
          page: row.page || 1,
          page_size: row.page_size || 50,
          total_pages: row.total_pages || 1,
          departamentos: row.departamentos || []
        })
      } else {
        setData({
          total_records: 0,
          page: 1,
          page_size: 50,
          total_pages: 1,
          departamentos: []
        })
      }
    } catch (err) {
      console.error('[Ruptura 60d] Erro ao buscar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const handleAplicarFiltros = async () => {
    await fetchData(true)
  }

  useEffect(() => {
    if (currentTenant?.supabase_schema) {
      fetchData(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.supabase_schema])

  useEffect(() => {
    if (page > 1 && currentTenant?.supabase_schema) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Função para formatar números
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Exportar PDF
  const handleExportPDF = async () => {
    if (!currentTenant?.supabase_schema) return

    setExporting(true)
    try {
      // Importação dinâmica para reduzir bundle inicial
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      // Buscar todos os dados para exportação
      const supabase = createClient()
      const filiais = filiaisSelecionadas.length > 0
        ? filiaisSelecionadas.map(f => parseInt(f.value))
        : null
      const curvas = curvasSelecionadas.length > 0
        ? curvasSelecionadas.map(c => c.value)
        : null
      const departamentoIds =
        tipoBusca === 'departamento' &&
        departamentosSelecionados.length > 0 &&
        departamentosSelecionados.length < departamentosDisponiveis.length
          ? departamentosSelecionados
          : null
      const setorIds =
        tipoBusca === 'setor'
          ? setoresSelecionados.length > 0
            ? setoresSelecionados
            : null
          : null
      const buscaProduto = tipoBusca === 'produto' && busca.trim()
        ? busca.trim()
        : null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allData } = await (supabase.rpc as any)('get_ruptura_venda_60d_report', {
        schema_name: currentTenant.supabase_schema,
        p_filiais: filiais,
        p_limite_minimo_dias: parseInt(diasMinimos),
        p_curvas: curvas,
        p_page: 1,
        p_page_size: 10000,
        p_departamento_ids: departamentoIds,
        p_setor_ids: setorIds,
        p_busca: buscaProduto
      })

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      // Título centralizado
      doc.setFontSize(16)
      doc.text('Ruptura Vendas - Dias sem Giro', doc.internal.pageSize.width / 2, 15, {
        align: 'center',
      })

      // Informações do filtro
      doc.setFontSize(10)
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 25)
      doc.text(`Dias mínimos: >= ${diasMinimos}`, 14, 30)
      doc.text(`Curvas: ${curvasSelecionadas.map((c) => c.value).join(', ') || 'Todas'}`, 14, 35)
      doc.text(`Total de Produtos: ${allData?.[0]?.total_records || 0}`, 14, 40)

      /* eslint-disable @typescript-eslint/no-explicit-any */

      if (allData && allData.length > 0 && allData[0].departamentos) {
        const departamentos = allData[0].departamentos

        const pageWidth = doc.internal.pageSize.width
        const marginLeft = 10
        const marginRight = 10
        const contentWidth = pageWidth - marginLeft - marginRight

        if (tipoBusca === 'setor') {
          const setoresAgrupados = agruparPorSetor(
            departamentos,
            setoresDisponiveis,
            setoresSelecionados
          )

          let startY = 45

          setoresAgrupados.forEach((setor, setorIndex) => {
            if (startY > doc.internal.pageSize.height - 50) {
              doc.addPage()
              startY = 20
            }

            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(59, 130, 246)
            doc.text(setor.setor_nome, marginLeft, startY)

            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(100, 100, 100)
            doc.text(
              `(${setor.departamentos.length} departamentos, ${setor.total_produtos} produtos)`,
              marginLeft,
              startY + 4
            )
            doc.setTextColor(0, 0, 0)
            startY += 10

            setor.departamentos
              .sort((a, b) => a.departamento_nome.localeCompare(b.departamento_nome, 'pt-BR'))
              .forEach((dept) => {
                if (startY > doc.internal.pageSize.height - 35) {
                  doc.addPage()
                  startY = 20
                }

                doc.setFontSize(9)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(60, 60, 60)
                doc.text(dept.departamento_nome, marginLeft + 4, startY)

                doc.setFont('helvetica', 'normal')
                doc.setFontSize(8)
                doc.setTextColor(120, 120, 120)
                doc.text(` (${dept.produtos.length} produtos)`, marginLeft + 4, startY + 3.5)
                doc.setTextColor(0, 0, 0)
                startY += 7

                const tableData = dept.produtos.map((p: Produto) => [
                  p.filial_nome || String(p.filial_id),
                  p.produto_id,
                  p.produto_descricao.substring(0, 50),
                  formatNumber(p.estoque_atual),
                  p.curva_venda,
                  `${p.dias_com_venda_60d}d`,
                  formatNumber(p.venda_media_diaria_60d),
                  formatNumber(p.valor_estoque_parado),
                  p.nivel_ruptura
                ])

                autoTable(doc as any, {
                  head: [['Filial', 'Código', 'Descrição', 'Estoque', 'Curva', 'Freq. Giro', 'Giro Médio', 'Valor Parado', 'Nível']],
                  body: tableData as any,
                  startY: startY,
                  tableWidth: contentWidth - 8,
                  styles: { fontSize: 7, cellPadding: 1.5 },
                  headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold' },
                  columnStyles: {
                    0: { cellWidth: 28 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 20, halign: 'right' },
                    4: { cellWidth: 14, halign: 'center' },
                    5: { cellWidth: 18, halign: 'center' },
                    6: { cellWidth: 20, halign: 'right' },
                    7: { cellWidth: 24, halign: 'right' },
                    8: { cellWidth: 18, halign: 'center' },
                  },
                  margin: { left: marginLeft + 4, right: marginRight },
                })

                startY = doc.lastAutoTable.finalY + 6
              })

            if (setorIndex < setoresAgrupados.length - 1) {
              startY += 4
            }
          })
        } else {
          const allProdutos = departamentos.flatMap((dept: Departamento) =>
            dept.produtos.map((p) => ({
              ...p,
              departamento_nome: dept.departamento_nome,
            }))
          )

          const tableData = allProdutos.map((p: Produto & { departamento_nome: string }) => [
            p.departamento_nome.substring(0, 25),
            p.filial_nome || String(p.filial_id),
            p.produto_id,
            p.produto_descricao.substring(0, 40),
            formatNumber(p.estoque_atual),
            p.curva_venda,
            `${p.dias_com_venda_60d}d`,
            formatNumber(p.venda_media_diaria_60d),
            formatNumber(p.valor_estoque_parado),
            p.nivel_ruptura
          ])

          autoTable(doc as any, {
            head: [['Departamento', 'Filial', 'Código', 'Descrição', 'Estoque', 'Curva', 'Freq. Giro', 'Giro Médio', 'Valor Parado', 'Nível']],
            body: tableData as any,
            startY: 45,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 32 },
              1: { cellWidth: 26 },
              2: { cellWidth: 18 },
              3: { cellWidth: 50 },
              4: { cellWidth: 18, halign: 'right' },
              5: { cellWidth: 12, halign: 'center' },
              6: { cellWidth: 16, halign: 'center' },
              7: { cellWidth: 18, halign: 'right' },
              8: { cellWidth: 22, halign: 'right' },
              9: { cellWidth: 16, halign: 'center' },
            },
            margin: { top: 45, left: 12, right: 12 },
          })
        }

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
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */

      doc.save(`dias-sem-giro-${new Date().toISOString().split('T')[0]}.pdf`)
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
      const supabase = createClient()
      const filiais = filiaisSelecionadas.length > 0
        ? filiaisSelecionadas.map(f => parseInt(f.value))
        : null
      const curvas = curvasSelecionadas.length > 0
        ? curvasSelecionadas.map(c => c.value)
        : null
      const departamentoIds =
        tipoBusca === 'departamento' &&
        departamentosSelecionados.length > 0 &&
        departamentosSelecionados.length < departamentosDisponiveis.length
          ? departamentosSelecionados
          : null
      const setorIds =
        tipoBusca === 'setor'
          ? setoresSelecionados.length > 0
            ? setoresSelecionados
            : null
          : null
      const buscaProduto = tipoBusca === 'produto' && busca.trim()
        ? busca.trim()
        : null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allData } = await (supabase.rpc as any)('get_ruptura_venda_60d_report', {
        schema_name: currentTenant.supabase_schema,
        p_filiais: filiais,
        p_limite_minimo_dias: parseInt(diasMinimos),
        p_curvas: curvas,
        p_page: 1,
        p_page_size: 10000,
        p_departamento_ids: departamentoIds,
        p_setor_ids: setorIds,
        p_busca: buscaProduto
      })

      const rows: {
        Setor?: string
        Departamento: string
        Filial: string | number
        Código: number
        Descrição: string
        Estoque: number
        Curva: string
        'Freq. Giro': number
        'Giro Médio': number
        'Valor Parado': number
        Nível: string
      }[] = []

      if (allData && allData.length > 0 && allData[0].departamentos) {
        const departamentos = allData[0].departamentos

        if (tipoBusca === 'setor') {
          const setoresAgrupados = agruparPorSetor(
            departamentos,
            setoresDisponiveis,
            setoresSelecionados
          )

          setoresAgrupados.forEach((setor) => {
            setor.departamentos
              .sort((a, b) => a.departamento_nome.localeCompare(b.departamento_nome, 'pt-BR'))
              .forEach((dept) => {
                dept.produtos.forEach((p: Produto) => {
                  rows.push({
                    Setor: setor.setor_nome,
                    Departamento: dept.departamento_nome,
                    Filial: p.filial_nome || p.filial_id,
                    Código: p.produto_id,
                    Descrição: p.produto_descricao,
                    Estoque: p.estoque_atual,
                    Curva: p.curva_venda,
                    'Freq. Giro': p.dias_com_venda_60d,
                    'Giro Médio': p.venda_media_diaria_60d,
                    'Valor Parado': p.valor_estoque_parado,
                    Nível: p.nivel_ruptura
                  })
                })
              })
          })
        } else {
          departamentos.forEach((dept: Departamento) => {
            dept.produtos.forEach((p: Produto) => {
              rows.push({
                Departamento: dept.departamento_nome,
                Filial: p.filial_nome || p.filial_id,
                Código: p.produto_id,
                Descrição: p.produto_descricao,
                Estoque: p.estoque_atual,
                Curva: p.curva_venda,
                'Freq. Giro': p.dias_com_venda_60d,
                'Giro Médio': p.venda_media_diaria_60d,
                'Valor Parado': p.valor_estoque_parado,
                Nível: p.nivel_ruptura
              })
            })
          })
        }
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Dias sem Giro')

      // Add headers from first row keys
      if (rows.length > 0) {
        worksheet.columns = Object.keys(rows[0]).map(key => ({
          header: key,
          key: key,
          width: key === 'Descrição' ? 45 :
                 key === 'Setor' || key === 'Departamento' ? 25 :
                 key === 'Filial' ? 18 :
                 key === 'Valor Parado' ? 14 :
                 key === 'Estoque' || key === 'Freq. Giro' || key === 'Giro Médio' ? 12 :
                 key === 'Código' || key === 'Nível' ? 10 :
                 key === 'Curva' ? 8 : 15
        }))
        worksheet.addRows(rows)
      }

      // Download file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dias-sem-giro-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
      alert('Erro ao exportar Excel')
    } finally {
      setExporting(false)
    }
  }

  // Badge de nível de ruptura
  const getNivelBadge = (nivel: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      'CRÍTICO': 'destructive',
      'ALTO': 'destructive',
      'MÉDIO': 'default',
      'BAIXO': 'secondary'
    }
    return <Badge variant={variants[nivel] || 'outline'}>{nivel}</Badge>
  }

  // Calcular estatísticas por nível de ruptura
  const calcularEstatisticas = () => {
    const stats = {
      CRÍTICO: 0,
      ALTO: 0,
      MÉDIO: 0,
      BAIXO: 0,
      NORMAL: 0,
      valorTotal: 0
    }

    if (data?.departamentos) {
      data.departamentos.forEach((dept: Departamento) => {
        dept.produtos.forEach((produto: Produto) => {
          const nivel = produto.nivel_ruptura as keyof typeof stats
          if (nivel in stats && nivel !== 'valorTotal') {
            (stats[nivel] as number)++
          }
          stats.valorTotal += produto.valor_estoque_parado || 0
        })
      })
    }

    return stats
  }

  const estatisticas = data ? calcularEstatisticas() : null

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Ruptura"
        title="Dias sem Giro"
        description="Produtos com histórico de vendas consistente que pararam de girar"
        icon={Package}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Linha 1: Filtros principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filiais */}
              <div className="flex flex-col gap-2">
                <Label>Filiais</Label>
                <div className="h-10">
                  <MultiSelect
                    options={filiaisOptions}
                    value={filiaisSelecionadas}
                    onValueChange={setFiliaisSelecionadas}
                    placeholder="Todas as Filiais"
                    className="w-full h-10"
                  />
                </div>
              </div>

              {/* Dias mínimos com venda */}
              <div className="flex flex-col gap-2">
                <Label>Dias mínimos com venda (60d)</Label>
                <div className="h-10">
                  <Select value={diasMinimos} onValueChange={setDiasMinimos}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {diasMinimosOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Curvas */}
              <div className="flex flex-col gap-2">
                <Label>Curvas ABCD</Label>
                <div className="h-10">
                  <MultiSelect
                    options={curvasOptions}
                    value={curvasSelecionadas}
                    onValueChange={setCurvasSelecionadas}
                    placeholder="Selecione as curvas"
                    className="w-full h-10"
                  />
                </div>
              </div>
            </div>

            {/* Linha 2: Filtrar por, filtro específico e botão aplicar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:gap-4">
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

              <div className="flex flex-col gap-2 w-full lg:w-auto lg:self-end">
                <Button
                  onClick={handleAplicarFiltros}
                  disabled={loading}
                  className="w-full lg:w-auto h-10"
                >
                  {loading ? (
                    <AlertTriangle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Aplicar
                </Button>
              </div>
            </div>

            {/* Descrição dos critérios */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <strong>Critério de Ruptura:</strong> Produtos que venderam em pelo menos{' '}
              <strong>{diasMinimos} dias</strong> dos últimos 60 dias, mas{' '}
              <strong>não venderam nos últimos 3 dias</strong>, mesmo tendo estoque disponível.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Produtos em Ruptura
                </CardTitle>
                {data && (
                  <CardDescription>
                    {data.total_records} produto(s) encontrado(s)
                  </CardDescription>
                )}
              </div>
              {/* Botões de Exportação */}
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
            </div>

            {/* Estatísticas por nível */}
            {estatisticas && data && data.total_records > 0 && (
              <div className="flex flex-wrap gap-3">
                {estatisticas.CRÍTICO > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-md">
                    <Badge variant="destructive">CRÍTICO</Badge>
                    <span className="text-sm font-medium">{estatisticas.CRÍTICO}</span>
                  </div>
                )}
                {estatisticas.ALTO > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 rounded-md">
                    <Badge className="bg-orange-500 hover:bg-orange-600">ALTO</Badge>
                    <span className="text-sm font-medium">{estatisticas.ALTO}</span>
                  </div>
                )}
                {estatisticas.MÉDIO > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 rounded-md">
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">MÉDIO</Badge>
                    <span className="text-sm font-medium">{estatisticas.MÉDIO}</span>
                  </div>
                )}
                {estatisticas.BAIXO > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
                    <Badge variant="secondary">BAIXO</Badge>
                    <span className="text-sm font-medium">{estatisticas.BAIXO}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-md ml-auto">
                  <span className="text-sm text-muted-foreground">Valor Parado:</span>
                  <span className="text-sm font-bold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(estatisticas.valorTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : !data || data.departamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto em ruptura encontrado</p>
              <p className="text-sm mt-2">
                Isso é ótimo! Significa que não há produtos com vendas consistentes que pararam de vender.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
                                      <TableHead className="w-[120px]">Filial</TableHead>
                                      <TableHead className="w-[80px]">Código</TableHead>
                                      <TableHead className="min-w-[200px]">Descrição</TableHead>
                                      <TableHead className="text-right w-[90px]">Estoque</TableHead>
                                      <TableHead className="text-center w-[70px]">Curva</TableHead>
                                      <TableHead className="text-right w-[90px]">Freq. Giro</TableHead>
                                      <TableHead className="text-right w-[90px]">Giro Médio</TableHead>
                                      <TableHead className="text-right w-[110px]">Valor Parado</TableHead>
                                      <TableHead className="w-[90px]">Nível</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {dept.produtos.map((produto) => (
                                      <TableRow key={`${produto.produto_id}-${produto.filial_id}`}>
                                        <TableCell className="w-[120px]">
                                          {produto.filial_nome || produto.filial_id}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm w-[80px]">
                                          {produto.produto_id}
                                        </TableCell>
                                        <TableCell className="min-w-[200px]">
                                          <div className="truncate" title={produto.produto_descricao}>
                                            {produto.produto_descricao}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right w-[90px] font-semibold">
                                          {formatNumber(produto.estoque_atual)}
                                        </TableCell>
                                        <TableCell className="text-center w-[70px]">
                                          <Badge variant="outline">{produto.curva_venda}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right w-[90px]">
                                          {produto.dias_com_venda_60d} dias
                                        </TableCell>
                                        <TableCell className="text-right w-[90px]">
                                          {formatNumber(produto.venda_media_diaria_60d)}
                                        </TableCell>
                                        <TableCell className="text-right w-[110px] text-destructive font-medium">
                                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.valor_estoque_parado)}
                                        </TableCell>
                                        <TableCell className="w-[90px]">
                                          {getNivelBadge(produto.nivel_ruptura)}
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
                              <TableHead className="w-[120px]">Filial</TableHead>
                              <TableHead className="w-[80px]">Código</TableHead>
                              <TableHead className="min-w-[200px]">Descrição</TableHead>
                              <TableHead className="text-right w-[90px]">Estoque</TableHead>
                              <TableHead className="text-center w-[70px]">Curva</TableHead>
                              <TableHead className="text-right w-[90px]">Freq. Giro</TableHead>
                              <TableHead className="text-right w-[90px]">Giro Médio</TableHead>
                              <TableHead className="text-right w-[110px]">Valor Parado</TableHead>
                              <TableHead className="w-[90px]">Nível</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dept.produtos.map((produto) => (
                              <TableRow key={`${produto.produto_id}-${produto.filial_id}`}>
                                <TableCell className="w-[120px]">
                                  {produto.filial_nome || produto.filial_id}
                                </TableCell>
                                <TableCell className="font-mono text-sm w-[80px]">
                                  {produto.produto_id}
                                </TableCell>
                                <TableCell className="min-w-[200px]">
                                  <div className="truncate" title={produto.produto_descricao}>
                                    {produto.produto_descricao}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right w-[90px] font-semibold">
                                  {formatNumber(produto.estoque_atual)}
                                </TableCell>
                                <TableCell className="text-center w-[70px]">
                                  <Badge variant="outline">{produto.curva_venda}</Badge>
                                </TableCell>
                                <TableCell className="text-right w-[90px]">
                                  {produto.dias_com_venda_60d} dias
                                </TableCell>
                                <TableCell className="text-right w-[90px]">
                                  {formatNumber(produto.venda_media_diaria_60d)}
                                </TableCell>
                                <TableCell className="text-right w-[110px] text-destructive font-medium">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.valor_estoque_parado)}
                                </TableCell>
                                <TableCell className="w-[90px]">
                                  {getNivelBadge(produto.nivel_ruptura)}
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
          )}

          {/* Paginação */}
          {data && data.total_pages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {[...Array(data.total_pages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        onClick={() => setPage(i + 1)}
                        isActive={page === i + 1}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                      className={page === data.total_pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
