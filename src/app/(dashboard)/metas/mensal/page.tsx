'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTenantContext } from '@/contexts/tenant-context'
import { useBranchesOptions } from '@/hooks/use-branches'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PlusIcon, ChevronDown, ChevronRight, Loader2, RefreshCw, Target, TrendingUp, CircleArrowDown, CircleArrowUp, FileDown, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { logModuleAccess } from '@/lib/audit'
import { createClient } from '@/lib/supabase/client'
import { DatePicker } from '@/components/ui/date-picker'
import { type FilialOption } from '@/components/filters'
import { MetasFilters } from '@/components/metas/filters'
import { PageHeader } from '@/components/dashboard/page-header'

interface Meta {
  id: number
  filial_id: number
  data: string
  dia_semana: string
  meta_percentual: number
  meta_margem_percentual?: number | null
  data_referencia: string
  valor_referencia: number
  valor_meta: number
  valor_realizado: number
  custo_realizado: number
  lucro_realizado: number
  margem_realizada?: number
  diferenca: number
  diferenca_percentual: number
}

interface MetasReport {
  metas: Meta[]
  total_realizado: number
  total_meta: number
  total_custo: number
  total_lucro: number
  percentual_atingido: number
  margem_bruta: number
}

interface MetaSummaryRow {
  filial_id: number
  valor_meta: number
  valor_meta_acumulada_d1: number
  valor_realizado: number
  percentual_atingido: number
  percentual_atingido_acumulado_d1: number
  meta_margem_percentual?: number | null
  lucro_bruto: number
  margem_bruta: number
}

interface MetaComprasRow {
  data: string
  filial_id: number
  valor_meta_compras: number | null
  valor_realizado_compras: number
}

interface MetaComprasSummaryRow {
  filial_id: number
  valor_meta_compras: number | null
  valor_realizado_compras: number
}

interface ComprasByDateMap {
  [date: string]: Record<number, MetaComprasSummaryRow>
}

interface GroupedByDate {
  [date: string]: {
    data: string
    dia_semana: string
    metas: Meta[]
    total_valor_referencia: number
    total_meta: number
    total_realizado: number
    total_custo: number
    total_lucro: number
    total_diferenca: number
    media_meta_percentual: number
    media_meta_margem_percentual: number
    diferenca_percentual: number
    margem_bruta: number
  }
}

interface LoadReportOptions {
  refreshRealized?: boolean
  forceRefreshRealized?: boolean
}

type PdfStatusDirection = 'up' | 'down' | null

interface PdfCellHookData {
  cell: {
    x: number
    y: number
    width: number
    height: number
    styles: {
      fontStyle?: string
      fillColor?: unknown
    }
  }
  column: {
    index: number
  }
  row: {
    index: number
    section: string
  }
  doc: {
    setFillColor: (r: number, g: number, b: number) => void
    triangle: (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      style: 'F' | 'FD' | 'DF' | 'S'
    ) => void
  }
}

const summaryFilialBadgeClasses = [
  'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-400/30',
  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-400/30',
  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30',
  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-400/30',
  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/30',
]

const weekdayBadgeClasses: Record<string, string> = {
  Domingo: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-200 dark:border-red-400/30',
  Segunda: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-400/30',
  Terca: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-400/30',
  Terça: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-400/30',
  Quarta: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/30',
  Quinta: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30',
  Sexta: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-400/30',
  Sabado: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-400/30',
  Sábado: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-400/30',
}

