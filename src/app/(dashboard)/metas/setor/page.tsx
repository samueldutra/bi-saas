'use client'

import { useState, useEffect, Fragment, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight, Plus, Target, Loader2, RefreshCw, CircleArrowDown, CircleArrowUp, FileDown, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useTenantContext } from '@/contexts/tenant-context'
import { useBranchesOptions } from '@/hooks/use-branches'
import { logModuleAccess } from '@/lib/audit'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { MultiFilialFilter, type FilialOption } from '@/components/filters'
import { PageHeader } from '@/components/dashboard/page-header'

interface Setor {
  id: number
  nome: string
  nivel: number
  departamento_ids: number[]
}

interface MetaSetor {
  data: string
  dia_semana: string
  filiais: {
    filial_id: number
    filial_nome?: string           // Retornado pela RPC
    data_referencia?: string       // Opcional - nem sempre retornado
    dia_semana_ref?: string        // Opcional - nem sempre retornado
    valor_referencia?: number      // Opcional - nem sempre retornado
    meta_percentual?: number       // Opcional - nem sempre retornado
    meta_margem_percentual?: number | null
    valor_meta: number
    valor_realizado: number
    custo_realizado: number        // NOVO - Custo total realizado
    lucro_realizado: number        // NOVO - Lucro bruto realizado
    diferenca: number
    diferenca_percentual: number
    percentual_atingido?: number   // Retornado pela RPC
  }[]
}

interface MetaSetorSummaryRow {
  filial_id: number
  filial_nome?: string
  valor_meta: number
  valor_meta_acumulada_d1: number
  valor_realizado: number
  percentual_atingido: number
  percentual_atingido_acumulado_d1: number
  lucro_bruto: number
  meta_margem_percentual?: number | null
  margem_bruta: number
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

const normalizedWeekdayBadgeClasses: Record<string, string> = {
  domingo: weekdayBadgeClasses.Domingo,
  segunda: weekdayBadgeClasses.Segunda,
  terca: weekdayBadgeClasses.Terca,
  quarta: weekdayBadgeClasses.Quarta,
  quinta: weekdayBadgeClasses.Quinta,
  sexta: weekdayBadgeClasses.Sexta,
  sabado: weekdayBadgeClasses.Sabado,
}

type PdfStatusDirection = 'up' | 'down' | null

interface PdfCellHookData {
  cell: {
    x: number
    y: number
    width: number
    height: number
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

export default function MetaSetorPage() {
  const pathname = usePathname()
  const { currentTenant, userProfile } = useTenantContext()
  const { branchOptions: branches, isLoading: isLoadingBranches } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant,
    includeAll: false // Não incluir opção "Todas as Filiais"
  })

