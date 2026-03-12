'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTenantContext } from '@/contexts/tenant-context'
import { useBranchesOptions } from '@/hooks/use-branches'
import { DepartmentFilterPopover, SectorFilterPopover } from '@/components/filters'
import { ArrowUpDown, ChartCandlestick, FileDown, Loader2, FileText } from 'lucide-react'
import type { ProdutoSemVenda } from './columns'
import { logModuleAccess } from '@/lib/audit'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Tipos para jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
    autoTable: (options: Record<string, unknown>) => jsPDF
  }
}

interface ApiResponse {
  data: ProdutoSemVenda[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  error?: string
  message?: string
  details?: string | null
  hint?: string | null
}

type SortKey =
  | 'produto_id'
  | 'descricao'
  | 'dias_sem_venda'
  | 'estoque_atual'
  | 'data_ultima_venda'
  | 'data_ultima_entrada'
  | 'preco_custo'
  | 'curva_abcd'
  | 'curva_lucro'

function formatDateOnly(value: string | null) {
  if (!value) return '-'

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`
  }

  return format(new Date(value), 'dd/MM/yyyy')
}

// Opções de curvas
export default function ProdutosSemVendasPage() {
  const { currentTenant, userProfile } = useTenantContext()
  const { branchOptions: branches } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
    includeAll: false,
  })

  // Estados de filtros
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [diasSemVendasMin, setDiasSemVendasMin] = useState<number>(15)
  const [diasSemVendasMax, setDiasSemVendasMax] = useState<number>(90)
  const [filtroTipo, setFiltroTipo] = useState<string>('all')
  const [departamentosSelecionados, setDepartamentosSelecionados] = useState<number[]>([])
  const [setoresSelecionados, setSetoresSelecionados] = useState<number[]>([])
  const [produtoBuscaInput, setProdutoBuscaInput] = useState('')

  // Estados de dados
  const [produtos, setProdutos] = useState<ProdutoSemVenda[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [departamentos, setDepartamentos] = useState<Array<{
    id: number
    departamento_id: number
    descricao: string
    pai_level_2_id: number | null
    pai_level_3_id: number | null
    pai_level_4_id: number | null
    pai_level_5_id: number | null
    pai_level_6_id: number | null
  }>>([])
  const [setores, setSetores] = useState<Array<{ id: number; nome: string; departamento_nivel: number; departamento_ids: number[]; ativo: boolean }>>([])
  const [produtosSelecionados, setProdutosSelecionados] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [defaultFilialSet, setDefaultFilialSet] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'dias_sem_venda',
    direction: 'desc',
  })

  const setorConflitos = useMemo(() => {
    const deptToSetores = new Map<number, string[]>()

    const resolveDeptIdsNivel1 = (setor: typeof setores[number]) => {
      if (setor.departamento_nivel === 1) {
        return setor.departamento_ids || []
      }

      return departamentos
        .filter((departamento) => {
          if (setor.departamento_nivel === 2) {
            return departamento.pai_level_2_id !== null && setor.departamento_ids.includes(departamento.pai_level_2_id)
          }
          if (setor.departamento_nivel === 3) {
            return departamento.pai_level_3_id !== null && setor.departamento_ids.includes(departamento.pai_level_3_id)
          }
          if (setor.departamento_nivel === 4) {
            return departamento.pai_level_4_id !== null && setor.departamento_ids.includes(departamento.pai_level_4_id)
          }
          if (setor.departamento_nivel === 5) {
            return departamento.pai_level_5_id !== null && setor.departamento_ids.includes(departamento.pai_level_5_id)
          }
          if (setor.departamento_nivel === 6) {
            return departamento.pai_level_6_id !== null && setor.departamento_ids.includes(departamento.pai_level_6_id)
          }
          return false
        })
        .map((departamento) => departamento.departamento_id)
    }

    setores
      .filter((setor) => setor.ativo)
      .forEach((setor) => {
        resolveDeptIdsNivel1(setor).forEach((departamentoId) => {
          const nomes = deptToSetores.get(departamentoId) || []
          nomes.push(setor.nome)
          deptToSetores.set(departamentoId, nomes)
        })
      })

    return Array.from(deptToSetores.entries())
      .filter(([, nomes]) => nomes.length > 1)
      .map(([departamentoId, nomes]) => ({
        departamentoId,
        setores: nomes
      }))
  }, [departamentos, setores])

  const conflitosNosSetoresSelecionados = useMemo(() => {
    if (setoresSelecionados.length === 0) return []

    const nomesSelecionados = new Set(
      setores
        .filter((setor) => setoresSelecionados.includes(setor.id))
        .map((setor) => setor.nome)
    )

    return setorConflitos.filter((conflito) =>
      conflito.setores.some((nomeSetor) => nomesSelecionados.has(nomeSetor))
    )
  }, [setorConflitos, setores, setoresSelecionados])

  // Resetar seleção padrão ao trocar tenant
  useEffect(() => {
    setSelectedBranch('')
    setDefaultFilialSet(false)
  }, [currentTenant?.id])

  // Auto-selecionar primeira filial quando opções estiverem disponíveis
  useEffect(() => {
    if (branches.length > 0 && !defaultFilialSet) {
      const sortedFiliais = [...branches].sort((a, b) =>
        a.value.localeCompare(b.value, 'pt-BR', { numeric: true })
      )
      const defaultBranch = sortedFiliais[0]
      console.log('✅ [Auto-select] Selecionando primeira filial:', defaultBranch)
      setSelectedBranch(defaultBranch.value)
      setDefaultFilialSet(true)
    }
  }, [branches, defaultFilialSet])

  // Auto-load: Executar busca quando filtros estiverem prontos (APENAS PRIMEIRA VEZ)
  useEffect(() => {
    if (currentTenant?.supabase_schema && selectedBranch && !loading) {
      console.log('✅ [Auto-load] Executando primeira busca automaticamente')
      fetchData(1)
    }
  }, [currentTenant, selectedBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carregar departamentos e setores
  useEffect(() => {
    if (!currentTenant?.supabase_schema) return

    const loadData = async () => {
      const supabase = createClient()

      // Buscar departamentos
      const { data: deptData } = await supabase
        .schema(currentTenant.supabase_schema as 'public')
        .from('departments_level_1')
        .select('id, departamento_id, descricao, pai_level_2_id, pai_level_3_id, pai_level_4_id, pai_level_5_id, pai_level_6_id')
        .order('descricao')

      if (deptData) {
        setDepartamentos(deptData)
      }

      // Buscar setores
      const { data: setoresData } = await supabase
        .schema(currentTenant.supabase_schema as 'public')
        .from('setores')
        .select('id, nome, departamento_nivel, departamento_ids, ativo')
        .eq('ativo', true)
        .order('nome')

      if (setoresData) {
        setSetores(setoresData)
      }
    }

    loadData()
  }, [currentTenant])

  // Buscar dados
  const fetchData = async (page: number = 1) => {
    if (!currentTenant?.supabase_schema) return
    if (!selectedBranch || selectedBranch === 'all') {
      alert('Selecione uma filial específica para gerar o relatório.')
      return
    }
    if (filtroTipo === 'departamento' && departamentosSelecionados.length === 0) {
      alert('Selecione ao menos um departamento.')
      return
    }
    if (filtroTipo === 'setor' && setoresSelecionados.length === 0) {
      alert('Selecione ao menos um setor.')
      return
    }
    if (filtroTipo === 'produto' && !produtoBuscaInput.trim()) {
      alert('Informe um código ou descrição de produto.')
      return
    }

    setLoading(true)
    setCurrentPage(page)
    
    try {
      const filiaisParam = selectedBranch

      let departamentoIds = null
      if (filtroTipo === 'departamento' && departamentosSelecionados.length > 0) {
        departamentoIds = departamentosSelecionados.join(',')
      } else if (filtroTipo === 'setor' && setoresSelecionados.length > 0) {
        departamentoIds = setoresSelecionados.join(',')
      }

      const produtoIds = filtroTipo === 'produto' && produtosSelecionados.length > 0
        ? produtosSelecionados.join(',')
        : null
      const produtoBusca = filtroTipo === 'produto' && produtoBuscaInput.trim()
        ? produtoBuscaInput.trim()
        : null

      const offset = (page - 1) * pageSize

      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        filiais: filiaisParam,
        dias_sem_vendas_min: diasSemVendasMin.toString(),
        dias_sem_vendas_max: diasSemVendasMax.toString(),
        data_referencia: new Date().toISOString().split('T')[0],
        curva_abc: 'all',
        filtro_tipo: filtroTipo,
        limit: pageSize.toString(),
        offset: offset.toString()
      })

      if (departamentoIds) params.append('departamento_ids', departamentoIds)
      if (produtoIds) params.append('produto_ids', produtoIds)
      if (produtoBusca) params.append('produto_busca', produtoBusca)

      const response = await fetch(`/api/relatorios/produtos-sem-vendas?${params}`)
      const result: ApiResponse = await response.json()

      if (response.ok) {
        setProdutos(result.data)
        setTotalCount(result.pagination.total)
      } else {
        console.error('Erro ao buscar produtos:', {
          status: response.status,
          statusText: response.statusText,
          error: result
        })
        alert(`Erro ao buscar produtos: ${result.message || result.error || 'Erro desconhecido'}`)
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      alert('Erro ao buscar produtos. Verifique o console para mais detalhes.')
    } finally {
      setLoading(false)
    }
  }

  // Exportar para PDF (busca TODOS os dados)
  const exportToPDF = async () => {
    if (!currentTenant?.supabase_schema) return
    if (!selectedBranch || selectedBranch === 'all') {
      alert('Selecione uma filial específica para exportar o relatório.')
      return
    }
    if (filtroTipo === 'departamento' && departamentosSelecionados.length === 0) {
      alert('Selecione ao menos um departamento para exportar.')
      return
    }
    if (filtroTipo === 'setor' && setoresSelecionados.length === 0) {
      alert('Selecione ao menos um setor para exportar.')
      return
    }
    if (filtroTipo === 'produto' && !produtoBuscaInput.trim()) {
      alert('Informe um código ou descrição de produto para exportar.')
      return
    }
    
    setExporting(true)
    try {
      // Buscar TODOS os dados para exportação
      const filiaisParam = selectedBranch

      let departamentoIds = null
      if (filtroTipo === 'departamento' && departamentosSelecionados.length > 0) {
        departamentoIds = departamentosSelecionados.join(',')
      } else if (filtroTipo === 'setor' && setoresSelecionados.length > 0) {
        departamentoIds = setoresSelecionados.join(',')
      }

      const produtoIds = filtroTipo === 'produto' && produtosSelecionados.length > 0
        ? produtosSelecionados.join(',')
        : null
      const produtoBusca = filtroTipo === 'produto' && produtoBuscaInput.trim()
        ? produtoBuscaInput.trim()
        : null

      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        filiais: filiaisParam,
        dias_sem_vendas_min: diasSemVendasMin.toString(),
        dias_sem_vendas_max: diasSemVendasMax.toString(),
        data_referencia: new Date().toISOString().split('T')[0],
        curva_abc: 'all',
        filtro_tipo: filtroTipo,
        limit: '10000', // Máximo para exportação
        offset: '0'
      })

      if (departamentoIds) params.append('departamento_ids', departamentoIds)
      if (produtoIds) params.append('produto_ids', produtoIds)
      if (produtoBusca) params.append('produto_busca', produtoBusca)

      const response = await fetch(`/api/relatorios/produtos-sem-vendas?${params}`)
      const result: ApiResponse = await response.json()

      if (!response.ok) {
        alert('Erro ao buscar dados para exportação')
        return
      }

      const allProdutos = result.data

      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      }) as InstanceType<typeof jsPDF> & { autoTable: typeof autoTable }

      // Título
      doc.setFontSize(16)
      doc.text('Produtos sem vendas', 14, 15)

      // Subtítulo
      doc.setFontSize(10)
      doc.text(`Dias sem vendas: ${diasSemVendasMin} a ${diasSemVendasMax} dias | Curva: Todas`, 14, 22)
      doc.text(`Total: ${allProdutos.length} produtos | Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 27)