export default function MetaMensalPage() {
  const { currentTenant, userProfile } = useTenantContext()
  const [isClientReady, setIsClientReady] = useState(false)
  const { branchOptions: branches, isLoading: isLoadingBranches } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
    includeAll: false // Não incluir opção "Todas as Filiais"
  })

  const currentDate = new Date()
  const [mes, setMes] = useState(currentDate.getMonth() + 1)
  const [ano, setAno] = useState(currentDate.getFullYear())
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<FilialOption[]>([])
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<MetasReport | null>(null)
  const [summaryRows, setSummaryRows] = useState<MetaSummaryRow[]>([])
  const [comprasByDate, setComprasByDate] = useState<ComprasByDateMap>({})
  const [comprasSummaryByFilial, setComprasSummaryByFilial] = useState<Record<number, MetaComprasSummaryRow>>({})
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  // Estados do formulário de criação
  const [salesDialogOpen, setSalesDialogOpen] = useState(false)
  const [marginDialogOpen, setMarginDialogOpen] = useState(false)
  const [formMes, setFormMes] = useState(currentDate.getMonth() + 1)
  const [formAno, setFormAno] = useState(currentDate.getFullYear())
  const [formFilialId, setFormFilialId] = useState<string>('')
  const [formMetaPercentual, setFormMetaPercentual] = useState('')
  const [formMetaMargemPercentual, setFormMetaMargemPercentual] = useState('')
  const [formDataReferencia, setFormDataReferencia] = useState<Date | undefined>()
  const [isGeneratingSalesMeta, setIsGeneratingSalesMeta] = useState(false)
  const [isGeneratingMarginMeta, setIsGeneratingMarginMeta] = useState(false)

  // Estados para edição inline
  const [editingCell, setEditingCell] = useState<{ id: number; field: 'percentual' | 'valor' } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [isExportingSummaryPdf, setIsExportingSummaryPdf] = useState(false)
  const [isExportingSummaryXls, setIsExportingSummaryXls] = useState(false)
  const [isExportingSummaryCsv, setIsExportingSummaryCsv] = useState(false)
  const [isExportingDailyPdf, setIsExportingDailyPdf] = useState(false)
  const [isExportingDailyXls, setIsExportingDailyXls] = useState(false)
  const [isExportingDailyCsv, setIsExportingDailyCsv] = useState(false)
  const isExportingSummary = isExportingSummaryPdf || isExportingSummaryXls || isExportingSummaryCsv
  const isExportingDaily = isExportingDailyPdf || isExportingDailyXls || isExportingDailyCsv

  // Estado para botão atualizar valores
  const [isUpdatingValues, setIsUpdatingValues] = useState(false)
  const isRefreshingValuesRef = useRef(false)
  const lastUpdatedPeriodKeyRef = useRef('')
  const latestLoadRequestIdRef = useRef(0)
  const reportAbortControllerRef = useRef<AbortController | null>(null)
  const purchasesAbortControllerRef = useRef<AbortController | null>(null)
  const latestPurchasesRequestIdRef = useRef(0)

  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // Log audit on mount
  useEffect(() => {
    const logAccess = async () => {
      if (currentTenant && userProfile) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        logModuleAccess({
          module: 'metas',
          tenantId: currentTenant.id,
          userName: userProfile.full_name,
          userEmail: user?.email || ''
        })
      }
    }
    
    logAccess()
  }, [currentTenant, userProfile])

  useEffect(() => {
    lastUpdatedPeriodKeyRef.current = ''
    isRefreshingValuesRef.current = false
    latestLoadRequestIdRef.current = 0
    reportAbortControllerRef.current?.abort()
    reportAbortControllerRef.current = null
    latestPurchasesRequestIdRef.current = 0
    purchasesAbortControllerRef.current?.abort()
    purchasesAbortControllerRef.current = null
    setComprasByDate({})
    setComprasSummaryByFilial({})
    setIsLoadingPurchases(false)
  }, [currentTenant?.id])

  // Ao carregar filiais, selecionar todas por padrão e carregar dados
  useEffect(() => {
    if (!isLoadingBranches && branches && branches.length > 0 && filiaisSelecionadas.length === 0) {
      setFiliaisSelecionadas(branches)
      // Carregar dados automaticamente com todas as filiais
      loadReport(branches, mes, ano, { refreshRealized: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingBranches, branches, filiaisSelecionadas.length])

  const updateRealizedValues = async (
    mesParam: number,
    anoParam: number,
    force = false
  ) => {
    if (!currentTenant?.supabase_schema) return false

    const updateKey = `${currentTenant.supabase_schema}-${anoParam}-${mesParam}`
    const shouldRefresh = force || lastUpdatedPeriodKeyRef.current !== updateKey

    if (!shouldRefresh || isRefreshingValuesRef.current) {
      return false
    }

    isRefreshingValuesRef.current = true

    try {
      const updateResponse = await fetch('/api/metas/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentTenant.supabase_schema,
          mes: mesParam,
          ano: anoParam
        })
      })

      if (!updateResponse.ok) {
        console.warn('[METAS] ⚠️ Aviso: Não foi possível atualizar valores realizados')
        return false
      }

      await updateResponse.json()
      lastUpdatedPeriodKeyRef.current = updateKey
      return true
    } catch (error) {
      console.warn('[METAS] ⚠️ Falha ao atualizar valores realizados:', error)
      return false
    } finally {
      isRefreshingValuesRef.current = false
    }
  }

  const clearPurchasesState = () => {
    latestPurchasesRequestIdRef.current = 0
    purchasesAbortControllerRef.current?.abort()
    purchasesAbortControllerRef.current = null
    setComprasByDate({})
    setComprasSummaryByFilial({})
    setIsLoadingPurchases(false)
  }

  const loadPurchasesData = async (
    schema: string,
    filiais: FilialOption[],
    mesParam: number,
    anoParam: number
  ) => {
    const filialIds = filiais.map((filial) => filial.value).join(',')
    const requestId = latestPurchasesRequestIdRef.current + 1
    latestPurchasesRequestIdRef.current = requestId

    purchasesAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    purchasesAbortControllerRef.current = abortController

    setIsLoadingPurchases(true)

    try {
      const params = new URLSearchParams({
        schema,
        mes: mesParam.toString(),
        ano: anoParam.toString(),
      })

      if (filialIds) {
        params.append('filial_id', filialIds)
      }

      const response = await fetch(`/api/metas/compras?${params}`, {
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar compras das metas')
      }

      const data = await response.json() as {
        report?: MetaComprasRow[]
        resumo?: MetaComprasSummaryRow[]
      }

      if (latestPurchasesRequestIdRef.current !== requestId) {
        return
      }

      const comprasDateMap: ComprasByDateMap = {}
      const comprasSummaryMap: Record<number, MetaComprasSummaryRow> = {}

      for (const row of data.report ?? []) {
        if (!comprasDateMap[row.data]) {
          comprasDateMap[row.data] = {}
        }

        comprasDateMap[row.data][row.filial_id] = {
          filial_id: row.filial_id,
          valor_meta_compras: row.valor_meta_compras,
          valor_realizado_compras: row.valor_realizado_compras,
        }
      }

      for (const row of data.resumo ?? []) {
        comprasSummaryMap[row.filial_id] = row
      }

      setComprasByDate(comprasDateMap)
      setComprasSummaryByFilial(comprasSummaryMap)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('[METAS] ❌ Error loading purchases:', error)

      if (latestPurchasesRequestIdRef.current === requestId) {
        setComprasByDate({})
        setComprasSummaryByFilial({})
      }
    } finally {
      if (latestPurchasesRequestIdRef.current === requestId) {
        setIsLoadingPurchases(false)
      }

      if (purchasesAbortControllerRef.current === abortController) {
        purchasesAbortControllerRef.current = null
      }
    }
  }

  const loadReport = async (
    filiais?: FilialOption[],
    mesParam?: number,
    anoParam?: number,
    options: LoadReportOptions = {}
  ) => {
    if (!currentTenant?.supabase_schema) return

    // Usar parâmetros passados ou estados atuais
    const filiaisToUse = filiais !== undefined ? filiais : filiaisSelecionadas
    const mesToUse = mesParam !== undefined ? mesParam : mes
    const anoToUse = anoParam !== undefined ? anoParam : ano
    const requestId = latestLoadRequestIdRef.current + 1
    latestLoadRequestIdRef.current = requestId

    reportAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    reportAbortControllerRef.current = abortController

    setComprasByDate({})
    setComprasSummaryByFilial({})
    setIsLoadingPurchases(false)
    purchasesAbortControllerRef.current?.abort()
    purchasesAbortControllerRef.current = null

    setLoading(true)
    try {
      if (options.refreshRealized || options.forceRefreshRealized) {
        await updateRealizedValues(
          mesToUse,
          anoToUse,
          options.forceRefreshRealized === true
        )
      }

      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema,
        mes: mesToUse.toString(),
        ano: anoToUse.toString()
      })

      // Se tiver filiais selecionadas, buscar apenas as selecionadas
      if (filiaisToUse.length > 0) {
        const filialIds = filiaisToUse
          .map(f => f.value)
          .join(',')

        params.append('filial_id', filialIds)
      }

      const [response, summaryResponse] = await Promise.all([
        fetch(`/api/metas/report?${params}`, {
          signal: abortController.signal
        }),
        fetch(`/api/metas/summary?${params}`, {
          signal: abortController.signal
        })
      ])

      if (!response.ok) {
        let errorMessage = 'Erro ao carregar relatório'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
        console.error('Error response:', errorMessage)
        throw new Error(errorMessage)
      }

      if (!summaryResponse.ok) {
        let errorMessage = 'Erro ao carregar resumo'
        try {
          const errorData = await summaryResponse.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await summaryResponse.text()
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const [data, summaryData] = await Promise.all([
        response.json(),
        summaryResponse.json()
      ])
      if (latestLoadRequestIdRef.current === requestId) {
        setReport(data)
        setSummaryRows(summaryData.resumo || [])
        void loadPurchasesData(
          currentTenant.supabase_schema,
          filiaisToUse,
          mesToUse,
          anoToUse
        )
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('[METAS] ❌ Error loading report:', error)
      if (latestLoadRequestIdRef.current === requestId) {
        // Não mostrar alert, apenas setar report vazio para permitir uso do módulo
        setReport({
          metas: [],
          total_realizado: 0,
          total_meta: 0,
          total_custo: 0,
          total_lucro: 0,
          percentual_atingido: 0,
          margem_bruta: 0
        })
        setSummaryRows([])
        clearPurchasesState()
      }
    } finally {
      if (latestLoadRequestIdRef.current === requestId) {
        setLoading(false)
      }

      if (reportAbortControllerRef.current === abortController) {
        reportAbortControllerRef.current = null
      }
    }
  }

  // Handler para aplicar filtros
  const handleFilter = (filiais: FilialOption[], mesParam: number, anoParam: number) => {
    if (!currentTenant?.supabase_schema) return

    // Atualizar os estados
    setFiliaisSelecionadas(filiais)
    setMes(mesParam)
    setAno(anoParam)
    
    // Carregar com os parâmetros diretamente para evitar delay de state
    loadReport(filiais, mesParam, anoParam, { refreshRealized: true })
  }

  const reloadCurrentReport = () => {
    lastUpdatedPeriodKeyRef.current = ''
    loadReport(filiaisSelecionadas, mes, ano, { refreshRealized: true })
  }

  const handleGenerateSalesMeta = async () =>  {
    if (!currentTenant?.supabase_schema) return
    if (!formFilialId || !formMetaPercentual || !formDataReferencia) {
      toast.error('Campos obrigatórios', {
        description: 'Preencha todos os campos para gerar a meta de vendas'
      })
      return
    }

    setIsGeneratingSalesMeta(true)
    try {
      const response = await fetch('/api/metas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentTenant.supabase_schema,
          filialId: parseInt(formFilialId, 10),
          mes: formMes,
          ano: formAno,
          metaPercentual: parseFloat(formMetaPercentual),
          metaMargemPercentual: null,
          dataReferenciaInicial: format(formDataReferencia, 'yyyy-MM-dd')
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Meta de vendas gerada com sucesso', {
          description: data.message || `${data.metas_criadas || 31} metas criadas para o período`
        })
        setSalesDialogOpen(false)
        reloadCurrentReport()
      } else {
        toast.error('Erro ao gerar meta de vendas', {
          description: data.error || 'Verifique os dados e tente novamente'
        })
      }
    } catch (error) {
      console.error('Error generating sales metas:', error)
      toast.error('Erro ao gerar meta de vendas', {
        description: 'Ocorreu um erro inesperado. Tente novamente.'
      })
    } finally {
      setIsGeneratingSalesMeta(false)
    }
  }

  const handleGenerateMarginMeta = async () =>  {
    if (!currentTenant?.supabase_schema) return
    if (!formFilialId || !formMetaMargemPercentual) {
      toast.error('Campos obrigatórios', {
        description: 'Preencha todos os campos para gerar a meta de margem'
      })
      return
    }

    setIsGeneratingMarginMeta(true)
    try {
      const response = await fetch('/api/metas/generate-margin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentTenant.supabase_schema,
          filialId: parseInt(formFilialId, 10),
          mes: formMes,
          ano: formAno,
          metaMargemPercentual: parseFloat(formMetaMargemPercentual)
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Meta de margem gerada com sucesso', {
          description: data.message || `${data.metas_atualizadas || 0} metas atualizadas para o período`
        })
        setMarginDialogOpen(false)
        reloadCurrentReport()
      } else {
        toast.error('Erro ao gerar meta de margem', {
          description: data.error || 'Verifique os dados e tente novamente'
        })
      }
    } catch (error) {
      console.error('Error generating margin metas:', error)
      toast.error('Erro ao gerar meta de margem', {
        description: 'Ocorreu um erro inesperado. Tente novamente.'
      })
    } finally {
      setIsGeneratingMarginMeta(false)
    }
  }

  const handleUpdateValues = async () => {
    setIsUpdatingValues(true)
    try {
      // Recarregar o relatório com os filtros atuais
      await loadReport(filiaisSelecionadas, mes, ano, { forceRefreshRealized: true })
    } finally {
      setIsUpdatingValues(false)
    }
  }

  // Não mais necessário, carregamento feito no useEffect de seleção das filiais

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatPlainPercentage = (value: number | null) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00%'
    return `${value.toFixed(2)}%`
  }

  // Verificar se a data é hoje ou futuro
  const isTodayOrFuture = (dateString: string): boolean => {
    const metaDate = parseISO(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    metaDate.setHours(0, 0, 0, 0)
    return metaDate >= today
  }

  // Verificar se deve mostrar diferença (não mostra se for dia futuro com realizado zero)
  const shouldShowDifference = (meta: Meta): boolean => {
    // Se é hoje ou futuro E realizado é zero, não mostra diferença
    if (isTodayOrFuture(meta.data) && meta.valor_realizado === 0) {
      return false
    }
    return true
  }

  const getMargemRealizada = (valorRealizado: number, lucroRealizado: number) => {
    if (valorRealizado <= 0) return 0
    return (lucroRealizado / valorRealizado) * 100
  }

  const renderMetaMargemStatus = (
    metaMargemPercentual: number | null | undefined
  ) => {
    if (metaMargemPercentual == null || metaMargemPercentual <= 0) {
      return '-'
    }
    return formatPlainPercentage(metaMargemPercentual)
  }

  const getStatusDirection = (
    condition: boolean,
    shouldDisplayStatus: boolean
  ): PdfStatusDirection => {
    if (!shouldDisplayStatus) return null
    return condition ? 'up' : 'down'
  }

  const formatPdfStatusValue = (value: string, direction: PdfStatusDirection) => {
    return direction ? `   ${value}` : value
  }

  const drawPdfStatusIcon = (
    data: PdfCellHookData,
    statusMatrix: PdfStatusDirection[][]
  ) => {
    if (data.row.section !== 'body') return

    const direction = statusMatrix[data.row.index]?.[data.column.index] ?? null
    if (!direction) return

    const centerX = data.cell.x + 2.6
    const centerY = data.cell.y + (data.cell.height / 2)
    const size = 1.1

    if (direction === 'up') {
      data.doc.setFillColor(22, 163, 74)
      data.doc.triangle(
        centerX,
        centerY - size,
        centerX - size,
        centerY + size,
        centerX + size,
        centerY + size,
        'F'
      )
      return
    }

    data.doc.setFillColor(220, 38, 38)
    data.doc.triangle(
      centerX - size,
      centerY - size,
      centerX + size,
      centerY - size,
      centerX,
      centerY + size,
      'F'
    )
  }

  const branchNamesById = useMemo(() => {
    return new Map(
      branches.map((branch) => [branch.value, branch.label])
    )
  }, [branches])

  const getFilialName = (filial_id: number) => {
    return branchNamesById.get(filial_id.toString()) ?? `Filial ${filial_id}`
  }

  const getSummaryFilialBadgeClass = (filialId: number) => {
    return summaryFilialBadgeClasses[Math.abs(filialId) % summaryFilialBadgeClasses.length]
  }

  const getWeekdayBadgeClass = (weekday: string) => {
    return weekdayBadgeClasses[weekday] ?? 'bg-muted text-foreground border-border'
  }

  const toggleDateExpanded = (date: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }))
  }

  const groupMetasByDate = (metas: Meta[]): GroupedByDate => {
    const grouped: GroupedByDate = {}

    metas.forEach((meta) => {
      const dateKey = meta.data

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          data: meta.data,
          dia_semana: meta.dia_semana,
          metas: [],
          total_valor_referencia: 0,
          total_meta: 0,
          total_realizado: 0,
          total_custo: 0,
          total_lucro: 0,
          total_diferenca: 0,
          media_meta_percentual: 0,
          media_meta_margem_percentual: 0,
          diferenca_percentual: 0,
          margem_bruta: 0
        }
      }

      grouped[dateKey].metas.push(meta)
      grouped[dateKey].total_valor_referencia += meta.valor_referencia || 0
      grouped[dateKey].total_meta += meta.valor_meta || 0
      grouped[dateKey].total_realizado += meta.valor_realizado || 0
      grouped[dateKey].total_custo += meta.custo_realizado || 0
      grouped[dateKey].total_lucro += meta.lucro_realizado || 0
      grouped[dateKey].total_diferenca += meta.diferenca || 0
    })

    // Calcular média, percentuais e margem
    Object.keys(grouped).forEach(dateKey => {
      const group = grouped[dateKey]
      const numFiliais = group.metas.length

      if (numFiliais > 0) {
        group.media_meta_percentual = group.metas.reduce((sum, m) => sum + (m.meta_percentual || 0), 0) / numFiliais
        group.media_meta_margem_percentual = group.metas.reduce((sum, m) => sum + (m.meta_margem_percentual || 0), 0) / numFiliais

        if (group.total_meta > 0) {
          group.diferenca_percentual = ((group.total_realizado - group.total_meta) / group.total_meta) * 100
        }

        // Calcular margem bruta do dia
        if (group.total_realizado > 0) {
          group.margem_bruta = (group.total_lucro / group.total_realizado) * 100
        }
      }
    })

    return grouped
  }

  const filteredMetas = useMemo(() => {
    const reportMetas = report?.metas ?? []

    return reportMetas
      .filter((meta) => {
        const [year, month] = meta.data.split('-').map(Number)
        return month === mes && year === ano
      })
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  }, [report?.metas, mes, ano])

  const groupedEntries = useMemo(() => {
    return Object.entries(groupMetasByDate(filteredMetas)).sort(([dateA], [dateB]) => {
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })
  }, [filteredMetas])

  const selectedMonthYearLabel = useMemo(() => {
    return format(new Date(ano, mes - 1, 1), 'MMMM/yyyy', { locale: ptBR })
  }, [ano, mes])

  const isCurrentSelectedMonth = useMemo(() => {
    const today = new Date()
    return today.getFullYear() === ano && today.getMonth() + 1 === mes
  }, [ano, mes])

  const visibleSummaryRows = useMemo(() => {
    return summaryRows.filter((row) => row.valor_meta > 0)
  }, [summaryRows])

  const summaryTotals = useMemo(() => {
    const valorMeta = visibleSummaryRows.reduce((sum, row) => sum + row.valor_meta, 0)
    const valorRealizado = visibleSummaryRows.reduce((sum, row) => sum + row.valor_realizado, 0)
    const valorMetaAcumuladaD1 = visibleSummaryRows.reduce((sum, row) => sum + row.valor_meta_acumulada_d1, 0)
    const lucroBruto = visibleSummaryRows.reduce((sum, row) => sum + row.lucro_bruto, 0)
    const metaMargemRows = visibleSummaryRows.filter((row) => row.meta_margem_percentual != null)
    const metaComprasRows = visibleSummaryRows
      .map((row) => comprasSummaryByFilial[row.filial_id]?.valor_meta_compras)
      .filter((value): value is number => value != null)
    const realizadoComprasRows = visibleSummaryRows
      .map((row) => comprasSummaryByFilial[row.filial_id]?.valor_realizado_compras)
      .filter((value): value is number => value != null)
    const mediaMetaMargem = metaMargemRows.length > 0
      ? metaMargemRows.reduce((sum, row) => sum + (row.meta_margem_percentual || 0), 0) / metaMargemRows.length
      : null

    return {
      valorMeta,
      valorRealizado,
      percentualAtingido: valorMeta > 0 ? (valorRealizado / valorMeta) * 100 : 0,
      valorMetaAcumuladaD1,
      percentualAtingidoAcumuladoD1: valorMetaAcumuladaD1 > 0 ? (valorRealizado / valorMetaAcumuladaD1) * 100 : 0,
      mediaMetaMargem,
      lucroBruto,
      margemBruta: valorRealizado > 0 ? (lucroBruto / valorRealizado) * 100 : 0,
      valorMetaCompras: metaComprasRows.reduce((sum, value) => sum + value, 0),
      valorRealizadoCompras: realizadoComprasRows.reduce((sum, value) => sum + value, 0),
      hasMetaCompras: metaComprasRows.length > 0,
      hasRealizadoCompras: realizadoComprasRows.length > 0,
    }
  }, [comprasSummaryByFilial, visibleSummaryRows])

  const getPurchasesByDateAndFilial = (date: string, filialId: number) => {
    return comprasByDate[date]?.[filialId]
  }

  const getPurchaseSummaryByFilial = (filialId: number) => {
    return comprasSummaryByFilial[filialId]
  }

  const getCompraSobreVendaPercent = (
    valorRealizadoCompras: number | null | undefined,
    valorRealizadoVendas: number | null | undefined
  ) => {
    if (valorRealizadoCompras == null || valorRealizadoVendas == null || valorRealizadoVendas <= 0) {
      return null
    }

    return (valorRealizadoCompras / valorRealizadoVendas) * 100
  }

  const renderLoadingCurrency = (value: number | null | undefined, allowNull = false) => {
    if (isLoadingPurchases) {
      return <span className="text-muted-foreground">Carregando...</span>
    }

    if (value == null) {
      return allowNull ? <span className="text-muted-foreground">-</span> : formatCurrency(0)
    }

    return formatCurrency(value)
  }

  const renderLoadingPercentage = (value: number | null | undefined) => {
    if (isLoadingPurchases) {
      return <span className="text-muted-foreground">Carregando...</span>
    }

    if (value == null) {
      return <span className="text-muted-foreground">-</span>
    }

    return formatPlainPercentage(value)
  }

  // Funções de edição inline
  const startEditing = (metaId: number, field: 'percentual' | 'valor', currentValue: number) => {
    setEditingCell({ id: metaId, field })
    setEditingValue(field === 'percentual' ? currentValue.toFixed(2) : currentValue.toFixed(2))
  }

  const cancelEditing = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const saveEdit = async () => {
    if (!editingCell || !currentTenant?.supabase_schema) return

    const newValue = parseFloat(editingValue)
    if (isNaN(newValue)) {
      toast.error('Valor inválido', {
        description: 'Digite um número válido'
      })
      return
    }



    setSavingEdit(true)

    try {
      const meta = report?.metas.find(m => m.id === editingCell.id)
      if (!meta) {
        toast.error('Meta não encontrada', {
          description: 'Não foi possível localizar a meta para edição'
        })
        setSavingEdit(false)
        cancelEditing()
        return
      }

      let valorMeta: number
      let metaPercentual: number

      if (editingCell.field === 'percentual') {
        // Usuário alterou o percentual
        metaPercentual = newValue
        valorMeta = meta.valor_referencia * (1 + metaPercentual / 100)
      } else {
        // Usuário alterou o valor da meta
        valorMeta = newValue
        // Tratar divisão por zero quando valor_referencia = 0 ou null
        if (meta.valor_referencia === 0 || meta.valor_referencia === null || !meta.valor_referencia) {
          metaPercentual = 0  // Não é possível calcular % sem referência
        } else {
          metaPercentual = ((valorMeta / meta.valor_referencia) - 1) * 100
        }
      }

      const requestBody = {
        schema: currentTenant.supabase_schema,
        metaId: editingCell.id,
        valorMeta,
        metaPercentual
      }

      const response = await fetch('/api/metas/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[METAS] ❌ Erro ao atualizar:', { 
          status: response.status, 
          statusText: response.statusText,
          error,
          requestBody,
          errorDetails: error.details
        })
        
        // Formatar mensagem de erro mais detalhada
        let errorMsg = 'Erro ao atualizar meta'
        if (error.details) {
          const detailsMsg = Object.entries(error.details)
            .map(([key, msgs]) => `${key}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('\n')
          errorMsg = `Erro de validação:\n${detailsMsg}`
        } else if (error.error) {
          errorMsg = error.error
        }
        
        throw new Error(errorMsg)
      }

      // Atualizar estado local
      setReport(prev => {
        if (!prev) return prev
        
        const updatedMetas = prev.metas.map(m => {
          if (m.id === editingCell.id) {
            const diferenca = m.valor_realizado - valorMeta
            const diferenca_percentual = valorMeta > 0 ? (diferenca / valorMeta) * 100 : 0
            
            return {
              ...m,
              meta_percentual: metaPercentual,
              valor_meta: valorMeta,
              diferenca,
              diferenca_percentual
            }
          }
          return m
        })

        // Recalcular totais
        const total_meta = updatedMetas.reduce((sum, m) => sum + m.valor_meta, 0)
        const percentual_atingido = total_meta > 0 ? (prev.total_realizado / total_meta) * 100 : 0

        return {
          ...prev,
          metas: updatedMetas,
          total_meta,
          percentual_atingido
        }
      })

      toast.success('Meta atualizada', {
        description: `${editingCell.field === 'percentual' ? 'Percentual' : 'Valor'} alterado com sucesso`
      })
      cancelEditing()
    } catch (error) {
      console.error('Error saving edit:', error)
      toast.error('Erro ao atualizar meta', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const buildSummaryExportData = () => {
    const headers = [
      'Filial',
      'Valor Meta Mês',
      'Valor Realizado Mês',
      '% Atingido Mês',
      ...(isCurrentSelectedMonth ? ['Valor Meta Acumulada', '% Atingido Acumulado'] : []),
      'Lucro Bruto',
      'Meta Margem',
      'Margem Bruta',
      'Meta Compras',
      'Realizado Compras',
      '% Comp./Venda',
    ]
    const rows: string[][] = []
    const statusMatrix: PdfStatusDirection[][] = []

    visibleSummaryRows.forEach((row) => {
      const comprasResumo = getPurchaseSummaryByFilial(row.filial_id)
      const compraSobreVenda = getCompraSobreVendaPercent(
        comprasResumo?.valor_realizado_compras,
        row.valor_realizado
      )
      const rowCells: string[] = []
      const rowStatuses: PdfStatusDirection[] = []

      rowCells.push(getFilialName(row.filial_id))
      rowStatuses.push(null)

      rowCells.push(formatCurrency(row.valor_meta))
      rowStatuses.push(null)

      rowCells.push(formatCurrency(row.valor_realizado))
      rowStatuses.push(null)

      const atingidoMesDirection = isCurrentSelectedMonth
        ? null
        : getStatusDirection(row.percentual_atingido >= 100, true)
      rowCells.push(formatPlainPercentage(row.percentual_atingido))
      rowStatuses.push(atingidoMesDirection)

      if (isCurrentSelectedMonth) {
        rowCells.push(formatCurrency(row.valor_meta_acumulada_d1))
        rowStatuses.push(null)

        const acumuladoDirection = getStatusDirection(row.percentual_atingido_acumulado_d1 >= 100, true)
        rowCells.push(formatPlainPercentage(row.percentual_atingido_acumulado_d1))
        rowStatuses.push(acumuladoDirection)
      }

      rowCells.push(formatCurrency(row.lucro_bruto))
      rowStatuses.push(null)

      const metaMargemDirection = row.meta_margem_percentual != null && row.meta_margem_percentual > 0
        ? getStatusDirection(row.margem_bruta >= row.meta_margem_percentual, true)
        : null
      rowCells.push(
        row.meta_margem_percentual != null && row.meta_margem_percentual > 0
          ? formatPlainPercentage(row.meta_margem_percentual)
          : '-'
      )
      rowStatuses.push(metaMargemDirection)

      rowCells.push(formatPlainPercentage(row.margem_bruta))
      rowStatuses.push(null)

      rowCells.push(
        comprasResumo?.valor_meta_compras != null
          ? formatCurrency(comprasResumo.valor_meta_compras)
          : '-'
      )
      rowStatuses.push(null)

      rowCells.push(
        comprasResumo?.valor_realizado_compras != null
          ? formatCurrency(comprasResumo.valor_realizado_compras)
          : '-'
      )
      rowStatuses.push(null)

      rowCells.push(compraSobreVenda != null ? formatPlainPercentage(compraSobreVenda) : '-')
      rowStatuses.push(null)

      rows.push(rowCells)
      statusMatrix.push(rowStatuses)
    })

    const totalCells: string[] = []
    const totalStatuses: PdfStatusDirection[] = []

    totalCells.push('Todas')
    totalStatuses.push(null)
    totalCells.push(formatCurrency(summaryTotals.valorMeta))
    totalStatuses.push(null)
    totalCells.push(formatCurrency(summaryTotals.valorRealizado))
    totalStatuses.push(null)

    const totalAtingidoDirection = isCurrentSelectedMonth
      ? null
      : getStatusDirection(summaryTotals.percentualAtingido >= 100, true)
    totalCells.push(formatPlainPercentage(summaryTotals.percentualAtingido))
    totalStatuses.push(totalAtingidoDirection)

    if (isCurrentSelectedMonth) {
      totalCells.push(formatCurrency(summaryTotals.valorMetaAcumuladaD1))
      totalStatuses.push(null)

      const totalAcumuladoDirection = getStatusDirection(summaryTotals.percentualAtingidoAcumuladoD1 >= 100, true)
      totalCells.push(formatPlainPercentage(summaryTotals.percentualAtingidoAcumuladoD1))
      totalStatuses.push(totalAcumuladoDirection)
    }

    totalCells.push(formatCurrency(summaryTotals.lucroBruto))
    totalStatuses.push(null)

    const totalMetaMargemDirection = summaryTotals.mediaMetaMargem != null && summaryTotals.mediaMetaMargem > 0
      ? getStatusDirection(summaryTotals.margemBruta >= summaryTotals.mediaMetaMargem, true)
      : null
    totalCells.push(
      summaryTotals.mediaMetaMargem != null && summaryTotals.mediaMetaMargem > 0
        ? formatPlainPercentage(summaryTotals.mediaMetaMargem)
        : '-'
    )
    totalStatuses.push(totalMetaMargemDirection)

    totalCells.push(formatPlainPercentage(summaryTotals.margemBruta))
    totalStatuses.push(null)

    totalCells.push(summaryTotals.hasMetaCompras ? formatCurrency(summaryTotals.valorMetaCompras) : '-')
    totalStatuses.push(null)

    totalCells.push(summaryTotals.hasRealizadoCompras ? formatCurrency(summaryTotals.valorRealizadoCompras) : '-')
    totalStatuses.push(null)

    const compraSobreVendaTotal = getCompraSobreVendaPercent(
      summaryTotals.hasRealizadoCompras ? summaryTotals.valorRealizadoCompras : null,
      summaryTotals.valorRealizado
    )
    totalCells.push(compraSobreVendaTotal != null ? formatPlainPercentage(compraSobreVendaTotal) : '-')
    totalStatuses.push(null)

    rows.push(totalCells)
    statusMatrix.push(totalStatuses)

    return {
      headers,
      rows,
      statusMatrix,
    }
  }

  const getSummaryExportFilename = (extension: 'pdf' | 'xlsx' | 'csv') => {
    return `resumo-meta-mensal-${mes.toString().padStart(2, '0')}-${ano}.${extension}`
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleExportSummaryPdf = async () => {
    if (visibleSummaryRows.length === 0) return

    try {
      setIsExportingSummaryPdf(true)

      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const { headers, rows, statusMatrix } = buildSummaryExportData()
      const body = rows.map((row, rowIndex) =>
        row.map((cell, columnIndex) =>
          formatPdfStatusValue(cell, statusMatrix[rowIndex]?.[columnIndex] ?? null)
        )
      )

      doc.setFontSize(16)
      doc.text(`Resumo Meta mensal: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)}`, 14, 16)
      doc.setFontSize(10)
      doc.text('Resumo mensal da Meta', 14, 22)

      autoTable(doc as never, {
        startY: 28,
        head: [headers],
        body,
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
        },
        footStyles: {
          fillColor: [226, 232, 240],
          textColor: [15, 23, 42],
        },
        didParseCell: (data: PdfCellHookData) => {
          if (data.row.index === body.length - 1 && data.row.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [248, 250, 252]
          }
        },
        didDrawCell: (data: PdfCellHookData) => {
          drawPdfStatusIcon(data, statusMatrix)
        },
      })

      doc.save(getSummaryExportFilename('pdf'))
    } catch (error) {
      console.error('Error exporting summary PDF:', error)
      toast.error('Erro ao exportar PDF', {
        description: 'Não foi possível gerar o PDF do resumo.'
      })
    } finally {
      setIsExportingSummaryPdf(false)
    }
  }

  const handleExportSummaryXls = async () => {
    if (visibleSummaryRows.length === 0) return

    try {
      setIsExportingSummaryXls(true)

      const ExcelJS = await import('exceljs')
      const { headers, rows } = buildSummaryExportData()
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Resumo Meta Mensal')

      worksheet.views = [{ state: 'frozen', ySplit: 1 }]
      worksheet.addRow(headers)
      worksheet.addRows(rows)

      headers.forEach((header, index) => {
        const column = worksheet.getColumn(index + 1)
        column.width = Math.max(16, Math.min(24, header.length + 4))
        column.alignment = { vertical: 'middle', wrapText: true }
      })

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FF0F172A' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      }
      headerRow.alignment = { vertical: 'middle', wrapText: true }

      const totalRow = worksheet.getRow(worksheet.rowCount)
      totalRow.font = { bold: true, color: { argb: 'FF0F172A' } }
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      }

      const buffer = await workbook.xlsx.writeBuffer()
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        getSummaryExportFilename('xlsx')
      )
    } catch (error) {
      console.error('Error exporting summary XLS:', error)
      toast.error('Erro ao exportar XLS', {
        description: 'Não foi possível gerar a planilha do resumo.'
      })
    } finally {
      setIsExportingSummaryXls(false)
    }
  }

  const escapeCsvValue = (value: string) => {
    const normalizedValue = value.replace(/\r?\n/g, ' ')

    if (/[";\r\n]/.test(normalizedValue)) {
      return `"${normalizedValue.replace(/"/g, '""')}"`
    }

    return normalizedValue
  }

  const handleExportSummaryCsv = () => {
    if (visibleSummaryRows.length === 0) return

    try {
      setIsExportingSummaryCsv(true)

      const { headers, rows } = buildSummaryExportData()
      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(';'))
        .join('\r\n')

      downloadBlob(
        new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' }),
        getSummaryExportFilename('csv')
      )
    } catch (error) {
      console.error('Error exporting summary CSV:', error)
      toast.error('Erro ao exportar CSV', {
        description: 'Não foi possível gerar o CSV do resumo.'
      })
    } finally {
      setIsExportingSummaryCsv(false)
    }
  }

  const buildDailyExportData = () => {
    const headers = filiaisSelecionadas.length !== 1
      ? [
            'Data',
            'Dia da Semana',
            'Valor Referência',
            '% Meta',
            'Valor Meta',
            'Valor Realizado',
            '% Atingido',
            'Lucro Bruto',
            'Meta Margem',
            'Margem Bruta',
            'Meta Compras',
            'Realizado Compras',
            '% Comp./Venda',
          ]
      : [
            'Data',
            'Dia da Semana',
            'Data Ref.',
            'Valor Referência',
            '% Meta',
            'Valor Meta',
            'Valor Realizado',
            '% Atingido',
            'Lucro Bruto',
            'Meta Margem',
            'Margem Bruta',
            'Meta Compras',
            'Realizado Compras',
            '% Comp./Venda',
          ]

    const rows: string[][] = []
    const statusMatrix: PdfStatusDirection[][] = []

    if (filiaisSelecionadas.length !== 1) {
      groupedEntries.forEach(([dateKey, group]) => {
        const comprasDoDia = group.metas.reduce(
          (acc, meta) => {
            const compra = getPurchasesByDateAndFilial(meta.data, meta.filial_id)
            return {
              valorMetaCompras: acc.valorMetaCompras + (compra?.valor_meta_compras ?? 0),
              valorRealizadoCompras: acc.valorRealizadoCompras + (compra?.valor_realizado_compras ?? 0),
              hasMetaCompras: acc.hasMetaCompras || compra?.valor_meta_compras != null,
              hasRealizadoCompras: acc.hasRealizadoCompras || compra?.valor_realizado_compras != null,
            }
          },
          {
            valorMetaCompras: 0,
            valorRealizadoCompras: 0,
            hasMetaCompras: false,
            hasRealizadoCompras: false,
          }
        )
        const percentualAtingidoDia = group.total_meta > 0
          ? (group.total_realizado / group.total_meta) * 100
          : 0
        const margemRealizadaDia = getMargemRealizada(group.total_realizado, group.total_lucro)
        const isDateFuture = isTodayOrFuture(dateKey)
        const hasNoSales = group.total_realizado === 0
        const showDifference = !(isDateFuture && hasNoSales)
        const margemDirection = group.media_meta_margem_percentual > 0
          ? getStatusDirection(margemRealizadaDia >= group.media_meta_margem_percentual, showDifference)
          : null
        const atingidoDirection = getStatusDirection(percentualAtingidoDia >= 100, showDifference)
        const compraSobreVenda = getCompraSobreVendaPercent(
          comprasDoDia.hasRealizadoCompras ? comprasDoDia.valorRealizadoCompras : null,
          group.total_realizado
        )

        rows.push([
          format(parseISO(group.data), 'dd/MM/yyyy'),
          group.metas[0]?.dia_semana || '-',
          formatCurrency(group.total_valor_referencia),
          formatPlainPercentage(group.media_meta_percentual),
          formatCurrency(group.total_meta),
          formatCurrency(group.total_realizado),
          showDifference ? formatPlainPercentage(percentualAtingidoDia) : '-',
          showDifference ? formatCurrency(group.total_lucro) : '-',
          group.media_meta_margem_percentual > 0
            ? formatPlainPercentage(group.media_meta_margem_percentual)
            : '-',
          showDifference ? formatPlainPercentage(group.margem_bruta) : '-',
          comprasDoDia.hasMetaCompras ? formatCurrency(comprasDoDia.valorMetaCompras) : '-',
          comprasDoDia.hasRealizadoCompras ? formatCurrency(comprasDoDia.valorRealizadoCompras) : '-',
          compraSobreVenda != null ? formatPlainPercentage(compraSobreVenda) : '-',
        ])

        statusMatrix.push([
          null,
          null,
          null,
          null,
          null,
          null,
          atingidoDirection,
          null,
          margemDirection,
          null,
          null,
          null,
          null,
        ])
      })
    } else {
      filteredMetas.forEach((meta) => {
        const compra = getPurchasesByDateAndFilial(meta.data, meta.filial_id)
        const percentualAtingidoMeta = meta.valor_meta > 0
          ? (meta.valor_realizado / meta.valor_meta) * 100
          : 0
        const margem = getMargemRealizada(meta.valor_realizado, meta.lucro_realizado || 0)
        const showDiff = shouldShowDifference(meta)
        const atingidoDirection = getStatusDirection(percentualAtingidoMeta >= 100, showDiff)
        const margemDirection = meta.meta_margem_percentual != null && meta.meta_margem_percentual > 0
          ? getStatusDirection(margem >= meta.meta_margem_percentual, showDiff)
          : null
        const compraSobreVenda = getCompraSobreVendaPercent(
          compra?.valor_realizado_compras,
          meta.valor_realizado
        )

        rows.push([
          format(parseISO(meta.data), 'dd/MM/yyyy'),
          meta.dia_semana,
          meta.data_referencia ? format(parseISO(meta.data_referencia), 'dd/MM/yyyy') : '-',
          formatCurrency(meta.valor_referencia),
          formatPlainPercentage(meta.meta_percentual),
          formatCurrency(meta.valor_meta),
          formatCurrency(meta.valor_realizado),
          showDiff ? formatPlainPercentage(percentualAtingidoMeta) : '-',
          showDiff ? formatCurrency(meta.lucro_realizado || 0) : '-',
          meta.meta_margem_percentual != null && meta.meta_margem_percentual > 0
            ? formatPlainPercentage(meta.meta_margem_percentual)
            : '-',
          showDiff ? formatPlainPercentage(margem) : '-',
          compra?.valor_meta_compras != null ? formatCurrency(compra.valor_meta_compras) : '-',
          compra?.valor_realizado_compras != null ? formatCurrency(compra.valor_realizado_compras) : '-',
          compraSobreVenda != null ? formatPlainPercentage(compraSobreVenda) : '-',
        ])

        statusMatrix.push([
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          atingidoDirection,
          null,
          margemDirection,
          null,
          null,
          null,
          null,
        ])
      })
    }

    return {
      headers,
      rows,
      statusMatrix,
    }
  }

  const getDailyExportFilename = (extension: 'pdf' | 'xlsx' | 'csv') => {
    return `metas-diarias-${mes.toString().padStart(2, '0')}-${ano}.${extension}`
  }

  const handleExportDailyPdf = async () => {
    if (filteredMetas.length === 0) return

    try {
      setIsExportingDailyPdf(true)

      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const { headers, rows, statusMatrix } = buildDailyExportData()
      const body = rows.map((row, rowIndex) =>
        row.map((cell, columnIndex) =>
          formatPdfStatusValue(cell, statusMatrix[rowIndex]?.[columnIndex] ?? null)
        )
      )

      doc.setFontSize(16)
      doc.text(`Resumo de Metas por Dia: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)}`, 14, 16)
      doc.setFontSize(10)
      doc.text('Acompanhamento detalhado por dia', 14, 22)

      autoTable(doc as never, {
        startY: 28,
        head: [headers],
        body,
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
        },
        didDrawCell: (data: PdfCellHookData) => {
          drawPdfStatusIcon(data, statusMatrix)
        },
      })

      doc.save(getDailyExportFilename('pdf'))
    } catch (error) {
      console.error('Error exporting daily PDF:', error)
      toast.error('Erro ao exportar PDF', {
        description: 'Não foi possível gerar o PDF da tabela de metas diárias.'
      })
    } finally {
      setIsExportingDailyPdf(false)
    }
  }

  const handleExportDailyXls = async () => {
    if (filteredMetas.length === 0) return

    try {
      setIsExportingDailyXls(true)

      const ExcelJS = await import('exceljs')
      const { headers, rows } = buildDailyExportData()
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Metas por Dia')

      worksheet.views = [{ state: 'frozen', ySplit: 1 }]
      worksheet.addRow(headers)
      worksheet.addRows(rows)

      headers.forEach((header, index) => {
        const column = worksheet.getColumn(index + 1)
        column.width = Math.max(14, Math.min(24, header.length + 4))
        column.alignment = { vertical: 'middle', wrapText: true }
      })

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FF0F172A' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      }
      headerRow.alignment = { vertical: 'middle', wrapText: true }

      const buffer = await workbook.xlsx.writeBuffer()
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        getDailyExportFilename('xlsx')
      )
    } catch (error) {
      console.error('Error exporting daily XLS:', error)
      toast.error('Erro ao exportar XLS', {
        description: 'Não foi possível gerar a planilha da tabela de metas diárias.'
      })
    } finally {
      setIsExportingDailyXls(false)
    }
  }

  const handleExportDailyCsv = () => {
    if (filteredMetas.length === 0) return

    try {
      setIsExportingDailyCsv(true)

      const { headers, rows } = buildDailyExportData()
      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(';'))
        .join('\r\n')

      downloadBlob(
        new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' }),
        getDailyExportFilename('csv')
      )
    } catch (error) {
      console.error('Error exporting daily CSV:', error)
      toast.error('Erro ao exportar CSV', {
        description: 'Não foi possível gerar o CSV da tabela de metas diárias.'
      })
    } finally {
      setIsExportingDailyCsv(false)
    }
  }

  const CardInfoTooltip = ({
    title,
    description,
  }: {
    title: string
    description: string
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">{title}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  )

  if (!isClientReady) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-44" />
          </div>
        </div>

        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          section="Metas"
          title="Meta de Vendas Geral"
          description="Acompanhamento e gestão de metas de vendas por filial"
          icon={TrendingUp}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleUpdateValues}
            disabled={loading || isUpdatingValues}
            className="h-10"
          >
            {isUpdatingValues ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Valores
              </>
            )}
          </Button>

          <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10">
                <PlusIcon className="mr-2 h-4 w-4" />
                Gerar Meta de Vendas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Meta de Vendas Geral</DialogTitle>
                <DialogDescription>
                  Preencha os dados para gerar as metas de vendas do mês. Se já existirem metas para o período, elas serão substituídas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-900 dark:text-blue-200">
                  <p className="font-medium">ℹ️ Atenção:</p>
                  <p className="mt-1">Ao gerar metas para um período já cadastrado, as metas anteriores serão substituídas pelos novos valores.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="form-mes">Mês</Label>
                    <Select value={formMes.toString()} onValueChange={(v) => setFormMes(parseInt(v))}>
                      <SelectTrigger id="form-mes">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {format(new Date(2024, m - 1, 1), 'MMMM', { locale: ptBR })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-ano">Ano</Label>
                    <Select value={formAno.toString()} onValueChange={(v) => setFormAno(parseInt(v))}>
                      <SelectTrigger id="form-ano">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-filial">Filial</Label>
                  <Select value={formFilialId} onValueChange={setFormFilialId}>
                    <SelectTrigger id="form-filial">
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
                <div className="space-y-2">
                  <Label htmlFor="form-meta">Meta (%)</Label>
                  <Input
                    id="form-meta"
                    type="number"
                    step="0.01"
                    min="-100"
                    max="1000"
                    placeholder="Ex: 10 (ou -10 para meta negativa)"
                    value={formMetaPercentual}
                    onChange={(e) => setFormMetaPercentual(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Valores negativos indicam redução da meta em relação à referência
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-data-ref">Data de Referência Inicial</Label>
                  <DatePicker
                    value={formDataReferencia}
                    onChange={setFormDataReferencia}
                    placeholder="dd/mm/aaaa"
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={handleGenerateSalesMeta}
                  disabled={isGeneratingSalesMeta}
                  className="w-full"
                >
                  {isGeneratingSalesMeta ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Gerar Meta de Vendas'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={marginDialogOpen} onOpenChange={setMarginDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10" variant="outline">
                <PlusIcon className="mr-2 h-4 w-4" />
                Gerar Meta de Margem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Meta de Margem</DialogTitle>
                <DialogDescription>
                  Preencha os dados para gerar a meta de margem do mês. Se já existirem metas para o período, a margem será atualizada.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-900 dark:text-blue-200">
                  <p className="font-medium">ℹ️ Atenção:</p>
                  <p className="mt-1">Ao gerar meta de margem para um período já cadastrado, a margem das metas existentes será substituída pelo novo valor.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="form-margin-mes">Mês</Label>
                    <Select value={formMes.toString()} onValueChange={(v) => setFormMes(parseInt(v))}>
                      <SelectTrigger id="form-margin-mes">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {format(new Date(2024, m - 1, 1), 'MMMM', { locale: ptBR })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-margin-ano">Ano</Label>
                    <Select value={formAno.toString()} onValueChange={(v) => setFormAno(parseInt(v))}>
                      <SelectTrigger id="form-margin-ano">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-margin-filial">Filial</Label>
                  <Select value={formFilialId} onValueChange={setFormFilialId}>
                    <SelectTrigger id="form-margin-filial">
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
                <div className="space-y-2">
                  <Label htmlFor="form-margin-meta">Meta Margem (%)</Label>
                  <Input
                    id="form-margin-meta"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 28"
                    value={formMetaMargemPercentual}
                    onChange={(e) => setFormMetaMargemPercentual(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para acompanhar a margem bruta alvo do período.
                  </p>
                </div>
                <Button
                  onClick={handleGenerateMarginMeta}
                  disabled={isGeneratingMarginMeta}
                  className="w-full"
                >
                  {isGeneratingMarginMeta ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Gerar Meta de Margem'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <MetasFilters
        filiaisSelecionadas={filiaisSelecionadas}
        setFiliaisSelecionadas={setFiliaisSelecionadas}
        mes={mes}
        setMes={setMes}
        ano={ano}
        setAno={setAno}
        branches={branches}
        isLoadingBranches={isLoadingBranches}
        onFilter={handleFilter}
      />

      {/* Cards resumo */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="@container/card bg-white shadow-xs dark:bg-card">
              <CardHeader className="space-y-0.5 p-4 pb-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32" />
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 px-4 pb-4 pt-0 text-[12px]">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="@container/card min-w-0 bg-white shadow-xs dark:bg-card">
            <CardHeader className="space-y-0.5 p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardDescription className="text-[clamp(12px,1.1vw,14px)] font-semibold leading-none tracking-tight text-foreground">Valor Meta Mês</CardDescription>
                <CardInfoTooltip
                  title="Meta consolidada do período"
                  description="Soma mensal das metas geradas"
                />
              </div>
              <CardTitle className="min-w-0 break-words text-[clamp(20px,1.5vw,26px)] font-semibold leading-tight tabular-nums">
                {formatCurrency(summaryTotals.valorMeta)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="@container/card min-w-0 bg-white shadow-xs dark:bg-card">
            <CardHeader className="space-y-0.5 p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardDescription className="text-[clamp(12px,1.1vw,14px)] font-semibold leading-none tracking-tight text-foreground">
                  Valor Realizado Mês
                </CardDescription>
                <CardInfoTooltip
                  title="Realizado consolidado"
                  description={isCurrentSelectedMonth ? 'Atualizado até ontem (D-1)' : 'Considerando o mês completo'}
                />
              </div>
              <CardTitle className="min-w-0 break-words text-[clamp(20px,1.5vw,26px)] font-semibold leading-tight tabular-nums">
                {formatCurrency(summaryTotals.valorRealizado)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center px-4 pb-4 pt-0">
              <div className="relative h-20 w-20 shrink-0">
                <svg className="h-20 w-20 -rotate-90 transform">
                  <circle
                    className="text-muted"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="32"
                    cx="40"
                    cy="40"
                  />
                  <circle
                    className={summaryTotals.percentualAtingido >= 100 ? 'text-green-500' : 'text-primary'}
                    strokeWidth="8"
                    strokeDasharray={`${((summaryTotals.percentualAtingido || 0) / 100) * 201.06} 201.06`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="32"
                    cx="40"
                    cy="40"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[clamp(13px,1.05vw,19px)] font-semibold leading-tight tabular-nums">{summaryTotals.percentualAtingido.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="@container/card min-w-0 bg-white shadow-xs dark:bg-card">
            <CardHeader className="space-y-0.5 p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardDescription className="text-[clamp(12px,1.1vw,14px)] font-semibold leading-none tracking-tight text-foreground">
                  Valor Meta Acumulada
                </CardDescription>
                <CardInfoTooltip
                  title="Meta acumulada do corte"
                  description={isCurrentSelectedMonth ? 'Soma da meta até D-1' : 'Soma de todo o mês carregado'}
                />
              </div>
              <CardTitle className="min-w-0 break-words text-[clamp(20px,1.5vw,26px)] font-semibold leading-tight tabular-nums">
                {formatCurrency(summaryTotals.valorMetaAcumuladaD1)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center px-4 pb-4 pt-0">
              <div className="relative h-20 w-20 shrink-0">
                <svg className="h-20 w-20 -rotate-90 transform">
                  <circle
                    className="text-muted"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="32"
                    cx="40"
                    cy="40"
                  />
                  <circle
                    className={summaryTotals.percentualAtingidoAcumuladoD1 >= 100 ? 'text-green-500' : 'text-primary'}
                    strokeWidth="8"
                    strokeDasharray={`${((summaryTotals.percentualAtingidoAcumuladoD1 || 0) / 100) * 201.06} 201.06`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="32"
                    cx="40"
                    cy="40"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[clamp(13px,1.05vw,19px)] font-semibold leading-tight tabular-nums">{summaryTotals.percentualAtingidoAcumuladoD1.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="@container/card min-w-0 bg-white shadow-xs dark:bg-card">
            <CardHeader className="space-y-0.5 p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardDescription className="text-[clamp(12px,1.1vw,14px)] font-semibold leading-none tracking-tight text-foreground">Lucro Bruto</CardDescription>
                <CardInfoTooltip
                  title="Lucro consolidado do período"
                  description="Soma do lucro bruto realizado"
                />
              </div>
              <CardTitle className="min-w-0 break-words text-[clamp(20px,1.5vw,26px)] font-semibold leading-tight tabular-nums">
                {formatCurrency(summaryTotals.lucroBruto)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="@container/card min-w-0 bg-white shadow-xs dark:bg-card">
            <CardHeader className="space-y-0.5 p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardDescription className="text-[clamp(12px,1.1vw,14px)] font-semibold leading-none tracking-tight text-foreground">Margem Bruta</CardDescription>
                <CardInfoTooltip
                  title="Margem consolidada"
                  description="Lucro bruto sobre o realizado"
                />
              </div>
              <CardTitle className="min-w-0 break-words text-[clamp(20px,1.5vw,26px)] font-semibold leading-tight tabular-nums">
                {formatPlainPercentage(summaryTotals.margemBruta)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>{`Resumo Meta mensal: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)}`}</CardTitle>
            <CardDescription>Resumo mensal da Meta</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || isExportingSummary || visibleSummaryRows.length === 0}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {isExportingSummary ? 'Exportando...' : 'Exportar'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => void handleExportSummaryPdf()}>
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExportSummaryXls()}>
                Exportar XLS
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportSummaryCsv}>
                Exportar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : visibleSummaryRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resumo disponível para o período selecionado.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="[&_tr]:bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px] pl-4">Filial</TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor Meta
                      <br />
                      Mês
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor Realizado
                      <br />
                      Mês
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      % Atingido
                      <br />
                      Mês
                    </TableHead>
                    {isCurrentSelectedMonth ? (
                      <>
                        <TableHead className="whitespace-normal leading-tight">
                          Valor Meta
                          <br />
                          Acumulada
                        </TableHead>
                        <TableHead className="whitespace-normal leading-tight">
                          % Atingido
                          <br />
                          Acumulado
                        </TableHead>
                      </>
                    ) : null}
                    <TableHead className="whitespace-normal leading-tight">
                      Lucro
                      <br />
                      Bruto
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Meta
                      <br />
                      Margem
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Margem
                      <br />
                      Realizada
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Meta
                      <br />
                      Compras
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Realizado
                      <br />
                      Compras
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">% Comp./Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSummaryRows.map((row) => {
                    const comprasResumo = getPurchaseSummaryByFilial(row.filial_id)
                    const compraSobreVenda = getCompraSobreVendaPercent(
                      comprasResumo?.valor_realizado_compras,
                      row.valor_realizado
                    )

                    return (
                    <TableRow key={row.filial_id}>
                      <TableCell className="w-[120px] pl-4">
                        <Badge
                          variant="outline"
                          className={getSummaryFilialBadgeClass(row.filial_id)}
                        >
                          {getFilialName(row.filial_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(row.valor_meta)}</TableCell>
                      <TableCell>{formatCurrency(row.valor_realizado)}</TableCell>
                      <TableCell>
                        {isCurrentSelectedMonth ? (
                          formatPlainPercentage(row.percentual_atingido)
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {row.percentual_atingido >= 100 ? (
                              <CircleArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <CircleArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            {formatPlainPercentage(row.percentual_atingido)}
                          </span>
                        )}
                      </TableCell>
                      {isCurrentSelectedMonth ? (
                        <>
                          <TableCell>{formatCurrency(row.valor_meta_acumulada_d1)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              {row.percentual_atingido_acumulado_d1 >= 100 ? (
                                <CircleArrowUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <CircleArrowDown className="h-4 w-4 text-red-600" />
                              )}
                              {formatPlainPercentage(row.percentual_atingido_acumulado_d1)}
                            </span>
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell>{formatCurrency(row.lucro_bruto)}</TableCell>
                      <TableCell>
                        {renderMetaMargemStatus(row.meta_margem_percentual)}
                      </TableCell>
                      <TableCell>
                        {row.meta_margem_percentual != null && row.meta_margem_percentual > 0 ? (
                          <span className="inline-flex items-center gap-2">
                            {row.margem_bruta >= row.meta_margem_percentual ? (
                              <CircleArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <CircleArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            {formatPlainPercentage(row.margem_bruta)}
                          </span>
                        ) : (
                          formatPlainPercentage(row.margem_bruta)
                        )}
                      </TableCell>
                      <TableCell>{renderLoadingCurrency(comprasResumo?.valor_meta_compras, true)}</TableCell>
                      <TableCell>{renderLoadingCurrency(comprasResumo?.valor_realizado_compras)}</TableCell>
                      <TableCell>{renderLoadingPercentage(compraSobreVenda)}</TableCell>
                    </TableRow>
                    )
                  })}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell className="w-[120px] pl-4">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Todas
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(summaryTotals.valorMeta)}</TableCell>
                    <TableCell>{formatCurrency(summaryTotals.valorRealizado)}</TableCell>
                    <TableCell>
                      {isCurrentSelectedMonth ? (
                        formatPlainPercentage(summaryTotals.percentualAtingido)
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {summaryTotals.percentualAtingido >= 100 ? (
                            <CircleArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <CircleArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          {formatPlainPercentage(summaryTotals.percentualAtingido)}
                        </span>
                      )}
                    </TableCell>
                    {isCurrentSelectedMonth ? (
                      <>
                        <TableCell>{formatCurrency(summaryTotals.valorMetaAcumuladaD1)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            {summaryTotals.percentualAtingidoAcumuladoD1 >= 100 ? (
                              <CircleArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <CircleArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            {formatPlainPercentage(summaryTotals.percentualAtingidoAcumuladoD1)}
                          </span>
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>{formatCurrency(summaryTotals.lucroBruto)}</TableCell>
                    <TableCell>
                      {renderMetaMargemStatus(summaryTotals.mediaMetaMargem)}
                    </TableCell>
                    <TableCell>
                      {summaryTotals.mediaMetaMargem != null ? (
                        <span className="inline-flex items-center gap-2">
                          {summaryTotals.margemBruta >= summaryTotals.mediaMetaMargem ? (
                            <CircleArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <CircleArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          {formatPlainPercentage(summaryTotals.margemBruta)}
                        </span>
                      ) : (
                        formatPlainPercentage(summaryTotals.margemBruta)
                      )}
                    </TableCell>
                    <TableCell>{renderLoadingCurrency(summaryTotals.hasMetaCompras ? summaryTotals.valorMetaCompras : null, true)}</TableCell>
                    <TableCell>{renderLoadingCurrency(summaryTotals.hasRealizadoCompras ? summaryTotals.valorRealizadoCompras : null)}</TableCell>
                    <TableCell>
                      {renderLoadingPercentage(
                        getCompraSobreVendaPercent(
                          summaryTotals.hasRealizadoCompras ? summaryTotals.valorRealizadoCompras : null,
                          summaryTotals.valorRealizado
                        )
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de metas */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>{`Resumo de Metas por Dia: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)}`}</CardTitle>
            <CardDescription>Acompanhamento detalhado por dia</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || isExportingDaily || filteredMetas.length === 0}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {isExportingDaily ? 'Exportando...' : 'Exportar'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => void handleExportDailyPdf()}>
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExportDailyXls()}>
                Exportar XLS
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportDailyCsv}>
                Exportar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {/* Header skeleton */}
              <div className="grid grid-cols-14 gap-4 pb-4 border-b">
                {Array.from({ length: 14 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
              {/* Rows skeleton */}
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-14 gap-4 py-3 border-b">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : report?.metas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhuma meta cadastrada para este período.
                <br />
                Clique em &quot;Gerar Meta de Vendas&quot; para criar.
              </p>
            </div>
          ) : filiaisSelecionadas.length !== 1 ? (
            // Visualização agrupada por data quando múltiplas ou nenhuma filial está selecionada
            <div className="rounded-md border">
              <Table>
                <TableHeader className="[&_tr]:bg-muted/50">
                  <TableRow>
                    <TableHead className="w-5"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[110px] whitespace-normal leading-tight">
                      Dia da
                      <br />
                      Semana
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor
                      <br />
                      Referência
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      %
                      <br />
                      Meta
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor
                      <br />
                      Meta
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor
                      <br />
                      Realizado
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      %
                      <br />
                      Atingido
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Lucro
                      <br />
                      Bruto
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Meta
                      <br />
                      Margem
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Margem
                      <br />
                      Realizada
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Meta
                      <br />
                      Compras
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Realizado
                      <br />
                      Compras
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">% Comp./Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedEntries.map(([dateKey, group]) => {
                    const isExpanded = expandedDates[dateKey] === true // Fechado por padrão
                    const percentualAtingidoDia = group.total_meta > 0
                      ? (group.total_realizado / group.total_meta) * 100
                      : 0
                    // Verificar se deve mostrar diferença (não mostrar se for dia futuro com realizado zero)
                    const isDateFuture = isTodayOrFuture(dateKey)
                    const hasNoSales = group.total_realizado === 0
                    const showDifference = !(isDateFuture && hasNoSales)
                    const comprasDoDia = group.metas.reduce(
                      (acc, meta) => {
                        const compra = getPurchasesByDateAndFilial(meta.data, meta.filial_id)
                        return {
                          valorMetaCompras: acc.valorMetaCompras + (compra?.valor_meta_compras ?? 0),
                          valorRealizadoCompras: acc.valorRealizadoCompras + (compra?.valor_realizado_compras ?? 0),
                          hasMetaCompras: acc.hasMetaCompras || compra?.valor_meta_compras != null,
                          hasRealizadoCompras: acc.hasRealizadoCompras || compra?.valor_realizado_compras != null,
                        }
                      },
                      {
                        valorMetaCompras: 0,
                        valorRealizadoCompras: 0,
                        hasMetaCompras: false,
                        hasRealizadoCompras: false,
                      }
                    )
                    const compraSobreVenda = getCompraSobreVendaPercent(
                      comprasDoDia.hasRealizadoCompras ? comprasDoDia.valorRealizadoCompras : null,
                      group.total_realizado
                    )
                    
                    return (
                      <React.Fragment key={dateKey}>
                        {/* Linha agregada principal */}
                        <TableRow 
                          className="bg-muted/40 hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleDateExpanded(dateKey)}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(group.data), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="w-[110px]">
                            {group.metas[0]?.dia_semana ? (
                              <Badge variant="outline" className={getWeekdayBadgeClass(group.metas[0].dia_semana)}>
                                {group.metas[0].dia_semana}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(group.total_valor_referencia)}
                          </TableCell>
                          <TableCell>
                            {group.media_meta_percentual.toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            {formatCurrency(group.total_meta)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(group.total_realizado)}
                          </TableCell>
                          <TableCell>
                            {showDifference ? (
                              <span className="inline-flex items-center gap-2">
                                {percentualAtingidoDia >= 100 ? (
                                  <CircleArrowUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <CircleArrowDown className="h-4 w-4 text-red-600" />
                                )}
                                {formatPlainPercentage(percentualAtingidoDia)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {showDifference ? (
                              formatCurrency(group.total_lucro)
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderMetaMargemStatus(group.media_meta_margem_percentual)}
                          </TableCell>
                          <TableCell>
                            {showDifference ? (
                              group.media_meta_margem_percentual > 0 ? (
                                <span className="inline-flex items-center gap-2">
                                  {group.margem_bruta >= group.media_meta_margem_percentual ? (
                                    <CircleArrowUp className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <CircleArrowDown className="h-4 w-4 text-red-600" />
                                  )}
                                  {`${group.margem_bruta.toFixed(2)}%`}
                                </span>
                              ) : (
                                `${group.margem_bruta.toFixed(2)}%`
                              )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{renderLoadingCurrency(comprasDoDia.hasMetaCompras ? comprasDoDia.valorMetaCompras : null, true)}</TableCell>
                        <TableCell>{renderLoadingCurrency(comprasDoDia.hasRealizadoCompras ? comprasDoDia.valorRealizadoCompras : null)}</TableCell>
                        <TableCell>{renderLoadingPercentage(compraSobreVenda)}</TableCell>
                      </TableRow>

                        {/* Linhas detalhadas por filial */}
                        {isExpanded && group.metas.map((meta) => {
                          const compra = getPurchasesByDateAndFilial(meta.data, meta.filial_id)
                          const percentualAtingidoMeta = meta.valor_meta > 0
                            ? (meta.valor_realizado / meta.valor_meta) * 100
                            : 0
                          const isEditingPercentual = editingCell?.id === meta.id && editingCell?.field === 'percentual'
                          const isEditingValor = editingCell?.id === meta.id && editingCell?.field === 'valor'
                          const showMetaDifference = shouldShowDifference(meta)
                          const compraSobreVendaMeta = getCompraSobreVendaPercent(
                            compra?.valor_realizado_compras,
                            meta.valor_realizado
                          )
                          
                          return (
                            <TableRow 
                              key={`${dateKey}-${meta.filial_id}`}
                              className="bg-background/50"
                            >
                              <TableCell></TableCell>
                              <TableCell className="pl-4 text-sm">
                                <Badge
                                  variant="outline"
                                  className={getSummaryFilialBadgeClass(meta.filial_id)}
                                >
                                  {getFilialName(meta.filial_id)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                Ref: {meta.data_referencia ? format(parseISO(meta.data_referencia), 'dd/MM/yyyy') : '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(meta.valor_referencia)}
                              </TableCell>
                              
                              {/* Meta % - Editável */}
                              <TableCell
                                className="text-sm cursor-pointer hover:bg-muted/50 transition-colors group"
                                onDoubleClick={() => startEditing(meta.id, 'percentual', meta.meta_percentual)}
                                title="Duplo clique para editar"
                              >
                                {isEditingPercentual ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={saveEdit}
                                    autoFocus
                                    disabled={savingEdit}
                                    className="h-8 text-left"
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    {meta.meta_percentual.toFixed(2)}%
                                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">✏️</span>
                                  </span>
                                )}
                              </TableCell>

                              {/* Valor Meta - Editável */}
                              <TableCell
                                className="text-sm cursor-pointer hover:bg-muted/50 transition-colors group"
                                onDoubleClick={() => startEditing(meta.id, 'valor', meta.valor_meta)}
                                title="Duplo clique para editar"
                              >
                                {isEditingValor ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={saveEdit}
                                    autoFocus
                                    disabled={savingEdit}
                                    className="h-8 text-left"
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    {formatCurrency(meta.valor_meta)}
                                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">✏️</span>
                                  </span>
                                )}
                              </TableCell>
                              
                              <TableCell className="text-sm">
                                {formatCurrency(meta.valor_realizado)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {showMetaDifference ? (
                                  <span className="inline-flex items-center gap-2">
                                    {percentualAtingidoMeta >= 100 ? (
                                      <CircleArrowUp className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <CircleArrowDown className="h-4 w-4 text-red-600" />
                                    )}
                                    {formatPlainPercentage(percentualAtingidoMeta)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {showMetaDifference ? (
                                  formatCurrency(meta.lucro_realizado || 0)
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {renderMetaMargemStatus(meta.meta_margem_percentual)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {showMetaDifference ? (
                                  (() => {
                                    const margem = getMargemRealizada(meta.valor_realizado, meta.lucro_realizado || 0)
                                    return meta.meta_margem_percentual != null && meta.meta_margem_percentual > 0 ? (
                                      <span className="inline-flex items-center gap-2">
                                        {margem >= meta.meta_margem_percentual ? (
                                          <CircleArrowUp className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <CircleArrowDown className="h-4 w-4 text-red-600" />
                                        )}
                                        {`${margem.toFixed(2)}%`}
                                      </span>
                                    ) : (
                                      `${margem.toFixed(2)}%`
                                    )
                                  })()
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{renderLoadingCurrency(compra?.valor_meta_compras, true)}</TableCell>
                              <TableCell className="text-sm">{renderLoadingCurrency(compra?.valor_realizado_compras)}</TableCell>
                              <TableCell className="text-sm">{renderLoadingPercentage(compraSobreVendaMeta)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Visualização normal para filial específica
            <div className="rounded-md border">
              <Table>
                <TableHeader className="[&_tr]:bg-muted/50">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[110px] whitespace-normal leading-tight">
                      Dia da
                      <br />
                      Semana
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Data
                      <br />
                      Ref.
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor
                      <br />
                      Referência
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      %
                      <br />
                      Meta
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor
                      <br />
                      Meta
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Valor
                      <br />
                      Realizado
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      %
                      <br />
                      Atingido
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Lucro
                      <br />
                      Bruto
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Meta
                      <br />
                      Margem
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Margem
                      <br />
                      Realizada
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Meta
                      <br />
                      Compras
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">
                      Realizado
                      <br />
                      Compras
                    </TableHead>
                    <TableHead className="whitespace-normal leading-tight">% Comp./Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMetas.map((meta) => {
                      const compra = getPurchasesByDateAndFilial(meta.data, meta.filial_id)
                      const percentualAtingidoMeta = meta.valor_meta > 0
                        ? (meta.valor_realizado / meta.valor_meta) * 100
                        : 0
                      const isEditingPercentual = editingCell?.id === meta.id && editingCell?.field === 'percentual'
                      const isEditingValor = editingCell?.id === meta.id && editingCell?.field === 'valor'
                      const showDiff = shouldShowDifference(meta)
                      const compraSobreVenda = getCompraSobreVendaPercent(
                        compra?.valor_realizado_compras,
                        meta.valor_realizado
                      )
                      
                      return (
                        <TableRow key={meta.id}>
                          <TableCell>
                            {format(parseISO(meta.data), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="w-[110px]">
                            <Badge variant="outline" className={getWeekdayBadgeClass(meta.dia_semana)}>
                              {meta.dia_semana}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {meta.data_referencia ? format(parseISO(meta.data_referencia), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(meta.valor_referencia)}
                          </TableCell>
                          
                          {/* Meta % - Editável */}
                          <TableCell
                            className="cursor-pointer hover:bg-muted/50 transition-colors group"
                            onDoubleClick={() => startEditing(meta.id, 'percentual', meta.meta_percentual)}
                            title="Duplo clique para editar"
                          >
                            {isEditingPercentual ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                disabled={savingEdit}
                                className="h-9 text-left"
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                {meta.meta_percentual.toFixed(2)}%
                                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">✏️</span>
                              </span>
                            )}
                          </TableCell>

                          {/* Valor Meta - Editável */}
                          <TableCell
                            className="cursor-pointer hover:bg-muted/50 transition-colors group"
                            onDoubleClick={() => startEditing(meta.id, 'valor', meta.valor_meta)}
                            title="Duplo clique para editar"
                          >
                            {isEditingValor ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                disabled={savingEdit}
                                className="h-9 text-left"
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                {formatCurrency(meta.valor_meta)}
                                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">✏️</span>
                              </span>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            {formatCurrency(meta.valor_realizado)}
                          </TableCell>
                          <TableCell>
                            {showDiff ? (
                              <span className="inline-flex items-center gap-2">
                                {percentualAtingidoMeta >= 100 ? (
                                  <CircleArrowUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <CircleArrowDown className="h-4 w-4 text-red-600" />
                                )}
                                {formatPlainPercentage(percentualAtingidoMeta)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {showDiff ? (
                              formatCurrency(meta.lucro_realizado || 0)
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderMetaMargemStatus(meta.meta_margem_percentual)}
                          </TableCell>
                          <TableCell>
                            {showDiff ? (
                              (() => {
                                const margem = getMargemRealizada(meta.valor_realizado, meta.lucro_realizado || 0)
                                return meta.meta_margem_percentual != null && meta.meta_margem_percentual > 0 ? (
                                  <span className="inline-flex items-center gap-2">
                                    {margem >= meta.meta_margem_percentual ? (
                                      <CircleArrowUp className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <CircleArrowDown className="h-4 w-4 text-red-600" />
                                    )}
                                    {`${margem.toFixed(2)}%`}
                                  </span>
                                ) : (
                                  `${margem.toFixed(2)}%`
                                )
                              })()
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{renderLoadingCurrency(compra?.valor_meta_compras, true)}</TableCell>
                          <TableCell>{renderLoadingCurrency(compra?.valor_realizado_compras)}</TableCell>
                          <TableCell>{renderLoadingPercentage(compraSobreVenda)}</TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