  const [setores, setSetores] = useState<Setor[]>([])
  const [selectedSetor, setSelectedSetor] = useState<string>('')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<FilialOption[]>([])
  const [tempFiliaisSelecionadas, setTempFiliaisSelecionadas] = useState<FilialOption[]>([])
  const [metasData, setMetasData] = useState<Record<number, MetaSetor[]>>({})
  const [summaryRows, setSummaryRows] = useState<MetaSetorSummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSetores, setLoadingSetores] = useState(true)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})
  // const [isUpdatingValues, setIsUpdatingValues] = useState(false) // Não usado na UI

  // Estados para edição inline
  const [editingCell, setEditingCell] = useState<{ data: string; filialId: number; field: 'percentual' | 'valor' } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [isUpdatingValues, setIsUpdatingValues] = useState(false)
  const [isExportingDailyPdf, setIsExportingDailyPdf] = useState(false)
  const [isExportingSummaryPdf, setIsExportingSummaryPdf] = useState(false)

  // Ref para evitar múltiplas chamadas simultâneas de atualização
  const isUpdatingRef = useRef(false)
  const lastUpdateKey = useRef<string>('')
  const lastPathname = useRef<string>(pathname)

  // Dialog para gerar meta
  const [salesDialogOpen, setSalesDialogOpen] = useState(false)
  const [marginDialogOpen, setMarginDialogOpen] = useState(false)
  const [generateSalesForm, setGenerateSalesForm] = useState({
    setor_ids: [] as string[],
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    filial_ids: [] as string[],
    data_referencia: undefined as Date | undefined,
    meta_percentual: undefined as number | undefined,
  })
  const [generateMarginForm, setGenerateMarginForm] = useState({
    setor_ids: [] as string[],
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    filial_ids: [] as string[],
    meta_margem_percentual: undefined as number | undefined,
  })
  const [isGeneratingSales, setIsGeneratingSales] = useState(false)
  const [isGeneratingMargin, setIsGeneratingMargin] = useState(false)
  const [salesGenerationProgress, setSalesGenerationProgress] = useState({ current: 0, total: 0 })
  const [marginGenerationProgress, setMarginGenerationProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    if (currentTenant && userProfile) {
      logModuleAccess({
        module: 'metas',
        tenantId: currentTenant.id,
        userName: userProfile.full_name,
        userEmail: '',
      })
    }
  }, [currentTenant, userProfile])

  // Ao carregar filiais, selecionar todas por padrão (apenas filiais reais, sem "all")
  useEffect(() => {
    if (!isLoadingBranches && branches && branches.length > 0 && filiaisSelecionadas.length === 0) {
      setFiliaisSelecionadas(branches)
      setTempFiliaisSelecionadas(branches)
    }
  }, [isLoadingBranches, branches, branches.length, filiaisSelecionadas.length])

  // Limpar filiais selecionadas ao trocar de tenant
  useEffect(() => {
    if (currentTenant) {
      setFiliaisSelecionadas([])
      setTempFiliaisSelecionadas([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id])

  const loadSetores = useCallback(async () => {
    if (!currentTenant) return

    setLoadingSetores(true)
    try {
      const response = await fetch(`/api/setores?schema=${currentTenant.supabase_schema}`)
      if (!response.ok) throw new Error('Erro ao carregar setores')
      const data = await response.json()
      setSetores(data)

      // Limpar setor selecionado ao trocar de empresa
      // para evitar tentar carregar metas com ID incorreto
      setSelectedSetor('')
      setMetasData({})
      setSummaryRows([])
      setExpandedDates({})

      if (data.length > 0) {
        // Selecionar primeiro setor após um delay para garantir que
        // as filiais já foram carregadas para o novo tenant
        setTimeout(() => {
          setSelectedSetor(data[0].id.toString())
        }, 100)
      }
    } catch (error) {
      console.error('Error loading setores:', error)
      alert('Erro ao carregar setores')
    } finally {
      setLoadingSetores(false)
    }
  }, [currentTenant])

  const loadMetasPorSetor = useCallback(async () => {
    if (!currentTenant || !selectedSetor || filiaisSelecionadas.length === 0) {
      return
    }

    setLoading(true)
    try {

      // Atualizar valores realizados APENAS se não estiver já atualizando
      // e se for um novo período (evita loop infinito)
      const updateKey = `${currentTenant.supabase_schema}-${mes}-${ano}`
      const shouldUpdate = !isUpdatingRef.current && lastUpdateKey.current !== updateKey

      if (shouldUpdate) {
        isUpdatingRef.current = true
        lastUpdateKey.current = updateKey

        try {
          const updateResponse = await fetch('/api/metas/setor/update-valores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schema: currentTenant.supabase_schema,
              mes: mes,
              ano: ano
            }),
          })

          if (!updateResponse.ok) {
            const error = await updateResponse.json().catch(() => ({ error: 'Erro desconhecido' }))
            console.warn('[METAS_SETOR] Erro ao atualizar valores:', error)
          }
        } catch (error) {
          console.warn('[METAS_SETOR] Erro ao atualizar valores:', error)
        } finally {
          isUpdatingRef.current = false
        }
      }

      const params = new URLSearchParams({
        schema: currentTenant.supabase_schema || '',
        setor_id: selectedSetor,
        mes: mes.toString(),
        ano: ano.toString(),
      })

      // Buscar apenas as filiais selecionadas
      const filialIds = filiaisSelecionadas
        .map(f => f.value)
        .join(',')

      params.append('filial_id', filialIds)

      const [response, summaryResponse] = await Promise.all([
        fetch(`/api/metas/setor/report?${params}`),
        fetch(`/api/metas/setor/summary?${params}`)
      ])

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error('[METAS_SETOR] ❌ Erro na API:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })

        // Se for 404 ou não houver dados, é um caso esperado
        if (response.status === 404 || errorData.error?.includes('não encontrada')) {
          console.log('[METAS_SETOR] ℹ️ Nenhuma meta encontrada para o período')
          setMetasData({ [parseInt(selectedSetor)]: [] })
          setSummaryRows([])
          setExpandedDates({})
          return
        }

        throw new Error(errorData.error || 'Erro ao carregar metas')
      }

      if (!summaryResponse.ok) {
        const summaryErrorData = await summaryResponse.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error('[METAS_SETOR] ❌ Erro no resumo mensal:', {
          status: summaryResponse.status,
          statusText: summaryResponse.statusText,
          error: summaryErrorData
        })
        throw new Error(summaryErrorData.error || 'Erro ao carregar resumo mensal')
      }

      const [data, summaryData] = await Promise.all([
        response.json(),
        summaryResponse.json()
      ])

      // Se retornou array vazio, não é erro
      if (Array.isArray(data) && data.length === 0) {
        setMetasData({ [parseInt(selectedSetor)]: [] })
        setSummaryRows(summaryData?.resumo || [])
        setExpandedDates({})
        return
      }

      setMetasData({ [parseInt(selectedSetor)]: data })
      setSummaryRows(summaryData?.resumo || [])

      // Manter todas as datas fechadas por padrão
      const newExpanded: Record<string, boolean> = {}
      data.forEach((meta: MetaSetor) => {
        newExpanded[meta.data] = false
      })
      setExpandedDates(newExpanded)
    } catch (error) {
      console.error('[METAS_SETOR] Error loading metas:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      alert(`Erro ao carregar metas: ${errorMessage}\n\nDica: Certifique-se de ter gerado metas para este período.`)
    } finally {
      setLoading(false)
    }
  }, [currentTenant, selectedSetor, mes, ano, filiaisSelecionadas])

  // Carregar setores apenas uma vez quando o tenant está disponível
  useEffect(() => {
    if (currentTenant) {
      loadSetores()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id])

  // Detectar mudança de rota e resetar estado
  useEffect(() => {
    // Se a rota mudou (veio de outra página), resetar tudo
    if (lastPathname.current !== pathname) {
      console.log('[METAS_SETOR_PAGE] 🔄 Rota mudou, resetando estado...', {
        from: lastPathname.current,
        to: pathname
      })

      // Resetar todos os estados
      setMetasData({})
      setSummaryRows([])
      setExpandedDates({})
      setFiliaisSelecionadas([])
      setTempFiliaisSelecionadas([])
      setLoading(false)

      // Limpar cache de atualização
      lastUpdateKey.current = ''
      isUpdatingRef.current = false

      // Atualizar ref para nova rota
      lastPathname.current = pathname
    }
  }, [pathname])

  // Carregar metas ao montar com todas as filiais
  useEffect(() => {
    // Adiciona verificação para não carregar se estiver trocando de tenant
    // (verifica se tem tenant, setor e filiais disponíveis)
    const shouldLoad = (
      currentTenant &&
      selectedSetor &&
      mes &&
      ano &&
      !isLoadingBranches &&
      !loadingSetores &&
      filiaisSelecionadas.length > 0 &&
      branches.length > 0
    )

    console.log('[METAS_SETOR_PAGE] useEffect conditions:', {
      currentTenant: !!currentTenant,
      selectedSetor,
      mes,
      ano,
      isLoadingBranches,
      loadingSetores,
      filiaisSelecionadas: filiaisSelecionadas.length,
      branches: branches.length,
      shouldLoad
    })

    if (shouldLoad) {
      console.log('[METAS_SETOR_PAGE] 🔄 Loading metas...')
      loadMetasPorSetor()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetor, mes, ano, isLoadingBranches, loadingSetores, filiaisSelecionadas.length, branches.length])

  // Função para atualizar valores realizados manualmente (força nova atualização)
  const handleAtualizarValores = async () => {
    if (!currentTenant) return

    setIsUpdatingValues(true)
    try {
      // Limpar cache para forçar nova atualização
      const updateKey = `${currentTenant.supabase_schema}-${mes}-${ano}`
      lastUpdateKey.current = '' // Limpa o cache

      console.log('[METAS_SETOR] 🔄 Forçando atualização manual de valores...')

      const response = await fetch('/api/metas/setor/update-valores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentTenant.supabase_schema,
          mes: mes,
          ano: ano
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar valores')
      }

      // Restaurar cache após sucesso
      lastUpdateKey.current = updateKey

      alert(`✅ Valores atualizados com sucesso!\n\n${result.data?.rows_updated || 0} linhas atualizadas`)

      // Recarregar metas após atualização
      await loadMetasPorSetor()
    } catch (error) {
      console.error('[METAS_SETOR] ❌ Erro ao atualizar valores:', error)
      alert(`Erro ao atualizar valores: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setIsUpdatingValues(false)
    }
  }

  // Função para aplicar filtros
  const handleFiltrar = () => {
    if (tempFiliaisSelecionadas.length === 0) {
      alert('Selecione pelo menos uma filial')
      return
    }

    setFiliaisSelecionadas(tempFiliaisSelecionadas)
    // A atualização de filiaisSelecionadas vai disparar o useEffect acima
  }

  const handleGerarMetaVendas = async () => {
    if (!currentTenant) return

    // Validar campos obrigatórios
    if (generateSalesForm.setor_ids.length === 0) {
      toast.error('Campos obrigatórios', {
        description: 'Selecione pelo menos um setor'
      })
      return
    }
    if (generateSalesForm.filial_ids.length === 0) {
      toast.error('Campos obrigatórios', {
        description: 'Selecione pelo menos uma filial'
      })
      return
    }
    if (!generateSalesForm.data_referencia) {
      toast.error('Campos obrigatórios', {
        description: 'Informe a data de referência'
      })
      return
    }
    if (generateSalesForm.meta_percentual === undefined || generateSalesForm.meta_percentual === null) {
      toast.error('Campos obrigatórios', {
        description: 'Informe o percentual da meta'
      })
      return
    }

    setIsGeneratingSales(true)
    const total = generateSalesForm.setor_ids.length * generateSalesForm.filial_ids.length
    let current = 0
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    try {
      // Gerar meta para cada combinação de setor + filial
      for (const setor_id of generateSalesForm.setor_ids) {
        for (const filial_id of generateSalesForm.filial_ids) {
          current++
          setSalesGenerationProgress({ current, total })

          try {
            const response = await fetch('/api/metas/setor/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schema: currentTenant.supabase_schema,
                setor_id,
                filial_id,
                mes: generateSalesForm.mes,
                ano: generateSalesForm.ano,
                data_referencia: format(generateSalesForm.data_referencia, 'yyyy-MM-dd'),
                meta_percentual: generateSalesForm.meta_percentual,
              }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
              errorCount++
              const setorNome = setores.find(s => s.id.toString() === setor_id)?.nome || setor_id
              errors.push(`Setor ${setorNome} / Filial ${filial_id}: ${result.error || 'Erro desconhecido'}`)
            } else {
              successCount++
            }
          } catch (error) {
            errorCount++
            const setorNome = setores.find(s => s.id.toString() === setor_id)?.nome || setor_id
            errors.push(`Setor ${setorNome} / Filial ${filial_id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
          }
        }
      }

      // Mostrar resultado
      if (errorCount > 0) {
        const errorDetails = errors.slice(0, 3).join('\n')
        const moreErrors = errors.length > 3 ? `\n... e mais ${errors.length - 3} erros` : ''
        
        toast.error('Erro ao gerar metas', {
          description: `${successCount} de ${total} metas criadas com sucesso.\n\nPrimeiros erros:\n${errorDetails}${moreErrors}`
        })
      } else {
        toast.success('Metas geradas com sucesso', {
          description: `${successCount} metas criadas para o período`
        })
      }

      if (successCount > 0) {
        // Limpar formulário após sucesso
        setGenerateSalesForm({
          setor_ids: [],
          mes: new Date().getMonth() + 1,
          ano: new Date().getFullYear(),
          filial_ids: [],
          data_referencia: undefined,
          meta_percentual: undefined,
        })
        setSalesDialogOpen(false)
        loadMetasPorSetor()
      }
    } catch (error) {
      console.error('Error generating metas:', error)
      toast.error('Erro ao gerar metas', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setIsGeneratingSales(false)
      setSalesGenerationProgress({ current: 0, total: 0 })
    }
  }

  const handleGerarMetaMargem = async () => {
    if (!currentTenant) return

    if (generateMarginForm.setor_ids.length === 0) {
      toast.error('Campos obrigatórios', {
        description: 'Selecione pelo menos um setor'
      })
      return
    }
    if (generateMarginForm.filial_ids.length === 0) {
      toast.error('Campos obrigatórios', {
        description: 'Selecione pelo menos uma filial'
      })
      return
    }
    if (generateMarginForm.meta_margem_percentual === undefined || generateMarginForm.meta_margem_percentual === null) {
      toast.error('Campos obrigatórios', {
        description: 'Informe o percentual da meta de margem'
      })
      return
    }

    setIsGeneratingMargin(true)
    const total = generateMarginForm.setor_ids.length * generateMarginForm.filial_ids.length
    let current = 0
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    try {
      for (const setor_id of generateMarginForm.setor_ids) {
        for (const filial_id of generateMarginForm.filial_ids) {
          current++
          setMarginGenerationProgress({ current, total })

          try {
            const response = await fetch('/api/metas/setor/generate-margin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schema: currentTenant.supabase_schema,
                setor_id,
                filial_id,
                mes: generateMarginForm.mes,
                ano: generateMarginForm.ano,
                metaMargemPercentual: generateMarginForm.meta_margem_percentual,
              }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
              errorCount++
              const setorNome = setores.find(s => s.id.toString() === setor_id)?.nome || setor_id
              errors.push(`Setor ${setorNome} / Filial ${filial_id}: ${result.error || 'Erro desconhecido'}`)
            } else {
              successCount++
            }
          } catch (error) {
            errorCount++
            const setorNome = setores.find(s => s.id.toString() === setor_id)?.nome || setor_id
            errors.push(`Setor ${setorNome} / Filial ${filial_id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
          }
        }
      }

      if (errorCount > 0) {
        const errorDetails = errors.slice(0, 3).join('\n')
        const moreErrors = errors.length > 3 ? `\n... e mais ${errors.length - 3} erros` : ''

        toast.error('Erro ao gerar metas de margem', {
          description: `${successCount} de ${total} metas de margem processadas com sucesso.\n\nPrimeiros erros:\n${errorDetails}${moreErrors}`
        })
      } else {
        toast.success('Metas de margem geradas com sucesso', {
          description: `${successCount} metas de margem processadas para o período`
        })
      }

      if (successCount > 0) {
        setGenerateMarginForm({
          setor_ids: [],
          mes: new Date().getMonth() + 1,
          ano: new Date().getFullYear(),
          filial_ids: [],
          meta_margem_percentual: undefined,
        })
        setMarginDialogOpen(false)
        loadMetasPorSetor()
      }
    } catch (error) {
      console.error('Error generating margin metas:', error)
      toast.error('Erro ao gerar metas de margem', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setIsGeneratingMargin(false)
      setMarginGenerationProgress({ current: 0, total: 0 })
    }
  }

  // Verificar se a data é hoje ou futuro
  const isTodayOrFuture = (dateString: string): boolean => {
    const metaDate = parseISO(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    metaDate.setHours(0, 0, 0, 0)
    return metaDate >= today
  }

  // Verificar se deve mostrar diferença
  const shouldShowDifference = (data: string, valorRealizado: number): boolean => {
    if (isTodayOrFuture(data) && valorRealizado === 0) {
      return false
    }
    return true
  }

  // Iniciar edição de célula
  const startEditing = (data: string, filialId: number, field: 'percentual' | 'valor', currentValue: number) => {
    setEditingCell({ data, filialId, field })
    setEditingValue(currentValue.toString())
  }

  // Cancelar edição
  const cancelEditing = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  // Salvar edição
  const saveEdit = async () => {
    if (!editingCell || !currentTenant || !selectedSetor) return

    const newValue = parseFloat(editingValue)
    if (isNaN(newValue)) {
      toast.error('Valor inválido', {
        description: 'Digite um número válido'
      })
      return
    }

    setSavingEdit(true)
    try {
      // Encontrar a meta atual
      const filialIdNum = editingCell.filialId
      const setorIdNum = parseInt(selectedSetor)
      const metasDoSetor = metasData[setorIdNum] || []
      const metaDoDia = metasDoSetor.find(m => m.data === editingCell.data)
      const filialData = metaDoDia?.filiais.find(f => f.filial_id === filialIdNum)

      if (!filialData) {
        toast.error('Meta não encontrada', {
          description: 'Não foi possível localizar a meta para edição'
        })
        setSavingEdit(false)
        cancelEditing()
        return
      }

      // Calcular valores
      let novoPercentual: number
      let novoValorMeta: number

      // Usar valor_referencia se existir, senão usar valor_meta atual como base
      const valorBase = filialData.valor_referencia ?? filialData.valor_meta ?? 1

      if (editingCell.field === 'percentual') {
        novoPercentual = newValue
        // Se temos valor_referencia, calcular valor_meta baseado no percentual
        // Senão, manter o valor_meta existente (usuário pode editar diretamente)
        novoValorMeta = filialData.valor_referencia != null
          ? valorBase * (1 + novoPercentual / 100)
          : filialData.valor_meta
      } else {
        novoValorMeta = newValue
        // Se temos valor_referencia, calcular o percentual
        // Senão, usar 0 como percentual padrão
        // Tratar divisão por zero quando valorBase = 0
        if (filialData.valor_referencia == null || valorBase === 0) {
          novoPercentual = 0  // Não é possível calcular % sem referência válida
        } else {
          novoPercentual = ((novoValorMeta / valorBase) - 1) * 100
        }
      }

      // Chamar API para atualizar
      const response = await fetch('/api/metas/setor/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: currentTenant.supabase_schema,
          setor_id: setorIdNum,
          filial_id: filialIdNum,
          data: editingCell.data,
          meta_percentual: novoPercentual,
          valor_meta: novoValorMeta,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('[METAS_SETOR] Erro ao atualizar:', { 
          status: response.status, 
          result,
          setor_id: setorIdNum,
          filial_id: filialIdNum,
          data: editingCell.data
        })
        throw new Error(result.error || 'Erro ao atualizar meta')
      }

      // Atualizar estado local
      setMetasData(prev => {
        const updated = { ...prev }
        const setorMetas = [...(updated[setorIdNum] || [])]
        const diaIndex = setorMetas.findIndex(m => m.data === editingCell.data)

        if (diaIndex >= 0) {
          const filialIndex = setorMetas[diaIndex].filiais.findIndex(f => f.filial_id === filialIdNum)
          if (filialIndex >= 0) {
            setorMetas[diaIndex] = {
              ...setorMetas[diaIndex],
              filiais: setorMetas[diaIndex].filiais.map((f, idx) =>
                idx === filialIndex
                  ? {
                      ...f,
                      meta_percentual: novoPercentual,
                      valor_meta: novoValorMeta,
                      diferenca: f.valor_realizado - novoValorMeta,
                      diferenca_percentual: novoValorMeta > 0 ? ((f.valor_realizado - novoValorMeta) / novoValorMeta) * 100 : 0
                    }
                  : f
              )
            }
          }
        }

        updated[setorIdNum] = setorMetas
        return updated
      })

      toast.success('Meta atualizada', {
        description: `${editingCell.field === 'percentual' ? 'Percentual' : 'Valor'} alterado com sucesso`
      })

      cancelEditing()
    } catch (error) {
      console.error('Error updating meta:', error)
      toast.error('Erro ao atualizar meta', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setSavingEdit(false)
    }
  }

  // Lidar com teclas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const getStatusDirection = (condition: boolean, shouldDisplayStatus: boolean): PdfStatusDirection => {
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

  const handleExportDailyPdf = async () => {
    if (currentSetorData.length === 0) return

    try {
      setIsExportingDailyPdf(true)

      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const head = [[
        'Data',
        'Dia da Semana',
        'Filial',
        'Valor Referência',
        '% Meta',
        'Valor Meta',
        'Valor Realizado',
        '% Atingido',
        'Lucro Bruto',
        'Meta Margem',
        'Margem Bruta',
      ]]

      const body: string[][] = []
      const statusMatrix: PdfStatusDirection[][] = []

      currentSetorData.forEach((meta) => {
        const totals = meta.filiais.reduce(
          (acc, f) => ({
            valor_referencia: acc.valor_referencia + (f.valor_referencia || 0),
            valor_meta: acc.valor_meta + (f.valor_meta || 0),
            valor_realizado: acc.valor_realizado + (f.valor_realizado || 0),
            lucro_realizado: acc.lucro_realizado + (f.lucro_realizado || 0),
            meta_percentual: acc.meta_percentual + (f.meta_percentual ?? f.percentual_atingido ?? 0),
            count: acc.count + 1,
          }),
          {
            valor_referencia: 0,
            valor_meta: 0,
            valor_realizado: 0,
            lucro_realizado: 0,
            meta_percentual: 0,
            count: 0,
          }
        )

        const avgMeta = totals.count > 0 ? totals.meta_percentual / totals.count : 0
        const metaMargemRows = meta.filiais.filter((f) => f.meta_margem_percentual != null)
        const mediaMetaMargem = metaMargemRows.length > 0
          ? metaMargemRows.reduce((sum, f) => sum + (f.meta_margem_percentual || 0), 0) / metaMargemRows.length
          : null
        const percentualAtingido = totals.valor_meta > 0
          ? (totals.valor_realizado / totals.valor_meta) * 100
          : 0
        const showDiff = shouldShowDifference(meta.data, totals.valor_realizado)
        const margem = totals.valor_realizado > 0
          ? (totals.lucro_realizado / totals.valor_realizado) * 100
          : 0
        const atingidoDirection = getStatusDirection(percentualAtingido >= 100, showDiff)

        body.push([
          format(parseISO(meta.data), 'dd/MM/yyyy'),
          meta.dia_semana || '-',
          'Todas',
          formatCurrency(totals.valor_referencia),
          `${avgMeta.toFixed(2)}%`,
          formatCurrency(totals.valor_meta),
          formatCurrency(totals.valor_realizado),
          showDiff
            ? formatPdfStatusValue(`${percentualAtingido.toFixed(2)}%`, atingidoDirection)
            : '-',
          showDiff ? formatCurrency(totals.lucro_realizado) : '-',
          renderMetaMargemStatus(mediaMetaMargem),
          showDiff ? `${margem.toFixed(2)}%` : '-',
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
          null,
          null,
        ])

        meta.filiais.forEach((filial) => {
          const percentualAtingidoFilial = filial.valor_meta > 0
            ? (filial.valor_realizado / filial.valor_meta) * 100
            : 0
          const showFilialDiff = shouldShowDifference(meta.data, filial.valor_realizado)
          const margemFilial = filial.valor_realizado > 0
            ? ((filial.lucro_realizado || 0) / filial.valor_realizado) * 100
            : 0
          const atingidoFilialDirection = getStatusDirection(percentualAtingidoFilial >= 100, showFilialDiff)

          body.push([
            '',
            filial.data_referencia ? `Ref: ${format(parseISO(filial.data_referencia), 'dd/MM/yyyy')}` : '-',
            getFilialName(filial.filial_id),
            filial.valor_referencia != null ? formatCurrency(filial.valor_referencia) : '-',
            filial.meta_percentual != null
              ? `${filial.meta_percentual.toFixed(2)}%`
              : (filial.percentual_atingido != null ? `${filial.percentual_atingido.toFixed(2)}%` : '-'),
            formatCurrency(filial.valor_meta),
            formatCurrency(filial.valor_realizado),
            showFilialDiff
              ? formatPdfStatusValue(`${percentualAtingidoFilial.toFixed(2)}%`, atingidoFilialDirection)
              : '-',
            showFilialDiff ? formatCurrency(filial.lucro_realizado || 0) : '-',
            renderMetaMargemStatus(filial.meta_margem_percentual),
            showFilialDiff ? `${margemFilial.toFixed(2)}%` : '-',
          ])
          statusMatrix.push([
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            atingidoFilialDirection,
            null,
            null,
            null,
          ])
        })
      })

      doc.setFontSize(16)
      doc.text(
        `Resumo de Metas do Setor por Dia: ${format(new Date(ano, mes - 1, 1), 'MMMM/yyyy', { locale: ptBR })} - Setor: ${currentSetor?.nome ?? ''}`,
        14,
        16
      )
      doc.setFontSize(10)
      doc.text('Acompanhamento detalhado de Metas do Setor por dia e filial', 14, 22)

      autoTable(doc as never, {
        startY: 28,
        head,
        body,
        styles: {
          fontSize: 8,
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

      doc.save(`metas-setor-${selectedSetor}-${mes.toString().padStart(2, '0')}-${ano}.pdf`)
    } catch (error) {
      console.error('Error exporting setor PDF:', error)
      toast.error('Erro ao exportar PDF', {
        description: 'Não foi possível gerar o PDF da tabela de metas por setor.'
      })
    } finally {
      setIsExportingDailyPdf(false)
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatPlainPercentage = (value: number | null) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00%'
    return `${value.toFixed(2)}%`
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

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  const currentSetorData = selectedSetor ? metasData[parseInt(selectedSetor)] || [] : []
  const currentSetor = setores.find(s => s.id.toString() === selectedSetor)
  const selectedMonthYearLabel = format(new Date(ano, mes - 1, 1), 'MMMM/yyyy', { locale: ptBR })
  const isCurrentSelectedMonth = (() => {
    const today = new Date()
    return today.getFullYear() === ano && today.getMonth() + 1 === mes
  })()
  const visibleSummaryRows = summaryRows.filter((row) => row.valor_meta > 0)
  const summaryTotals = {
    valorMeta: visibleSummaryRows.reduce((sum, row) => sum + row.valor_meta, 0),
    valorRealizado: visibleSummaryRows.reduce((sum, row) => sum + row.valor_realizado, 0),
    valorMetaAcumuladaD1: visibleSummaryRows.reduce((sum, row) => sum + row.valor_meta_acumulada_d1, 0),
    lucroBruto: visibleSummaryRows.reduce((sum, row) => sum + row.lucro_bruto, 0),
  }
  const summaryPercentualAtingido = summaryTotals.valorMeta > 0
    ? (summaryTotals.valorRealizado / summaryTotals.valorMeta) * 100
    : 0
  const summaryPercentualAtingidoAcumuladoD1 = summaryTotals.valorMetaAcumuladaD1 > 0
    ? (summaryTotals.valorRealizado / summaryTotals.valorMetaAcumuladaD1) * 100
    : 0
  const summaryMargemBruta = summaryTotals.valorRealizado > 0
    ? (summaryTotals.lucroBruto / summaryTotals.valorRealizado) * 100
    : 0
  const summaryMediaMetaMargem = visibleSummaryRows.filter((row) => row.meta_margem_percentual != null).length > 0
    ? visibleSummaryRows.reduce((sum, row) => sum + (row.meta_margem_percentual || 0), 0)
      / visibleSummaryRows.filter((row) => row.meta_margem_percentual != null).length
    : null

  // Função para obter nome da filial
  const getFilialName = (filialId: number) => {
    const branch = branches.find((f: { value: string; label: string }) => f.value === filialId.toString())
    return branch ? branch.label : `Filial ${filialId}`
  }

  const getSummaryFilialBadgeClass = (filialId: number) => {
    return summaryFilialBadgeClasses[Math.abs(filialId) % summaryFilialBadgeClasses.length]
  }

  const getWeekdayBadgeClass = (weekday: string | undefined) => {
    if (!weekday) return 'bg-muted text-muted-foreground border-border'
    const normalizedWeekday = weekday
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/-feira/g, '')
      .trim()

    return normalizedWeekdayBadgeClasses[normalizedWeekday]
      ?? weekdayBadgeClasses[weekday]
      ?? 'bg-muted text-muted-foreground border-border'
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
        'Meta Margem',
        'Margem Bruta',
      ]]

      const body: string[][] = []
      const statusMatrix: PdfStatusDirection[][] = []

      visibleSummaryRows.forEach((row) => {
        const atingidoDirection = isCurrentSelectedMonth
          ? null
          : getStatusDirection(row.percentual_atingido >= 100, true)
        const acumuladoDirection = getStatusDirection(row.percentual_atingido_acumulado_d1 >= 100, true)

        body.push([
          row.filial_nome || getFilialName(row.filial_id),
          formatCurrency(row.valor_meta),
          formatCurrency(row.valor_realizado),
          isCurrentSelectedMonth
            ? `${row.percentual_atingido.toFixed(2)}%`
            : formatPdfStatusValue(`${row.percentual_atingido.toFixed(2)}%`, atingidoDirection),
          ...(isCurrentSelectedMonth
            ? [
                formatCurrency(row.valor_meta_acumulada_d1),
                formatPdfStatusValue(`${row.percentual_atingido_acumulado_d1.toFixed(2)}%`, acumuladoDirection),
              ]
            : []),
          formatCurrency(row.lucro_bruto),
          renderMetaMargemStatus(row.meta_margem_percentual),
          `${row.margem_bruta.toFixed(2)}%`,
        ])

        statusMatrix.push([
          null,
          null,
          null,
          atingidoDirection,
          ...(isCurrentSelectedMonth ? [null, acumuladoDirection] : []),
          null,
          null,
          null,
        ])
      })

      const totalAtingidoDirection = isCurrentSelectedMonth
        ? null
        : getStatusDirection(summaryPercentualAtingido >= 100, true)
      const totalAcumuladoDirection = getStatusDirection(summaryPercentualAtingidoAcumuladoD1 >= 100, true)

      body.push([
        'Todas',
        formatCurrency(summaryTotals.valorMeta),
        formatCurrency(summaryTotals.valorRealizado),
        isCurrentSelectedMonth
          ? `${summaryPercentualAtingido.toFixed(2)}%`
          : formatPdfStatusValue(`${summaryPercentualAtingido.toFixed(2)}%`, totalAtingidoDirection),
        ...(isCurrentSelectedMonth
          ? [
              formatCurrency(summaryTotals.valorMetaAcumuladaD1),
              formatPdfStatusValue(`${summaryPercentualAtingidoAcumuladoD1.toFixed(2)}%`, totalAcumuladoDirection),
            ]
          : []),
        formatCurrency(summaryTotals.lucroBruto),
        renderMetaMargemStatus(summaryMediaMetaMargem),
        `${summaryMargemBruta.toFixed(2)}%`,
      ])

      statusMatrix.push([
        null,
        null,
        null,
        totalAtingidoDirection,
        ...(isCurrentSelectedMonth ? [null, totalAcumuladoDirection] : []),
        null,
        null,
        null,
      ])

      doc.setFontSize(16)
      doc.text(`Resumo Meta mensal do Setor: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)} - Setor: ${currentSetor?.nome ?? ''}`, 14, 16)
      doc.setFontSize(10)
      doc.text('Resumo mensal das metas do setor por filial', 14, 22)

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
        didDrawCell: (data: PdfCellHookData) => {
          drawPdfStatusIcon(data, statusMatrix)
        },
      })

      doc.save(`resumo-meta-setor-${selectedSetor}-${mes.toString().padStart(2, '0')}-${ano}.pdf`)
    } catch (error) {
      console.error('Error exporting setor summary PDF:', error)
      toast.error('Erro ao exportar PDF', {
        description: 'Não foi possível gerar o PDF do resumo mensal do setor.'
      })
    } finally {
      setIsExportingSummaryPdf(false)
    }
  }

  if (loadingSetores) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          section="Metas"
          title="Meta de Vendas de Setor"
          description="Acompanhamento de metas por setor e departamento"
          icon={Target}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleAtualizarValores}
            disabled={isUpdatingValues || !currentTenant || !selectedSetor}
            className="h-10"
            title="Atualizar valores realizados com base nas vendas do período"
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
                <Plus className="mr-2 h-4 w-4" />
                Gerar Meta de Vendas
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Gerar Meta de Vendas de Setor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Setores</Label>
                <div className="border rounded-md p-4 max-h-40 overflow-y-auto space-y-2">
                  {setores.map((setor) => (
                    <div key={setor.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`setor-${setor.id}`}
                        checked={generateSalesForm.setor_ids.includes(setor.id.toString())}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setGenerateSalesForm({
                              ...generateSalesForm,
                              setor_ids: [...generateSalesForm.setor_ids, setor.id.toString()],
                            })
                          } else {
                            setGenerateSalesForm({
                              ...generateSalesForm,
                              setor_ids: generateSalesForm.setor_ids.filter((id) => id !== setor.id.toString()),
                            })
                          }
                        }}
                      />
                      <label
                        htmlFor={`setor-${setor.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {setor.nome}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setGenerateSalesForm({
                        ...generateSalesForm,
                        setor_ids: setores.map((s) => s.id.toString()),
                      })
                    }
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setGenerateSalesForm({
                        ...generateSalesForm,
                        setor_ids: [],
                      })
                    }
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Mês</Label>
                  <Select
                    value={generateSalesForm.mes.toString()}
                    onValueChange={(value) =>
                      setGenerateSalesForm({ ...generateSalesForm, mes: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Ano</Label>
                  <Select
                    value={generateSalesForm.ano.toString()}
                    onValueChange={(value) =>
                      setGenerateSalesForm({ ...generateSalesForm, ano: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Filiais</Label>
                <div className="border rounded-md p-4 max-h-40 overflow-y-auto space-y-2">
                  {branches?.map((branch) => (
                    <div key={branch.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filial-${branch.value}`}
                        checked={generateSalesForm.filial_ids.includes(branch.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setGenerateSalesForm({
                              ...generateSalesForm,
                              filial_ids: [...generateSalesForm.filial_ids, branch.value],
                            })
                          } else {
                            setGenerateSalesForm({
                              ...generateSalesForm,
                              filial_ids: generateSalesForm.filial_ids.filter((id) => id !== branch.value),
                            })
                          }
                        }}
                      />
                      <label
                        htmlFor={`filial-${branch.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {branch.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setGenerateSalesForm({
                        ...generateSalesForm,
                        filial_ids: branches?.map((b) => b.value) || [],
                      })
                    }
                  >
                    Selecionar Todas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setGenerateSalesForm({
                        ...generateSalesForm,
                        filial_ids: [],
                      })
                    }
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Data de Referência</Label>
                <DatePicker
                  value={generateSalesForm.data_referencia}
                  onChange={(date) => setGenerateSalesForm({ ...generateSalesForm, data_referencia: date })}
                  placeholder="dd/mm/aaaa"
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <Label>Meta (%)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 8"
                  value={generateSalesForm.meta_percentual ?? ''}
                  onChange={(e) =>
                    setGenerateSalesForm({
                      ...generateSalesForm,
                      meta_percentual: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  step="0.01"
                />
              </div>

              {isGeneratingSales && (
                <div className="bg-muted p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">
                      Gerando metas... {salesGenerationProgress.current} de {salesGenerationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${salesGenerationProgress.total > 0 ? (salesGenerationProgress.current / salesGenerationProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSalesDialogOpen(false)} disabled={isGeneratingSales}>
                Cancelar
              </Button>
              <Button onClick={handleGerarMetaVendas} disabled={isGeneratingSales}>
                {isGeneratingSales ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Meta de Vendas'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

          <Dialog open={marginDialogOpen} onOpenChange={setMarginDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Gerar Meta de Margem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Gerar Meta de Margem de Setor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Setores</Label>
                  <div className="border rounded-md p-4 max-h-40 overflow-y-auto space-y-2">
                    {setores.map((setor) => (
                      <div key={setor.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`margin-setor-${setor.id}`}
                          checked={generateMarginForm.setor_ids.includes(setor.id.toString())}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGenerateMarginForm({
                                ...generateMarginForm,
                                setor_ids: [...generateMarginForm.setor_ids, setor.id.toString()],
                              })
                            } else {
                              setGenerateMarginForm({
                                ...generateMarginForm,
                                setor_ids: generateMarginForm.setor_ids.filter((id) => id !== setor.id.toString()),
                              })
                            }
                          }}
                        />
                        <label
                          htmlFor={`margin-setor-${setor.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {setor.nome}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGenerateMarginForm({
                          ...generateMarginForm,
                          setor_ids: setores.map((s) => s.id.toString()),
                        })
                      }
                    >
                      Selecionar Todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGenerateMarginForm({
                          ...generateMarginForm,
                          setor_ids: [],
                        })
                      }
                    >
                      Limpar Seleção
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>Mês</Label>
                    <Select
                      value={generateMarginForm.mes.toString()}
                      onValueChange={(value) =>
                        setGenerateMarginForm({ ...generateMarginForm, mes: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Ano</Label>
                    <Select
                      value={generateMarginForm.ano.toString()}
                      onValueChange={(value) =>
                        setGenerateMarginForm({ ...generateMarginForm, ano: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Filiais</Label>
                  <div className="border rounded-md p-4 max-h-40 overflow-y-auto space-y-2">
                    {branches?.map((branch) => (
                      <div key={branch.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`margin-filial-${branch.value}`}
                          checked={generateMarginForm.filial_ids.includes(branch.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGenerateMarginForm({
                                ...generateMarginForm,
                                filial_ids: [...generateMarginForm.filial_ids, branch.value],
                              })
                            } else {
                              setGenerateMarginForm({
                                ...generateMarginForm,
                                filial_ids: generateMarginForm.filial_ids.filter((id) => id !== branch.value),
                              })
                            }
                          }}
                        />
                        <label
                          htmlFor={`margin-filial-${branch.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {branch.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGenerateMarginForm({
                          ...generateMarginForm,
                          filial_ids: branches?.map((b) => b.value) || [],
                        })
                      }
                    >
                      Selecionar Todas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGenerateMarginForm({
                          ...generateMarginForm,
                          filial_ids: [],
                        })
                      }
                    >
                      Limpar Seleção
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Meta Margem (%)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 28"
                    value={generateMarginForm.meta_margem_percentual ?? ''}
                    onChange={(e) =>
                      setGenerateMarginForm({
                        ...generateMarginForm,
                        meta_margem_percentual: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>

                {isGeneratingMargin && (
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm font-medium">
                        Gerando metas de margem... {marginGenerationProgress.current} de {marginGenerationProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${marginGenerationProgress.total > 0 ? (marginGenerationProgress.current / marginGenerationProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMarginDialogOpen(false)} disabled={isGeneratingMargin}>
                  Cancelar
                </Button>
                <Button onClick={handleGerarMetaMargem} disabled={isGeneratingMargin}>
                  {isGeneratingMargin ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Gerar Meta de Margem'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
            {/* FILIAIS */}
            <div className="flex flex-col gap-2 w-full lg:w-[200px]">
              <Label>Filiais</Label>
              <MultiFilialFilter
                filiais={branches}
                selectedFiliais={tempFiliaisSelecionadas}
                onChange={setTempFiliaisSelecionadas}
                disabled={isLoadingBranches}
                placeholder={isLoadingBranches ? "Carregando filiais..." : "Selecione as filiais..."}
              />
            </div>

            {/* MÊS */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Label>Mês</Label>
              <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger className="w-full sm:w-[160px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ANO */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Label>Ano</Label>
              <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger className="w-full sm:w-[120px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* SETOR */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Label>Setor</Label>
              <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                <SelectTrigger className="w-full sm:w-[200px] h-10">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.id.toString()}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* BOTÃO FILTRAR */}
            <div className="flex flex-col gap-2">
              <Label className="invisible hidden sm:block">Ação</Label>
              <Button 
                onClick={handleFiltrar} 
                disabled={loading || tempFiliaisSelecionadas.length === 0}
                className="h-10 w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  'Filtrar'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="@container/card bg-white shadow-xs dark:bg-card">
              <CardHeader className="space-y-0.5 p-4 pb-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32" />
              </CardHeader>
              <CardContent className="flex flex-col items-center px-4 pb-4 pt-0">
                {index === 1 || index === 2 ? (
                  <Skeleton className="h-20 w-20 rounded-full" />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleSummaryRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="@container/card min-w-0 bg-white shadow-xs dark:bg-card">
            <CardHeader className="space-y-0.5 p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardDescription className="text-[clamp(12px,1.1vw,14px)] font-semibold leading-none tracking-tight text-foreground">
                  Valor Meta Mês
                </CardDescription>
                <CardInfoTooltip
                  title="Meta consolidada do período"
                  description="Soma mensal das metas do setor para as filiais filtradas"
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
                    className={summaryPercentualAtingido >= 100 ? 'text-green-500' : 'text-primary'}
                    strokeWidth="8"
                    strokeDasharray={`${((summaryPercentualAtingido || 0) / 100) * 201.06} 201.06`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="32"
                    cx="40"
                    cy="40"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[clamp(13px,1.05vw,19px)] font-semibold leading-tight tabular-nums">{summaryPercentualAtingido.toFixed(1)}%</span>
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
                    className={summaryPercentualAtingidoAcumuladoD1 >= 100 ? 'text-green-500' : 'text-primary'}
                    strokeWidth="8"
                    strokeDasharray={`${((summaryPercentualAtingidoAcumuladoD1 || 0) / 100) * 201.06} 201.06`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="32"
                    cx="40"
                    cy="40"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[clamp(13px,1.05vw,19px)] font-semibold leading-tight tabular-nums">{summaryPercentualAtingidoAcumuladoD1.toFixed(1)}%</span>
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
                  description="Soma do lucro bruto realizado do setor"
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
                  description="Lucro bruto sobre o realizado do setor"
                />
              </div>
              <CardTitle className="min-w-0 break-words text-[clamp(20px,1.5vw,26px)] font-semibold leading-tight tabular-nums">
                {formatPlainPercentage(summaryMargemBruta)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>{`Resumo Meta mensal do Setor: ${selectedMonthYearLabel.charAt(0).toUpperCase()}${selectedMonthYearLabel.slice(1)} - Setor: ${currentSetor?.nome ?? ''}`}</CardTitle>
            <CardDescription>Resumo mensal das metas do setor por filial</CardDescription>
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
              Nenhum resumo mensal disponível para o período selecionado.
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
                          {row.filial_nome || getFilialName(row.filial_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(row.valor_meta)}</TableCell>
                      <TableCell>{formatCurrency(row.valor_realizado)}</TableCell>
                      <TableCell>
                        {isCurrentSelectedMonth ? (
                          `${row.percentual_atingido.toFixed(2)}%`
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {row.percentual_atingido >= 100 ? (
                              <CircleArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <CircleArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            {`${row.percentual_atingido.toFixed(2)}%`}
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
                              {`${row.percentual_atingido_acumulado_d1.toFixed(2)}%`}
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
                            {`${row.margem_bruta.toFixed(2)}%`}
                          </span>
                        ) : (
                          `${row.margem_bruta.toFixed(2)}%`
                        )}
                      </TableCell>
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
                        `${summaryPercentualAtingido.toFixed(2)}%`
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {summaryPercentualAtingido >= 100 ? (
                            <CircleArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <CircleArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          {`${summaryPercentualAtingido.toFixed(2)}%`}
                        </span>
                      )}
                    </TableCell>
                    {isCurrentSelectedMonth ? (
                      <>
                        <TableCell>{formatCurrency(summaryTotals.valorMetaAcumuladaD1)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            {summaryPercentualAtingidoAcumuladoD1 >= 100 ? (
                              <CircleArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <CircleArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            {`${summaryPercentualAtingidoAcumuladoD1.toFixed(2)}%`}
                          </span>
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>{formatCurrency(summaryTotals.lucroBruto)}</TableCell>
                    <TableCell>
                      {renderMetaMargemStatus(
                        visibleSummaryRows.filter((row) => row.meta_margem_percentual != null).length > 0
                          ? visibleSummaryRows.reduce((sum, row) => sum + (row.meta_margem_percentual || 0), 0)
                            / visibleSummaryRows.filter((row) => row.meta_margem_percentual != null).length
                          : null
                      )}
                    </TableCell>
                    <TableCell>
                      {visibleSummaryRows.filter((row) => row.meta_margem_percentual != null).length > 0 ? (
                        <span className="inline-flex items-center gap-2">
                          {summaryMargemBruta >= (visibleSummaryRows.reduce((sum, row) => sum + (row.meta_margem_percentual || 0), 0)
                            / visibleSummaryRows.filter((row) => row.meta_margem_percentual != null).length) ? (
                            <CircleArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <CircleArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          {`${summaryMargemBruta.toFixed(2)}%`}
                        </span>
                      ) : (
                        `${summaryMargemBruta.toFixed(2)}%`
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Metas */}
      {loading ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Table Header Skeleton */}
              <div className="grid grid-cols-11 gap-4 pb-4 border-b">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>

              {/* Table Rows Skeleton */}
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-11 gap-4 py-3 border-b">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : currentSetorData.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>{`Resumo de Metas do Setor por Dia: ${format(new Date(ano, mes - 1, 1), 'MMMM/yyyy', { locale: ptBR })} - Setor: ${currentSetor?.nome ?? ''}`}</CardTitle>
              <CardDescription>Acompanhamento detalhado de Metas do Setor por dia e filial</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDailyPdf}
              disabled={loading || isExportingDailyPdf || currentSetorData.length === 0}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              {isExportingDailyPdf ? 'Exportando...' : 'Exportar PDF'}
            </Button>
          </CardHeader>
          <CardContent>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSetorData.map((meta) => {
                  const isExpanded = expandedDates[meta.data] === true // Fechado por padrão
                  const totals = meta.filiais.reduce(
                    (acc, f) => ({
                      valor_referencia: acc.valor_referencia + (f.valor_referencia || 0),
                      valor_meta: acc.valor_meta + (f.valor_meta || 0),
                      valor_realizado: acc.valor_realizado + (f.valor_realizado || 0),
                      custo_realizado: acc.custo_realizado + (f.custo_realizado || 0),
                      lucro_realizado: acc.lucro_realizado + (f.lucro_realizado || 0),
                      diferenca: acc.diferenca + (f.diferenca || 0),
                      meta_percentual: acc.meta_percentual + (f.meta_percentual ?? f.percentual_atingido ?? 0),
                      count: acc.count + 1,
                    }),
                    {
                      valor_referencia: 0,
                      valor_meta: 0,
                      valor_realizado: 0,
                      custo_realizado: 0,
                      lucro_realizado: 0,
                      diferenca: 0,
                      meta_percentual: 0,
                      count: 0,
                    }
                  )

                  const avgMeta = totals.count > 0 ? totals.meta_percentual / totals.count : 0
                  const metaMargemRows = meta.filiais.filter((f) => f.meta_margem_percentual != null)
                  const mediaMetaMargem = metaMargemRows.length > 0
                    ? metaMargemRows.reduce((sum, f) => sum + (f.meta_margem_percentual || 0), 0) / metaMargemRows.length
                    : null
                  const percentualAtingido =
                    totals.valor_meta > 0
                      ? (totals.valor_realizado / totals.valor_meta) * 100
                      : 0

                  // Verificar se deve mostrar diferença
                  const showDiff = shouldShowDifference(meta.data, totals.valor_realizado)

                  return (
                    <Fragment key={meta.data}>
                      <TableRow
                        className="bg-muted/40 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleDate(meta.data)}
                      >
                        <TableCell className="w-5">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(meta.data), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="w-[110px]">
                          {meta.dia_semana ? (
                            <Badge variant="outline" className={getWeekdayBadgeClass(meta.dia_semana)}>
                              {meta.dia_semana}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(totals.valor_referencia)}
                        </TableCell>
                        <TableCell>
                          {avgMeta.toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          {formatCurrency(totals.valor_meta)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(totals.valor_realizado)}
                        </TableCell>
                        <TableCell>
                          {showDiff ? (
                            <span className="inline-flex items-center gap-2">
                              {percentualAtingido >= 100 ? (
                                <CircleArrowUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <CircleArrowDown className="h-4 w-4 text-red-600" />
                              )}
                              {`${percentualAtingido.toFixed(2)}%`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {showDiff ? (
                            formatCurrency(totals.lucro_realizado)
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {renderMetaMargemStatus(mediaMetaMargem)}
                        </TableCell>
                        <TableCell>
                          {showDiff ? (
                            (() => {
                              const margem = getMargemRealizada(totals.valor_realizado, totals.lucro_realizado)
                              return mediaMetaMargem != null && mediaMetaMargem > 0 ? (
                                <span className="inline-flex items-center gap-2">
                                  {margem >= mediaMetaMargem ? (
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
                      </TableRow>

                      {isExpanded &&
                        meta.filiais.map((filial) => {
                          const percentualAtingidoFilial = filial.valor_meta > 0
                            ? (filial.valor_realizado / filial.valor_meta) * 100
                            : 0
                          const isEditingPercentual = editingCell?.data === meta.data && editingCell?.filialId === filial.filial_id && editingCell?.field === 'percentual'
                          const isEditingValor = editingCell?.data === meta.data && editingCell?.filialId === filial.filial_id && editingCell?.field === 'valor'
                          const showFilialDiff = shouldShowDifference(meta.data, filial.valor_realizado)
                          
                          return (
                            <TableRow
                              key={`${meta.data}-${filial.filial_id}`}
                              className="bg-background/50"
                            >
                              <TableCell></TableCell>
                              <TableCell className="pl-4 text-sm">
                                <Badge
                                  variant="outline"
                                  className={getSummaryFilialBadgeClass(filial.filial_id)}
                                >
                                  {getFilialName(filial.filial_id)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {filial.data_referencia
                                  ? `Ref: ${format(parseISO(filial.data_referencia), 'dd/MM/yyyy')}`
                                  : '-'
                                }
                              </TableCell>
                              <TableCell className="text-sm">
                                {filial.valor_referencia != null
                                  ? formatCurrency(filial.valor_referencia)
                                  : '-'
                                }
                              </TableCell>

                              {/* Meta % - Editável (ou Atingido % se meta_percentual não existir) */}
                              <TableCell
                                className="text-sm cursor-pointer hover:bg-muted/50 transition-colors group"
                                onDoubleClick={() => startEditing(meta.data, filial.filial_id, 'percentual', filial.meta_percentual ?? filial.percentual_atingido ?? 0)}
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
                                    {filial.meta_percentual != null
                                      ? `${filial.meta_percentual.toFixed(2)}%`
                                      : (filial.percentual_atingido != null ? `${filial.percentual_atingido.toFixed(2)}%` : '-')
                                    }
                                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">✏️</span>
                                  </span>
                                )}
                              </TableCell>
                              
                              {/* Valor Meta - Editável */}
                              <TableCell 
                                className="text-sm cursor-pointer hover:bg-muted/50 transition-colors group"
                                onDoubleClick={() => startEditing(meta.data, filial.filial_id, 'valor', filial.valor_meta)}
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
                                    {formatCurrency(filial.valor_meta)}
                                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">✏️</span>
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(filial.valor_realizado)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {showFilialDiff ? (
                                  <span className="inline-flex items-center gap-2">
                                    {percentualAtingidoFilial >= 100 ? (
                                      <CircleArrowUp className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <CircleArrowDown className="h-4 w-4 text-red-600" />
                                    )}
                                    {`${percentualAtingidoFilial.toFixed(2)}%`}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {showFilialDiff ? (
                                  formatCurrency(filial.lucro_realizado || 0)
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {renderMetaMargemStatus(filial.meta_margem_percentual)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {showFilialDiff ? (
                                  (() => {
                                    const margem = getMargemRealizada(filial.valor_realizado, filial.lucro_realizado || 0)
                                    return filial.meta_margem_percentual != null && filial.meta_margem_percentual > 0 ? (
                                      <span className="inline-flex items-center gap-2">
                                        {margem >= filial.meta_margem_percentual ? (
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
                            </TableRow>
                          )
                        })}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhuma meta encontrada para este setor.
              <br />
              Clique em &quot;Gerar Meta&quot; para criar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
