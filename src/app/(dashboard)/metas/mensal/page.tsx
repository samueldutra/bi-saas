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
  data_referencia: string
  valor_referencia: number
  valor_meta: number
  valor_realizado: number
  custo_realizado: number
  lucro_realizado: number
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
  lucro_bruto: number
  margem_bruta: number
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
    diferenca_percentual: number
    margem_bruta: number
  }
}

interface LoadReportOptions {
  refreshRealized?: boolean
  forceRefreshRealized?: boolean
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
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  // Estados do formulário de criação
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formMes, setFormMes] = useState(currentDate.getMonth() + 1)
  const [formAno, setFormAno] = useState(currentDate.getFullYear())
  const [formFilialId, setFormFilialId] = useState<string>('')
  const [formMetaPercentual, setFormMetaPercentual] = useState('')
  const [formDataReferencia, setFormDataReferencia] = useState<Date | undefined>()
  const [generating, setGenerating] = useState(false)

  // Estados para edição inline
  const [editingCell, setEditingCell] = useState<{ id: number; field: 'percentual' | 'valor' } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [isExportingSummaryPdf, setIsExportingSummaryPdf] = useState(false)
  const [isExportingDailyPdf, setIsExportingDailyPdf] = useState(false)

  // Estado para botão atualizar valores
  const [isUpdatingValues, setIsUpdatingValues] = useState(false)
  const isRefreshingValuesRef = useRef(false)
  const lastUpdatedPeriodKeyRef = useRef('')
  const latestLoadRequestIdRef = useRef(0)
  const reportAbortControllerRef = useRef<AbortController | null>(null)

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

  const handleGenerateMetas = async () =>  {
    if (!currentTenant?.supabase_schema) return
    if (!formFilialId || !formMetaPercentual || !formDataReferencia) {
      toast.error('Campos obrigatórios', {
        description: 'Preencha todos os campos para gerar as metas'
      })
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/metas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentTenant.supabase_schema,
          filialId: parseInt(formFilialId),
          mes: formMes,
          ano: formAno,
          metaPercentual: parseFloat(formMetaPercentual),
          dataReferenciaInicial: format(formDataReferencia, 'yyyy-MM-dd')
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Metas geradas com sucesso', {
          description: data.message || `${data.metas_criadas || 31} metas criadas para o período`
        })
        setDialogOpen(false)
        lastUpdatedPeriodKeyRef.current = ''
        loadReport(filiaisSelecionadas, mes, ano, { refreshRealized: true })
      } else {
        toast.error('Erro ao gerar metas', {
          description: data.error || 'Verifique os dados e tente novamente'
        })
      }
    } catch (error) {
      console.error('Error generating metas:', error)
      toast.error('Erro ao gerar metas', {
        description: 'Ocorreu um erro inesperado. Tente novamente.'
      })
    } finally {
      setGenerating(false)
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

    return {
      valorMeta,
      valorRealizado,
      percentualAtingido: valorMeta > 0 ? (valorRealizado / valorMeta) * 100 : 0,
      valorMetaAcumuladaD1,
      percentualAtingidoAcumuladoD1: valorMetaAcumuladaD1 > 0 ? (valorRealizado / valorMetaAcumuladaD1) * 100 : 0,
      lucroBruto,
      margemBruta: valorRealizado > 0 ? (lucroBruto / valorRealizado) * 100 : 0,
    }
  }, [visibleSummaryRows])

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

      const head = [[
        'Filial',
        'Valor Meta Mês',
        'Valor Realizado Mês',
        '% Atingido Mês',
        ...(isCurrentSelectedMonth ? ['Valor Meta Acumulada', '% Atingido Acumulado'] : []),
        'Lucro Bruto',
        'Margem Bruta',
      ]]

      const body = [
        ...visibleSummaryRows.map((row) => ([
          getFilialName(row.filial_id),
          formatCurrency(row.valor_meta),
          formatCurrency(row.valor_realizado),
          formatPlainPercentage(row.percentual_atingido),
          ...(isCurrentSelectedMonth ? [
            formatCurrency(row.valor_meta_acumulada_d1),
            formatPlainPercentage(row.percentual_atingido_acumulado_d1),
          ] : []),
          formatCurrency(row.lucro_bruto),
          formatPlainPercentage(row.margem_bruta),
        ])),
        [
          'Todas',
          formatCurrency(summaryTotals.valorMeta),
          formatCurrency(summaryTotals.valorRealizado),
          formatPlainPercentage(summaryTotals.percentualAtingido),
          ...(isCurrentSelectedMonth ? [
            formatCurrency(summaryTotals.valorMetaAcumuladaD1),
            formatPlainPercentage(summaryTotals.percentualAtingidoAcumuladoD1),
          ] : []),
          formatCurrency(summaryTotals.lucroBruto),
          formatPlainPercentage(summaryTotals.margemBruta),
        ]
      ]

      doc.setFontSize(16)
      doc.text(`Resumo Meta mensal: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)}`, 14, 16)
      doc.setFontSize(10)
      doc.text('Resumo mensal da Meta', 14, 22)

      autoTable(doc as never, {
        startY: 28,
        head,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.row.index === body.length - 1 && data.row.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [248, 250, 252]
          }
        },
      })

      doc.save(`resumo-meta-mensal-${mes.toString().padStart(2, '0')}-${ano}.pdf`)
    } catch (error) {
      console.error('Error exporting summary PDF:', error)
      toast.error('Erro ao exportar PDF', {
        description: 'Não foi possível gerar o PDF do resumo.'
      })
    } finally {
      setIsExportingSummaryPdf(false)
    }
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

      const head = filiaisSelecionadas.length !== 1
        ? [[
            'Data',
            'Dia da Semana',
            'Valor Referência',
            '% Meta',
            'Valor Meta',
            'Valor Realizado',
            '% Atingido',
            'Lucro Bruto',
            'Margem Bruta',
          ]]
        : [[
            'Data',
            'Dia da Semana',
            'Data Ref.',
            'Valor Referência',
            '% Meta',
            'Valor Meta',
            'Valor Realizado',
            '% Atingido',
            'Lucro Bruto',
            'Margem Bruta',
          ]]

      const body =
        filiaisSelecionadas.length !== 1
          ? groupedEntries.map(([, group]) => {
              const percentualAtingidoDia = group.total_meta > 0
                ? (group.total_realizado / group.total_meta) * 100
                : 0

              return [
                format(parseISO(group.data), 'dd/MM/yyyy'),
                group.metas[0]?.dia_semana || '-',
                formatCurrency(group.total_valor_referencia),
                formatPlainPercentage(group.media_meta_percentual),
                formatCurrency(group.total_meta),
                formatCurrency(group.total_realizado),
                formatPlainPercentage(percentualAtingidoDia),
                formatCurrency(group.total_lucro),
                formatPlainPercentage(group.margem_bruta),
              ]
            })
          : filteredMetas.map((meta) => {
              const percentualAtingidoMeta = meta.valor_meta > 0
                ? (meta.valor_realizado / meta.valor_meta) * 100
                : 0

              const margem = meta.valor_realizado > 0
                ? ((meta.lucro_realizado || 0) / meta.valor_realizado) * 100
                : 0

              return [
                format(parseISO(meta.data), 'dd/MM/yyyy'),
                meta.dia_semana,
                meta.data_referencia ? format(parseISO(meta.data_referencia), 'dd/MM/yyyy') : '-',
                formatCurrency(meta.valor_referencia),
                formatPlainPercentage(meta.meta_percentual),
                formatCurrency(meta.valor_meta),
                formatCurrency(meta.valor_realizado),
                formatPlainPercentage(percentualAtingidoMeta),
                formatCurrency(meta.lucro_realizado || 0),
                formatPlainPercentage(margem),
              ]
            })

      doc.setFontSize(16)
      doc.text(`Resumo de Metas por Dia: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)}`, 14, 16)
      doc.setFontSize(10)
      doc.text('Acompanhamento detalhado por dia', 14, 22)

      autoTable(doc as never, {
        startY: 28,
        head,
        body,
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
        },
      })

      doc.save(`metas-diarias-${mes.toString().padStart(2, '0')}-${ano}.pdf`)
    } catch (error) {
      console.error('Error exporting daily PDF:', error)
      toast.error('Erro ao exportar PDF', {
        description: 'Não foi possível gerar o PDF da tabela de metas diárias.'
      })
    } finally {
      setIsExportingDailyPdf(false)
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10">
                <PlusIcon className="mr-2 h-4 w-4" />
                Cadastrar Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Meta de Vendas Geral</DialogTitle>
                <DialogDescription>
                  Preencha os dados para gerar as metas do mês. Se já existirem metas para o período, elas serão substituídas.
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
                  onClick={handleGenerateMetas}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Gerar Metas'
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSummaryPdf}
            disabled={loading || isExportingSummaryPdf || visibleSummaryRows.length === 0}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {isExportingSummaryPdf ? 'Exportando...' : 'Exportar PDF'}
          </Button>
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
                    <TableHead>Valor Meta Mês</TableHead>
                    <TableHead>Valor Realizado Mês</TableHead>
                    <TableHead>% Atingido Mês</TableHead>
                    {isCurrentSelectedMonth ? (
                      <>
                        <TableHead>Valor Meta Acumulada</TableHead>
                        <TableHead>% Atingido Acumulado</TableHead>
                      </>
                    ) : null}
                    <TableHead>Lucro Bruto</TableHead>
                    <TableHead>Margem Bruta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSummaryRows.map((row) => (
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
                      <TableCell>{formatPlainPercentage(row.margem_bruta)}</TableCell>
                    </TableRow>
                  ))}
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
                    <TableCell>{formatPlainPercentage(summaryTotals.margemBruta)}</TableCell>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDailyPdf}
            disabled={loading || isExportingDailyPdf || filteredMetas.length === 0}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {isExportingDailyPdf ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {/* Header skeleton */}
              <div className="grid grid-cols-11 gap-4 pb-4 border-b">
                {Array.from({ length: 11 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
              {/* Rows skeleton */}
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-11 gap-4 py-3 border-b">
                  {Array.from({ length: 11 }).map((_, i) => (
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
                Clique em &quot;Cadastrar Meta&quot; para criar.
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
                    <TableHead className="w-[110px]">Dia da Semana</TableHead>
                    <TableHead>Valor Referência</TableHead>
                    <TableHead>% Meta</TableHead>
                    <TableHead>Valor Meta</TableHead>
                    <TableHead>Valor Realizado</TableHead>
                    <TableHead>% Atingido</TableHead>
                    <TableHead>Lucro Bruto</TableHead>
                    <TableHead>Margem Bruta</TableHead>
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
                            {showDifference ? (
                              `${group.margem_bruta.toFixed(2)}%`
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Linhas detalhadas por filial */}
                        {isExpanded && group.metas.map((meta) => {
                          const percentualAtingidoMeta = meta.valor_meta > 0
                            ? (meta.valor_realizado / meta.valor_meta) * 100
                            : 0
                          const isEditingPercentual = editingCell?.id === meta.id && editingCell?.field === 'percentual'
                          const isEditingValor = editingCell?.id === meta.id && editingCell?.field === 'valor'
                          const showMetaDifference = shouldShowDifference(meta)
                          
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
                                {showMetaDifference ? (
                                  (() => {
                                    const margem = meta.valor_realizado > 0 ? ((meta.lucro_realizado || 0) / meta.valor_realizado) * 100 : 0
                                    return `${margem.toFixed(2)}%`
                                  })()
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
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
                    <TableHead className="w-[110px]">Dia da Semana</TableHead>
                    <TableHead>Data Ref.</TableHead>
                    <TableHead>Valor Referência</TableHead>
                    <TableHead>% Meta</TableHead>
                    <TableHead>Valor Meta</TableHead>
                    <TableHead>Valor Realizado</TableHead>
                    <TableHead>% Atingido</TableHead>
                    <TableHead>Lucro Bruto</TableHead>
                    <TableHead>Margem Bruta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMetas.map((meta) => {
                      const percentualAtingidoMeta = meta.valor_meta > 0
                        ? (meta.valor_realizado / meta.valor_meta) * 100
                        : 0
                      const isEditingPercentual = editingCell?.id === meta.id && editingCell?.field === 'percentual'
                      const isEditingValor = editingCell?.id === meta.id && editingCell?.field === 'valor'
                      const showDiff = shouldShowDifference(meta)
                      
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
                            {showDiff ? (
                              (() => {
                                const margem = meta.valor_realizado > 0 ? ((meta.lucro_realizado || 0) / meta.valor_realizado) * 100 : 0
                                return `${margem.toFixed(2)}%`
                              })()
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
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
