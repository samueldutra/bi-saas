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
import { ChartCandlestick, FileDown, Loader2, FileText } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { createColumns, ProdutoSemVenda } from './columns'
import { logModuleAccess } from '@/lib/audit'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/dashboard/page-header'

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

  // Estados de dados
  const [produtos, setProdutos] = useState<ProdutoSemVenda[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [departamentos, setDepartamentos] = useState<Array<{ id: number; departamento_id: number; descricao: string }>>([])
  const [setores, setSetores] = useState<Array<{ id: number; nome: string; departamento_nivel: number; departamento_ids: number[]; ativo: boolean }>>([])
  const [produtosSelecionados, setProdutosSelecionados] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [defaultFilialSet, setDefaultFilialSet] = useState(false)

  // Auto-selecionar primeira filial quando opções estiverem disponíveis
  useEffect(() => {
    if (branches.length > 0 && !defaultFilialSet) {
      const sortedFiliais = [...branches].sort((a, b) => {
        const idA = parseInt(a.value)
        const idB = parseInt(b.value)
        return idA - idB
      })
      const defaultBranch = sortedFiliais[0]
      console.log('✅ [Auto-select] Selecionando primeira filial:', defaultBranch)
      setSelectedBranch(defaultBranch.value)
      setDefaultFilialSet(true)
    }
  }, [branches, defaultFilialSet])

  // Auto-load: Executar busca quando filtros estiverem prontos (APENAS PRIMEIRA VEZ)
  useEffect(() => {
    if (currentTenant?.supabase_schema && selectedBranch && !loading && defaultFilialSet) {
      console.log('✅ [Auto-load] Executando primeira busca automaticamente')
      fetchData(1)
    }
  }, [currentTenant, selectedBranch, defaultFilialSet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carregar departamentos e setores
  useEffect(() => {
    if (!currentTenant?.supabase_schema) return

    const loadData = async () => {
      const supabase = createClient()

      // Buscar departamentos
      const { data: deptData } = await supabase
        .schema(currentTenant.supabase_schema as 'public')
        .from('departments_level_1')
        .select('id, departamento_id, descricao')
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

    setLoading(true)
    setCurrentPage(page)
    
    try {
      const filiaisParam = selectedBranch || 'all'

      let departamentoIds = null
      if (filtroTipo === 'departamento' && departamentosSelecionados.length > 0) {
        departamentoIds = departamentosSelecionados.join(',')
      } else if (filtroTipo === 'setor' && setoresSelecionados.length > 0) {
        departamentoIds = setoresSelecionados.join(',')
      }

      const produtoIds = filtroTipo === 'produto' && produtosSelecionados.length > 0
        ? produtosSelecionados.join(',')
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
        alert(`Erro ao buscar produtos: ${'message' in result ? result.message : 'error' in result ? result.error : 'Erro desconhecido'}`)
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
    
    setExporting(true)
    try {
      // Buscar TODOS os dados para exportação
      const filiaisParam = selectedBranch || 'all'

      let departamentoIds = null
      if (filtroTipo === 'departamento' && departamentosSelecionados.length > 0) {
        departamentoIds = departamentosSelecionados.join(',')
      } else if (filtroTipo === 'setor' && setoresSelecionados.length > 0) {
        departamentoIds = setoresSelecionados.join(',')
      }

      const produtoIds = filtroTipo === 'produto' && produtosSelecionados.length > 0
        ? produtosSelecionados.join(',')
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
        p.dias_sem_venda,
        p.estoque_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        p.data_ultima_venda ? format(new Date(p.data_ultima_venda), 'dd/MM/yyyy') : '-',
        p.data_ultima_entrada ? format(new Date(p.data_ultima_entrada), 'dd/MM/yyyy') : '-',
        `R$ ${p.preco_custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        p.curva_abcd || '-',
        p.curva_lucro || '-'
      ])

      autoTable(doc, {
        startY: 32,
        head: [[
          'Filial', 'Código', 'Descrição', 'Dias',
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

  // Helper para obter nome da filial
  // Criar colunas com useMemo para evitar recriação desnecessária
  const columns = useMemo(() => createColumns(), [])

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
                  <SectorFilterPopover
                    setores={setores}
                    selectedIds={setoresSelecionados}
                    onChange={setSetoresSelecionados}
                  />
                )}
                {filtroTipo === 'produto' && (
                  <div className="text-sm text-muted-foreground pt-2">
                    Use a busca abaixo para filtrar produtos
                  </div>
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
                <CardTitle>Produtos sem vendas</CardTitle>
                <CardDescription>
                  Mostrando {produtos.length} de {totalCount} produto{totalCount !== 1 ? 's' : ''} (página {currentPage} de {Math.ceil(totalCount / pageSize)})
                </CardDescription>
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
            <DataTable 
              columns={columns} 
              data={produtos}
              pageSize={100}
              showPagination={false}
            />
            
            {/* Paginação Server-Side */}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} produtos
                </div>
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
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