      // Tabela
      const tableData = allProdutos.map(p => [
        p.filial_id,
        p.produto_id,
        p.descricao,
        p.departamento_nome || '-',
        p.setor_nome || '-',
        p.dias_sem_venda,
        p.estoque_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        formatDateOnly(p.data_ultima_venda),
        formatDateOnly(p.data_ultima_entrada),
        `R$ ${p.preco_custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        p.curva_abcd || '-',
        p.curva_lucro || '-'
      ])

      autoTable(doc, {
        startY: 32,
        head: [[
          'Filial', 'Código', 'Descrição', 'Departamento', 'Setor', 'Dias',
          'Estoque', 'Últ. Venda', 'Últ. Entrada', 'Custo',
          'Curva V.', 'Curva L.'
        ]],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`produtos-sem-vendas-${diasSemVendasMin}-${diasSemVendasMax}d-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A')
      alert(`Erro ao exportar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const sortedProdutos = useMemo(() => {
    const directionFactor = sortConfig.direction === 'asc' ? 1 : -1

    return [...produtos].sort((a, b) => {
      const getComparableValue = (produto: ProdutoSemVenda) => {
        const value = produto[sortConfig.key]
        if (value === null || value === undefined) return ''
        return value
      }

      const valueA = getComparableValue(a)
      const valueB = getComparableValue(b)

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * directionFactor
      }

      if (sortConfig.key === 'data_ultima_venda' || sortConfig.key === 'data_ultima_entrada') {
        const timeA = valueA ? new Date(valueA as string).getTime() : 0
        const timeB = valueB ? new Date(valueB as string).getTime() : 0
        return (timeA - timeB) * directionFactor
      }

      return String(valueA).localeCompare(String(valueB), 'pt-BR', { numeric: true }) * directionFactor
    })
  }, [produtos, sortConfig])

  const renderSortHeader = (label: string, key: SortKey, className?: string) => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className={className ?? 'inline-flex items-center gap-1 text-sm font-medium'}
    >
      {label}
      <ArrowUpDown className="h-4 w-4" />
    </button>
  )

  const selectedBranchLabel = branches.find((branch) => branch.value === selectedBranch)?.label
  const selectedFilterLabel = useMemo(() => {
    if (filtroTipo === 'departamento' && departamentosSelecionados.length === 1) {
      return departamentos.find(
        (departamento) => departamento.departamento_id === departamentosSelecionados[0]
      )?.descricao || null
    }

    if (filtroTipo === 'setor' && setoresSelecionados.length === 1) {
      return setores.find((setor) => setor.id === setoresSelecionados[0])?.nome || null
    }

    return null
  }, [departamentos, departamentosSelecionados, filtroTipo, setores, setoresSelecionados])

  // Log de acesso
  useEffect(() => {
    const logAccess = async () => {
      if (!currentTenant || !userProfile) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      await logModuleAccess({
        module: 'relatorios',
        subModule: 'produtos_sem_vendas',
        tenantId: currentTenant.id,
        userName: userProfile.full_name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        action: 'access',
        metadata: { 
          dias_sem_vendas_min: diasSemVendasMin, 
          dias_sem_vendas_max: diasSemVendasMax, 
          curva_abc: 'all' 
        }
      })
    }
    logAccess()
  }, [currentTenant, userProfile, diasSemVendasMin, diasSemVendasMax])

  return (
    <div className="space-y-6">
      <PageHeader
        section="Vendas"
        title="Produtos Sem Venda"
        description="Produtos sem movimentação de vendas no período definido"
        icon={ChartCandlestick}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="space-y-4 pt-6 px-4">
          <div className="grid grid-cols-1 gap-4 xl:flex xl:items-end xl:gap-8">
            <div className="space-y-2 xl:w-[400px] xl:shrink-0">
              <Label>Filiais</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-10 w-full xl:w-[400px]">
                  <SelectValue placeholder="Selecione a filial" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.value} value={branch.value}>
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:shrink-0">
              <Label>Período Sem Vendas (Em dias)</Label>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-muted-foreground">De</span>
                <Input
                  id="dias-min"
                  type="number"
                  min="1"
                  max="365"
                  value={diasSemVendasMin}
                  onChange={(e) => setDiasSemVendasMin(parseInt(e.target.value) || 15)}
                  className="h-10 w-[72px]"
                  placeholder="15"
                />
                <span className="text-sm font-medium text-muted-foreground">a</span>
                <Input
                  id="dias-max"
                  type="number"
                  min="1"
                  max="365"
                  value={diasSemVendasMax}
                  onChange={(e) => setDiasSemVendasMax(parseInt(e.target.value) || 90)}
                  className="h-10 w-[72px]"
                  placeholder="90"
                />
                <span className="text-sm font-medium text-muted-foreground">dias</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_auto] xl:items-end xl:gap-3 xl:shrink-0">
              <div className="space-y-2">
                <Label htmlFor="filtro-tipo">Filtrar por</Label>
                <Select value={filtroTipo} onValueChange={(value) => {
                  setFiltroTipo(value)
                  setDepartamentosSelecionados([])
                  setSetoresSelecionados([])
                  setProdutosSelecionados([])
                  setProdutoBuscaInput('')
                }}>
                  <SelectTrigger id="filtro-tipo" className="h-10 w-full py-1 xl:w-[220px]">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    <SelectItem value="departamento">Departamentos</SelectItem>
                    <SelectItem value="setor">Setores</SelectItem>
                    <SelectItem value="produto">Produtos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => fetchData(1)} disabled={loading} className="h-10 min-w-[180px] xl:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar Relatório
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Linha 3: Filtro específico dinâmico */}
          {filtroTipo !== 'all' && (
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>
                  {filtroTipo === 'departamento' && 'Departamentos'}
                  {filtroTipo === 'setor' && 'Setores'}
                  {filtroTipo === 'produto' && 'Produtos'}
                </Label>
                {filtroTipo === 'departamento' && (
                  <DepartmentFilterPopover
                    departamentos={departamentos}
                    selectedIds={departamentosSelecionados}
                    onChange={setDepartamentosSelecionados}
                  />
                )}
                {filtroTipo === 'setor' && (
                  <div className="space-y-2">
                    <SectorFilterPopover
                      setores={setores}
                      selectedIds={setoresSelecionados}
                      onChange={setSetoresSelecionados}
                    />
                    {conflitosNosSetoresSelecionados.length > 0 && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Atenção: há departamentos compartilhados entre setores selecionados.
                        Isso pode misturar produtos entre setores. Exemplo: depto(s){' '}
                        {conflitosNosSetoresSelecionados
                          .slice(0, 5)
                          .map((c) => c.departamentoId)
                          .join(', ')}
                        .
                      </div>
                    )}
                  </div>
                )}
                {filtroTipo === 'produto' && (
                  <Input
                    placeholder="Código exato ou parte da descrição"
                    value={produtoBuscaInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setProdutoBuscaInput(value)
                      const ids = value
                        .split(',')
                        .map((item) => item.trim())
                        .filter((item) => /^\d+$/.test(item))
                        .map((item) => Number(item))
                      setProdutosSelecionados(Array.from(new Set(ids)))
                    }}
                    className="h-10"
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      ) : produtos.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span>Relatório de Produtos sem vendas</span>
                  {selectedBranchLabel && (
                    <Badge variant="secondary" className="font-normal">
                      {selectedBranchLabel}
                    </Badge>
                  )}
                  {selectedFilterLabel && (
                    <Badge variant="outline" className="font-normal">
                      {selectedFilterLabel}
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                onClick={exportToPDF}
                disabled={produtos.length === 0 || exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-hidden rounded-md border px-[5px]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[#E4DFFF] dark:bg-[#2D2B55]" />
              <Table className="text-xs">
                <TableHeader className="relative z-10 bg-[#E4DFFF] dark:bg-[#2D2B55]">
                  <TableRow>
                    <TableHead className="pl-[5px] pr-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Código', 'produto_id', 'inline-flex items-center gap-1 text-sm font-medium')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Descrição', 'descricao')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Dias', 'dias_sem_venda')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Estoque', 'estoque_atual')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Últ. Venda', 'data_ultima_venda')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Últ. Entrada', 'data_ultima_entrada')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Custo', 'preco_custo')}
                    </TableHead>
                    <TableHead className="px-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Curva V.', 'curva_abcd')}
                    </TableHead>
                    <TableHead className="pl-[5px] pr-[5px] text-[#4A4080] dark:text-[#E2E2F5]">
                      {renderSortHeader('Curva L.', 'curva_lucro')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProdutos.length > 0 ? (
                    sortedProdutos.map((produto) => (
                      <TableRow key={`${produto.filial_id}-${produto.produto_id}`}>
                        <TableCell className="pl-[5px] pr-[5px]">
                          {produto.produto_id}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate px-[5px]" title={produto.descricao}>
                          {produto.descricao}
                        </TableCell>
                        <TableCell className="px-[5px]">
                          <Badge variant={produto.dias_sem_venda > 90 ? 'destructive' : 'secondary'}>
                            {produto.dias_sem_venda}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-[5px]">
                          {produto.estoque_atual.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="px-[5px]">
                          {produto.data_ultima_venda
                            ? formatDateOnly(produto.data_ultima_venda)
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="px-[5px]">
                          {produto.data_ultima_entrada
                            ? formatDateOnly(produto.data_ultima_entrada)
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="px-[5px]">
                          R$ {produto.preco_custo.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="px-[5px]">
                          {produto.curva_abcd ? (
                            <Badge
                              variant={
                                produto.curva_abcd === 'A'
                                  ? 'default'
                                  : produto.curva_abcd === 'B'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {produto.curva_abcd}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="pl-[5px] pr-[5px]">
                          {produto.curva_lucro ? (
                            <Badge variant="outline">{produto.curva_lucro}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        Nenhum resultado encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Paginação Server-Side */}
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <CardDescription>
                Mostrando {produtos.length} de {totalCount} produto{totalCount !== 1 ? 's' : ''} (página {currentPage} de {Math.max(1, Math.ceil(totalCount / pageSize))})
              </CardDescription>
              {totalCount > pageSize && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Anterior
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Página {currentPage} de {Math.ceil(totalCount / pageSize)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchData(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
