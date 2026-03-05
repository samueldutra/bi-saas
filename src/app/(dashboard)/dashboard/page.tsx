'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CardMetric } from '@/components/dashboard/card-metric'
import { ChartVendas } from '@/components/dashboard/chart-vendas'
import { useTenantContext } from '@/contexts/tenant-context'
import { format, startOfMonth } from 'date-fns'
import { MultiSelect } from '@/components/ui/multi-select'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatPercentage } from '@/lib/chart-config'
import { useBranchesOptions } from '@/hooks/use-branches'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronUp, ChevronDown, FileDown, LayoutDashboard } from 'lucide-react'
import { logModuleAccess } from '@/lib/audit'
import { createClient } from '@/lib/supabase/client'
import { DashboardFilter, type FilterType } from '@/components/dashboard/dashboard-filter'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Tipo de venda para o filtro
type SalesType = 'complete' | 'pdv' | 'faturamento'

// Estrutura de dados da API
interface DashboardData {
  total_vendas: number
  total_lucro: number
  ticket_medio: number
  margem_lucro: number
  pa_vendas: number
  pa_lucro: number
  pa_ticket_medio: number
  pa_margem_lucro: number
  variacao_vendas_mes: number
  variacao_lucro_mes: number
  variacao_ticket_mes: number
  variacao_margem_mes: number
  variacao_vendas_ano: number
  variacao_lucro_ano: number
  variacao_ticket_ano: number
  variacao_margem_ano: number
  ytd_vendas: number
  ytd_vendas_ano_anterior: number
  ytd_variacao_percent: number
  grafico_vendas: Array<{
    mes: string
    ano_atual: number
    ano_anterior: number
  }>
}

// Estrutura de dados YTD (Receita, Lucro e Margem)
interface YTDMetrics {
  ytd_vendas: number
  ytd_vendas_ano_anterior: number
  ytd_variacao_vendas_percent: number
  ytd_lucro: number
  ytd_lucro_ano_anterior: number
  ytd_variacao_lucro_percent: number
  ytd_margem: number
  ytd_margem_ano_anterior: number
  ytd_variacao_margem: number
}

// Estrutura de dados MTD (Month-to-Date - Receita, Lucro e Margem)
interface MTDMetrics {
  mtd_vendas: number
  mtd_lucro: number
  mtd_margem: number
  mtd_mes_anterior_vendas: number
  mtd_mes_anterior_lucro: number
  mtd_mes_anterior_margem: number
  mtd_variacao_mes_anterior_vendas_percent: number
  mtd_variacao_mes_anterior_lucro_percent: number
  mtd_variacao_mes_anterior_margem: number
  mtd_ano_anterior_vendas: number
  mtd_ano_anterior_lucro: number
  mtd_ano_anterior_margem: number
  mtd_variacao_ano_anterior_vendas_percent: number
  mtd_variacao_ano_anterior_lucro_percent: number
  mtd_variacao_ano_anterior_margem: number
}

interface VendaPorFilial {
  filial_id: number
  valor_total: number
  custo_total: number
  total_lucro: number
  quantidade_total: number
  total_transacoes: number
  ticket_medio: number
  margem_lucro: number
  pa_valor_total: number
  pa_custo_total: number
  pa_total_lucro: number
  pa_total_transacoes: number
  pa_ticket_medio: number
  pa_margem_lucro: number
  delta_valor: number
  delta_valor_percent: number
  delta_custo: number
  delta_custo_percent: number
  delta_lucro: number
  delta_lucro_percent: number
  delta_margem: number
  // Campos de Entradas (compras)
  total_entradas: number
  pa_total_entradas: number
  delta_entradas: number
  delta_entradas_percent: number
  // Campos de Cupons
  total_cupons: number
  pa_total_cupons: number
  delta_cupons: number
  delta_cupons_percent: number
  // Campos de SKU
  total_sku: number
  pa_total_sku: number
  delta_sku: number
  delta_sku_percent: number
}

// Interface para resposta da API de vendas por filial
interface VendasPorFilialResponse {
  vendas: VendaPorFilial[]
  total_sku_distinct: number
  pa_total_sku_distinct: number
}

// Interface para dados de faturamento
interface FaturamentoData {
  receita_faturamento: number
  cmv_faturamento: number
  lucro_bruto_faturamento: number
  qtd_notas: number
}

// Interface para faturamento por filial
interface FaturamentoPorFilial {
  filial_id: number
  receita_faturamento: number
  cmv_faturamento: number
  lucro_bruto_faturamento: number
}

// Interface para dados de entradas e perdas
interface EntradasPerdasData {
  total_entradas: number
  total_perdas: number
}

// Tipos para ordenação
type SortColumn = 'filial_id' | 'valor_total' | 'ticket_medio' | 'custo_total' | 'total_lucro' | 'margem_lucro' | 'total_entradas' | 'total_cupons' | 'total_sku'
type SortDirection = 'asc' | 'desc'

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const getDefaultCurrentMonthEndDate = (): Date => {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const yesterday = new Date(today)
  yesterday.setHours(0, 0, 0, 0)
  yesterday.setDate(yesterday.getDate() - 1)

  return yesterday < monthStart ? monthStart : yesterday
}

export default function DashboardPage() {
  const { currentTenant, userProfile } = useTenantContext()

  // Estados para os filtros
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(new Date()))
  const [dataFim, setDataFim] = useState<Date>(getDefaultCurrentMonthEndDate())
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<{ value: string; label: string }[]>([])
  const [filterType, setFilterType] = useState<FilterType>('month')
  const [salesType, setSalesType] = useState<SalesType>('complete')

  // Estados para ordenação da tabela
  const [sortColumn, setSortColumn] = useState<SortColumn>('filial_id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Estado para exportação PDF
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  // Estado para os parâmetros que serão enviados à API
  const [apiParams, setApiParams] = useState({
    schema: currentTenant?.supabase_schema,
    data_inicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    data_fim: format(getDefaultCurrentMonthEndDate(), 'yyyy-MM-dd'),
    filiais: 'all',
    filter_type: 'month' as FilterType,
  })

  // Handler para mudança de período
  const handlePeriodChange = (start: Date, end: Date, type: FilterType) => {
    setDataInicio(start)
    setDataFim(end)
    setFilterType(type)
  }

  // Calcula o label de comparação dinâmico
  const getComparisonLabel = (): string => {
    if (!dataInicio || !dataFim) return 'PA'
    
    const start = new Date(dataInicio)
    const end = new Date(dataFim)
    
    // Verifica se é um ano completo (01/Jan a 31/Dez)
    const isFullYear = 
      start.getMonth() === 0 && start.getDate() === 1 &&
      end.getMonth() === 11 && end.getDate() === 31 &&
      start.getFullYear() === end.getFullYear()
    
    if (isFullYear) {
      // Se é ano completo, mostra o ano anterior
      return (start.getFullYear() - 1).toString()
    }
    
    // Verifica se é um mês completo
    const isFullMonth = 
      start.getDate() === 1 &&
      end.getMonth() === start.getMonth() &&
      end.getFullYear() === start.getFullYear() &&
      end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
    
    if (isFullMonth) {
      // Se é mês completo, mostra mês anterior (ex: "Out/2024")
      const previousMonth = new Date(start)
      previousMonth.setMonth(previousMonth.getMonth() - 1)
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      return `${monthNames[previousMonth.getMonth()]}/${previousMonth.getFullYear()}`
    }
    
    // Caso contrário, usa PA (Período Anterior)
    return 'PA'
  }

  // Verifica se deve mostrar comparação YTD (Year-to-Date)
  const shouldShowYTD = (): boolean => {
    if (!dataInicio || !dataFim) return false

    const start = new Date(dataInicio)
    const end = new Date(dataFim)
    const today = new Date()

    // Verifica se é um ano completo (01/Jan a 31/Dez)
    const isFullYear =
      start.getMonth() === 0 && start.getDate() === 1 &&
      end.getMonth() === 11 && end.getDate() === 31 &&
      start.getFullYear() === end.getFullYear()

    // Verifica se é o ano atual
    const isCurrentYear = start.getFullYear() === today.getFullYear()

    // Mostra YTD apenas se for ano completo E ano atual
    return isFullYear && isCurrentYear
  }

  // Verifica se o filtro é por ano (atual ou passado) - para Entradas/Perdas
  const shouldShowYearComparison = (): boolean => {
    if (!dataInicio || !dataFim) return false

    const start = new Date(dataInicio)
    const end = new Date(dataFim)

    // Verifica se começa em 01/Jan
    const startsJan1 = start.getMonth() === 0 && start.getDate() === 1

    // Verifica se termina em 31/Dez (ano completo passado) ou é ano atual
    const isFullYearPast =
      end.getMonth() === 11 && end.getDate() === 31 &&
      start.getFullYear() === end.getFullYear()

    // Ou é o ano atual (pode não ter terminado ainda)
    const today = new Date()
    const isCurrentYear = start.getFullYear() === today.getFullYear()

    return startsJan1 && (isFullYearPast || isCurrentYear)
  }

  // Calcula label para comparação de ano anterior
  const getYearComparisonLabel = (): string => {
    if (!dataInicio) return ''
    const start = new Date(dataInicio)
    return `${start.getFullYear() - 1}`
  }

  // Calcula label YTD
  const getYTDLabel = (): string => {
    if (!dataInicio) return ''
    const start = new Date(dataInicio)
    return `${start.getFullYear() - 1} YTD`
  }

  // Verifica se deve mostrar comparação MTD (Month-to-Date)
  const shouldShowMTD = (): boolean => {
    if (!dataInicio || !dataFim) return false

    // Só mostra MTD quando filterType é 'month'
    return filterType === 'month'
  }

  // Calcula label MTD para mês anterior (ex: "OUT/2025")
  const getMTDPreviousMonthLabel = (): string => {
    if (!dataInicio) return ''
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const start = new Date(dataInicio)
    const previousMonth = new Date(start)
    previousMonth.setMonth(previousMonth.getMonth() - 1)
    return `${monthNames[previousMonth.getMonth()].toUpperCase()}/${previousMonth.getFullYear()}`
  }

  // Calcula label MTD para ano anterior (ex: "NOV/2024")
  const getMTDPreviousYearLabel = (): string => {
    if (!dataInicio) return ''
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const start = new Date(dataInicio)
    const previousYear = new Date(start)
    previousYear.setFullYear(previousYear.getFullYear() - 1)
    return `${monthNames[previousYear.getMonth()].toUpperCase()}/${previousYear.getFullYear()}`
  }

  // Calcula a variação correta: valor atual vs. valor comparativo (PA)
  const calculateVariationPercent = (current: number, previous: number): number => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  // Log de acesso ao módulo
  useEffect(() => {
    const logAccess = async () => {
      if (currentTenant && userProfile) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        // Log module access
        logModuleAccess({
          module: 'dashboard',
          tenantId: currentTenant.id,
          userName: userProfile.full_name,
          userEmail: user?.email || ''
        })
      }
    }
    logAccess()
  }, [currentTenant, userProfile])

  // Aplicar filtros automaticamente quando mudarem
  useEffect(() => {
    if (!currentTenant?.supabase_schema || !dataInicio || !dataFim) return

    const filiaisParam = filiaisSelecionadas.length === 0
      ? 'all'
      : filiaisSelecionadas.map(f => f.value).join(',');

    setApiParams({
      schema: currentTenant.supabase_schema,
      data_inicio: format(dataInicio, 'yyyy-MM-dd'),
      data_fim: format(dataFim, 'yyyy-MM-dd'),
      filiais: filiaisParam,
      filter_type: filterType,
    })
  }, [currentTenant?.supabase_schema, dataInicio, dataFim, filiaisSelecionadas, filterType])

  const apiUrl = apiParams.schema
    ? `/api/dashboard?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}`
    : null

  const { data, error, isLoading } = useSWR<DashboardData>(apiUrl, fetcher, { refreshInterval: 0 });

  // Buscar dados YTD (Lucro e Margem) - apenas quando shouldShowYTD() === true
  const shouldFetchYTD = apiParams.schema && shouldShowYTD()
  const ytdApiUrl = shouldFetchYTD
    ? `/api/dashboard/ytd-metrics?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: ytdData, error: ytdError } = useSWR<YTDMetrics>(ytdApiUrl, fetcher, { refreshInterval: 0 });

  // Debug: Log YTD status
  useEffect(() => {
    console.log('[YTD DEBUG]', {
      shouldShowYTD: shouldShowYTD(),
      shouldFetchYTD,
      ytdApiUrl,
      ytdData,
      ytdError,
      dataInicio,
      dataFim
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFetchYTD, ytdApiUrl, ytdData, ytdError, dataInicio, dataFim])

  // Buscar dados MTD (Month-to-Date) - apenas quando shouldShowMTD() === true
  const shouldFetchMTD = apiParams.schema && shouldShowMTD()
  const mtdApiUrl = shouldFetchMTD
    ? `/api/dashboard/mtd-metrics?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: mtdData, error: mtdError } = useSWR<MTDMetrics>(mtdApiUrl, fetcher, { refreshInterval: 0 });

  // Debug: Log MTD status
  useEffect(() => {
    console.log('[MTD DEBUG]', {
      shouldShowMTD: shouldShowMTD(),
      shouldFetchMTD,
      mtdApiUrl,
      mtdData,
      mtdError,
      filterType,
      dataInicio,
      dataFim
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFetchMTD, mtdApiUrl, mtdData, mtdError, filterType, dataInicio, dataFim])

  // Buscar dados para o gráfico de vendas (com filtro de filiais e período)
  const chartApiUrl = apiParams.schema
    ? `/api/charts/sales-by-month?schema=${apiParams.schema}&filiais=${apiParams.filiais}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filter_type=${apiParams.filter_type}`
    : null
  const { data: chartData, isLoading: isChartLoading } = useSWR(chartApiUrl, fetcher, { refreshInterval: 0 });

  // Buscar dados de vendas por filial
  const vendasFilialUrl = apiParams.schema
    ? `/api/dashboard/vendas-por-filial?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}&filter_type=${apiParams.filter_type}`
    : null
  const { data: vendasPorFilialData, isLoading: isLoadingVendasFilial } = useSWR<VendasPorFilialResponse>(
    vendasFilialUrl, 
    fetcher, 
    { 
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 0
    }
  );

  // Extrair totais de SKU
  const totalSkuDistinct = vendasPorFilialData?.total_sku_distinct || 0
  const paTotalSkuDistinct = vendasPorFilialData?.pa_total_sku_distinct || 0

  // Força revalidação quando URL mudar (filtros mudaram)
  useEffect(() => {
    if (vendasFilialUrl) {
      mutate(vendasFilialUrl)
    }
  }, [vendasFilialUrl])

  // Buscar dados de faturamento (totais)
  const faturamentoUrl = apiParams.schema
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: faturamentoData } = useSWR<FaturamentoData>(faturamentoUrl, fetcher, { refreshInterval: 0 });

  // Buscar dados de faturamento por filial
  const faturamentoPorFilialUrl = apiParams.schema
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}&por_filial=true`
    : null
  const { data: faturamentoPorFilialData } = useSWR<FaturamentoPorFilial[]>(faturamentoPorFilialUrl, fetcher, { refreshInterval: 0 });

  // Buscar dados de Entradas e Perdas
  const entradasPerdasUrl = apiParams.schema
    ? `/api/dashboard/entradas-perdas?schema=${apiParams.schema}&data_inicio=${apiParams.data_inicio}&data_fim=${apiParams.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: entradasPerdasData, isLoading: isLoadingEntradasPerdas } = useSWR<EntradasPerdasData>(entradasPerdasUrl, fetcher, { refreshInterval: 0 });

  // Calcular datas MTD para Entradas/Perdas do mês anterior
  const entradasPerdasMtdDates = useMemo(() => {
    if (!apiParams.data_inicio || !apiParams.data_fim) return null

    const dataInicio = new Date(apiParams.data_inicio + 'T00:00:00')
    const dataFim = new Date(apiParams.data_fim + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Verificar se é mês passado completo
    const isFirstDayOfMonth = dataInicio.getDate() === 1
    const lastDayOfFilterMonth = new Date(dataInicio.getFullYear(), dataInicio.getMonth() + 1, 0).getDate()
    const isLastDayOfMonth = dataFim.getDate() === lastDayOfFilterMonth
    const isPastMonth = dataFim < today
    const isFullPastMonth = isFirstDayOfMonth && isLastDayOfMonth && isPastMonth

    // Primeiro dia do mês anterior
    const mtdInicio = new Date(dataInicio.getFullYear(), dataInicio.getMonth() - 1, 1)

    // Último dia do mês anterior
    const lastDayPrevMonth = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 0).getDate()

    let mtdFim: Date
    if (isFullPastMonth) {
      // Mês passado completo: buscar mês anterior completo
      mtdFim = new Date(mtdInicio.getFullYear(), mtdInicio.getMonth(), lastDayPrevMonth)
    } else {
      // MTD proporcional: usar mesmo número de dias, ajustando para meses com menos dias
      const referenceDay = dataFim >= today ? today.getDate() : dataFim.getDate()
      const mtdEndDay = Math.min(referenceDay, lastDayPrevMonth)
      mtdFim = new Date(mtdInicio.getFullYear(), mtdInicio.getMonth(), mtdEndDay)
    }

    return {
      data_inicio: format(mtdInicio, 'yyyy-MM-dd'),
      data_fim: format(mtdFim, 'yyyy-MM-dd')
    }
  }, [apiParams.data_inicio, apiParams.data_fim])

  // Buscar dados de Entradas e Perdas do mês anterior (MTD) - apenas quando filterType === 'month'
  const shouldFetchEntradasPerdasMtd = apiParams.schema && shouldShowMTD() && entradasPerdasMtdDates
  const entradasPerdasMtdUrl = shouldFetchEntradasPerdasMtd
    ? `/api/dashboard/entradas-perdas?schema=${apiParams.schema}&data_inicio=${entradasPerdasMtdDates.data_inicio}&data_fim=${entradasPerdasMtdDates.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: entradasPerdasMtdData } = useSWR<EntradasPerdasData>(entradasPerdasMtdUrl, fetcher, { refreshInterval: 0 });

  // Calcular datas do ano anterior para Entradas/Perdas (YTD)
  const entradasPerdasYtdDates = useMemo(() => {
    if (!apiParams.data_inicio || !apiParams.data_fim) return null

    const dataInicio = new Date(apiParams.data_inicio + 'T00:00:00')
    const dataFim = new Date(apiParams.data_fim + 'T00:00:00')

    // Verificar se começa em 01/Jan
    const startsJan1 = dataInicio.getMonth() === 0 && dataInicio.getDate() === 1

    if (!startsJan1) return null

    // Verificar se é ano completo passado (01/Jan a 31/Dez)
    const isFullYearPast =
      dataFim.getMonth() === 11 && dataFim.getDate() === 31 &&
      dataInicio.getFullYear() === dataFim.getFullYear()

    const anoAnterior = dataInicio.getFullYear() - 1

    // Início: 01/Jan do ano anterior
    const ytdInicio = new Date(anoAnterior, 0, 1)

    let ytdFim: Date
    if (isFullYearPast) {
      // Ano completo passado: buscar ano anterior completo
      ytdFim = new Date(anoAnterior, 11, 31)
    } else {
      // Ano atual (YTD proporcional): usar mesmo dia/mês do ano anterior
      // Ajustar para 28/Fev se for 29/Fev em ano bissexto
      const endMonth = dataFim.getMonth()
      const endDay = dataFim.getDate()

      // Verificar se o dia existe no ano anterior (ex: 29/Fev)
      const lastDayOfMonthPrevYear = new Date(anoAnterior, endMonth + 1, 0).getDate()
      const adjustedDay = Math.min(endDay, lastDayOfMonthPrevYear)

      ytdFim = new Date(anoAnterior, endMonth, adjustedDay)
    }

    return {
      data_inicio: format(ytdInicio, 'yyyy-MM-dd'),
      data_fim: format(ytdFim, 'yyyy-MM-dd')
    }
  }, [apiParams.data_inicio, apiParams.data_fim])

  // Buscar dados de Entradas e Perdas do ano anterior (YTD) - apenas quando filtro é por ano
  const shouldFetchEntradasPerdasYtd = apiParams.schema && shouldShowYearComparison() && entradasPerdasYtdDates
  const entradasPerdasYtdUrl = shouldFetchEntradasPerdasYtd
    ? `/api/dashboard/entradas-perdas?schema=${apiParams.schema}&data_inicio=${entradasPerdasYtdDates.data_inicio}&data_fim=${entradasPerdasYtdDates.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: entradasPerdasYtdData } = useSWR<EntradasPerdasData>(entradasPerdasYtdUrl, fetcher, { refreshInterval: 0 });

  // Calcular datas do período anterior (PA) para buscar faturamento
  const paDates = useMemo(() => {
    if (!apiParams.data_inicio || !apiParams.data_fim) return null

    const dataInicio = new Date(apiParams.data_inicio + 'T00:00:00')
    const dataFim = new Date(apiParams.data_fim + 'T00:00:00')

    // Verificar se é ano completo (01/Jan a 31/Dez)
    const isFullYear =
      dataInicio.getMonth() === 0 && dataInicio.getDate() === 1 &&
      dataFim.getMonth() === 11 && dataFim.getDate() === 31 &&
      dataInicio.getFullYear() === dataFim.getFullYear()

    let paInicio: Date
    let paFim: Date

    if (isFullYear) {
      // Para ano completo: usar ano anterior completo
      paInicio = new Date(dataInicio.getFullYear() - 1, 0, 1)
      paFim = new Date(dataInicio.getFullYear() - 1, 11, 31)
    } else {
      // Para outros períodos: mesmo período, um mês antes
      paInicio = new Date(dataInicio)
      paInicio.setMonth(paInicio.getMonth() - 1)
      paFim = new Date(dataFim)
      paFim.setMonth(paFim.getMonth() - 1)
    }

    return {
      data_inicio: format(paInicio, 'yyyy-MM-dd'),
      data_fim: format(paFim, 'yyyy-MM-dd')
    }
  }, [apiParams.data_inicio, apiParams.data_fim])

  // Buscar dados de faturamento do período anterior (PA)
  const faturamentoPaUrl = apiParams.schema && paDates
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${paDates.data_inicio}&data_fim=${paDates.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: faturamentoPaData } = useSWR<FaturamentoData>(faturamentoPaUrl, fetcher, { refreshInterval: 0 });

  // Datas de comparação usadas na tabela de Vendas por Filial (mesma lógica da RPC get_vendas_por_filial)
  const vendasPorFilialComparisonDates = useMemo(() => {
    if (!apiParams.data_inicio || !apiParams.data_fim) return null

    const dataInicio = new Date(apiParams.data_inicio + 'T00:00:00')
    const dataFim = new Date(apiParams.data_fim + 'T00:00:00')

    let comparisonStart: Date
    let comparisonEnd: Date

    if (apiParams.filter_type === 'custom') {
      const diffMs = dataFim.getTime() - dataInicio.getTime()
      const rangeDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
      comparisonStart = new Date(dataInicio)
      comparisonStart.setDate(comparisonStart.getDate() - rangeDays)
      comparisonEnd = new Date(dataInicio)
      comparisonEnd.setDate(comparisonEnd.getDate() - 1)
    } else {
      comparisonStart = new Date(dataInicio)
      comparisonStart.setFullYear(comparisonStart.getFullYear() - 1)
      comparisonEnd = new Date(dataFim)
      comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1)
    }

    return {
      data_inicio: format(comparisonStart, 'yyyy-MM-dd'),
      data_fim: format(comparisonEnd, 'yyyy-MM-dd')
    }
  }, [apiParams.data_inicio, apiParams.data_fim, apiParams.filter_type])

  // Faturamento comparativo para alinhar valores da tabela com o card (mesmo período comparativo)
  const faturamentoComparativoUrl = apiParams.schema && vendasPorFilialComparisonDates
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${vendasPorFilialComparisonDates.data_inicio}&data_fim=${vendasPorFilialComparisonDates.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: faturamentoComparativoData } = useSWR<FaturamentoData>(faturamentoComparativoUrl, fetcher, { refreshInterval: 0 });

  const faturamentoPorFilialComparativoUrl = apiParams.schema && vendasPorFilialComparisonDates
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${vendasPorFilialComparisonDates.data_inicio}&data_fim=${vendasPorFilialComparisonDates.data_fim}&filiais=${apiParams.filiais}&por_filial=true`
    : null
  const { data: faturamentoPorFilialComparativoData } = useSWR<FaturamentoPorFilial[]>(faturamentoPorFilialComparativoUrl, fetcher, { refreshInterval: 0 });

  // Calcular datas MTD para mês anterior (ex: OUT/2025 quando atual é NOV/2025)
  // Quando filtro é mês passado completo, busca mês anterior completo
  const mtdPreviousMonthDates = useMemo(() => {
    if (!apiParams.data_inicio || !apiParams.data_fim) return null

    const dataInicio = new Date(apiParams.data_inicio + 'T00:00:00')
    const dataFim = new Date(apiParams.data_fim + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Verificar se é mês passado completo
    const isFirstDayOfMonth = dataInicio.getDate() === 1
    const lastDayOfFilterMonth = new Date(dataInicio.getFullYear(), dataInicio.getMonth() + 1, 0).getDate()
    const isLastDayOfMonth = dataFim.getDate() === lastDayOfFilterMonth
    const isPastMonth = dataFim < today
    const isFullPastMonth = isFirstDayOfMonth && isLastDayOfMonth && isPastMonth

    // Primeiro dia do mês anterior
    const mtdInicio = new Date(dataInicio.getFullYear(), dataInicio.getMonth() - 1, 1)

    // Último dia do mês anterior
    const lastDayPrevMonth = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 0).getDate()

    let mtdFim: Date
    if (isFullPastMonth) {
      // Mês passado completo: buscar mês anterior completo
      mtdFim = new Date(mtdInicio.getFullYear(), mtdInicio.getMonth(), lastDayPrevMonth)
    } else {
      // MTD proporcional: usar mesmo número de dias
      const referenceDay = dataFim >= today ? today.getDate() : dataFim.getDate()
      const mtdEndDay = Math.min(referenceDay, lastDayPrevMonth)
      mtdFim = new Date(mtdInicio.getFullYear(), mtdInicio.getMonth(), mtdEndDay)
    }

    return {
      data_inicio: format(mtdInicio, 'yyyy-MM-dd'),
      data_fim: format(mtdFim, 'yyyy-MM-dd')
    }
  }, [apiParams.data_inicio, apiParams.data_fim])

  // Calcular datas MTD para mesmo mês do ano anterior (ex: NOV/2024 quando atual é NOV/2025)
  // Quando filtro é mês passado completo, busca mesmo mês do ano anterior completo
  const mtdPreviousYearDates = useMemo(() => {
    if (!apiParams.data_inicio || !apiParams.data_fim) return null

    const dataInicio = new Date(apiParams.data_inicio + 'T00:00:00')
    const dataFim = new Date(apiParams.data_fim + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Verificar se é mês passado completo
    const isFirstDayOfMonth = dataInicio.getDate() === 1
    const lastDayOfFilterMonth = new Date(dataInicio.getFullYear(), dataInicio.getMonth() + 1, 0).getDate()
    const isLastDayOfMonth = dataFim.getDate() === lastDayOfFilterMonth
    const isPastMonth = dataFim < today
    const isFullPastMonth = isFirstDayOfMonth && isLastDayOfMonth && isPastMonth

    // Primeiro dia do mesmo mês no ano anterior
    const mtdInicio = new Date(dataInicio.getFullYear() - 1, dataInicio.getMonth(), 1)

    // Último dia do mesmo mês no ano anterior
    const lastDayPrevYear = new Date(dataInicio.getFullYear() - 1, dataInicio.getMonth() + 1, 0).getDate()

    let mtdFim: Date
    if (isFullPastMonth) {
      // Mês passado completo: buscar mesmo mês do ano anterior completo
      mtdFim = new Date(mtdInicio.getFullYear(), mtdInicio.getMonth(), lastDayPrevYear)
    } else {
      // MTD proporcional: usar mesmo número de dias
      const referenceDay = dataFim >= today ? today.getDate() : dataFim.getDate()
      const mtdEndDay = Math.min(referenceDay, lastDayPrevYear)
      mtdFim = new Date(mtdInicio.getFullYear(), mtdInicio.getMonth(), mtdEndDay)
    }

    return {
      data_inicio: format(mtdInicio, 'yyyy-MM-dd'),
      data_fim: format(mtdFim, 'yyyy-MM-dd')
    }
  }, [apiParams.data_inicio, apiParams.data_fim])

  // Buscar faturamento do mês anterior (MTD)
  const shouldFetchMTDFaturamento = apiParams.schema && shouldShowMTD()
  const faturamentoMtdPreviousMonthUrl = shouldFetchMTDFaturamento && mtdPreviousMonthDates
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${mtdPreviousMonthDates.data_inicio}&data_fim=${mtdPreviousMonthDates.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: faturamentoMtdPreviousMonthData } = useSWR<FaturamentoData>(faturamentoMtdPreviousMonthUrl, fetcher, { refreshInterval: 0 });

  // Buscar faturamento do ano anterior (MTD)
  const faturamentoMtdPreviousYearUrl = shouldFetchMTDFaturamento && mtdPreviousYearDates
    ? `/api/faturamento?schema=${apiParams.schema}&data_inicio=${mtdPreviousYearDates.data_inicio}&data_fim=${mtdPreviousYearDates.data_fim}&filiais=${apiParams.filiais}`
    : null
  const { data: faturamentoMtdPreviousYearData } = useSWR<FaturamentoData>(faturamentoMtdPreviousYearUrl, fetcher, { refreshInterval: 0 });

  // Criar mapa de faturamento por filial para acesso rápido
  const faturamentoPorFilialMap = useMemo(() => {
    const map = new Map<number, FaturamentoPorFilial>()
    if (Array.isArray(faturamentoPorFilialData)) {
      faturamentoPorFilialData.forEach(f => map.set(f.filial_id, f))
    }
    return map
  }, [faturamentoPorFilialData])

  const faturamentoPorFilialComparativoMap = useMemo(() => {
    const map = new Map<number, FaturamentoPorFilial>()
    if (Array.isArray(faturamentoPorFilialComparativoData)) {
      faturamentoPorFilialComparativoData.forEach(f => map.set(f.filial_id, f))
    }
    return map
  }, [faturamentoPorFilialComparativoData])

  const comparisonPeriodLabel = useMemo(() => {
    if (!vendasPorFilialComparisonDates) return 'PA'

    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
    const start = new Date(vendasPorFilialComparisonDates.data_inicio + 'T00:00:00')
    const yearShort = String(start.getFullYear()).slice(-2)

    return `${monthNames[start.getMonth()]}/${yearShort}`
  }, [vendasPorFilialComparisonDates])

  // Calcular totais consolidados baseado no tipo de venda selecionado
  const consolidatedTotals = useMemo(() => {
    // Dados PDV
    const pdvReceita = data?.total_vendas || 0
    const pdvLucro = data?.total_lucro || 0
    const pdvPaReceita = data?.pa_vendas || 0
    const pdvPaLucro = data?.pa_lucro || 0

    // Dados Faturamento
    const fatReceita = faturamentoData?.receita_faturamento || 0
    const fatLucro = faturamentoData?.lucro_bruto_faturamento || 0
    const fatPaReceita = faturamentoPaData?.receita_faturamento || 0
    const fatPaLucro = faturamentoPaData?.lucro_bruto_faturamento || 0

    // Calcular valores baseado no tipo de venda selecionado
    let receitaTotal: number
    let lucroTotal: number
    let paReceita: number
    let paLucro: number

    switch (salesType) {
      case 'pdv':
        receitaTotal = pdvReceita
        lucroTotal = pdvLucro
        paReceita = pdvPaReceita
        paLucro = pdvPaLucro
        break
      case 'faturamento':
        receitaTotal = fatReceita
        lucroTotal = fatLucro
        paReceita = fatPaReceita
        paLucro = fatPaLucro
        break
      case 'complete':
      default:
        receitaTotal = pdvReceita + fatReceita
        lucroTotal = pdvLucro + fatLucro
        paReceita = pdvPaReceita + fatPaReceita
        paLucro = pdvPaLucro + fatPaLucro
        break
    }

    const margemTotal = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0
    const paMargem = paReceita > 0 ? (paLucro / paReceita) * 100 : 0

    return {
      receitaTotal,
      lucroTotal,
      margemTotal,
      paReceita,
      paLucro,
      paMargem,
    }
  }, [data, faturamentoData, faturamentoPaData, salesType])

  // Calcular totais consolidados MTD baseado no tipo de venda selecionado
  const consolidatedMTD = useMemo(() => {
    // Dados PDV - Mês anterior (ex: OUT/2025)
    const pdvMtdPrevMonthReceita = mtdData?.mtd_mes_anterior_vendas || 0
    const pdvMtdPrevMonthLucro = mtdData?.mtd_mes_anterior_lucro || 0

    // Dados Faturamento - Mês anterior
    const fatMtdPrevMonthReceita = faturamentoMtdPreviousMonthData?.receita_faturamento || 0
    const fatMtdPrevMonthLucro = faturamentoMtdPreviousMonthData?.lucro_bruto_faturamento || 0

    // Dados PDV - Ano anterior (ex: NOV/2024)
    const pdvMtdPrevYearReceita = mtdData?.mtd_ano_anterior_vendas || 0
    const pdvMtdPrevYearLucro = mtdData?.mtd_ano_anterior_lucro || 0

    // Dados Faturamento - Ano anterior
    const fatMtdPrevYearReceita = faturamentoMtdPreviousYearData?.receita_faturamento || 0
    const fatMtdPrevYearLucro = faturamentoMtdPreviousYearData?.lucro_bruto_faturamento || 0

    // Calcular valores baseado no tipo de venda selecionado
    let mtdPrevMonthReceita: number
    let mtdPrevMonthLucro: number
    let mtdPrevYearReceita: number
    let mtdPrevYearLucro: number

    switch (salesType) {
      case 'pdv':
        mtdPrevMonthReceita = pdvMtdPrevMonthReceita
        mtdPrevMonthLucro = pdvMtdPrevMonthLucro
        mtdPrevYearReceita = pdvMtdPrevYearReceita
        mtdPrevYearLucro = pdvMtdPrevYearLucro
        break
      case 'faturamento':
        mtdPrevMonthReceita = fatMtdPrevMonthReceita
        mtdPrevMonthLucro = fatMtdPrevMonthLucro
        mtdPrevYearReceita = fatMtdPrevYearReceita
        mtdPrevYearLucro = fatMtdPrevYearLucro
        break
      case 'complete':
      default:
        mtdPrevMonthReceita = pdvMtdPrevMonthReceita + fatMtdPrevMonthReceita
        mtdPrevMonthLucro = pdvMtdPrevMonthLucro + fatMtdPrevMonthLucro
        mtdPrevYearReceita = pdvMtdPrevYearReceita + fatMtdPrevYearReceita
        mtdPrevYearLucro = pdvMtdPrevYearLucro + fatMtdPrevYearLucro
        break
    }

    const mtdPrevMonthMargem = mtdPrevMonthReceita > 0 ? (mtdPrevMonthLucro / mtdPrevMonthReceita) * 100 : 0
    const mtdPrevYearMargem = mtdPrevYearReceita > 0 ? (mtdPrevYearLucro / mtdPrevYearReceita) * 100 : 0

    // Calcular variações
    const variacaoPrevMonthReceita = mtdPrevMonthReceita > 0
      ? ((consolidatedTotals.receitaTotal - mtdPrevMonthReceita) / mtdPrevMonthReceita) * 100
      : 0
    const variacaoPrevMonthLucro = mtdPrevMonthLucro > 0
      ? ((consolidatedTotals.lucroTotal - mtdPrevMonthLucro) / mtdPrevMonthLucro) * 100
      : 0
    const variacaoPrevMonthMargem = consolidatedTotals.margemTotal - mtdPrevMonthMargem

    const variacaoPrevYearReceita = mtdPrevYearReceita > 0
      ? ((consolidatedTotals.receitaTotal - mtdPrevYearReceita) / mtdPrevYearReceita) * 100
      : 0
    const variacaoPrevYearLucro = mtdPrevYearLucro > 0
      ? ((consolidatedTotals.lucroTotal - mtdPrevYearLucro) / mtdPrevYearLucro) * 100
      : 0
    const variacaoPrevYearMargem = consolidatedTotals.margemTotal - mtdPrevYearMargem

    return {
      // Mês anterior
      mtdPrevMonthReceita,
      mtdPrevMonthLucro,
      mtdPrevMonthMargem,
      variacaoPrevMonthReceita,
      variacaoPrevMonthLucro,
      variacaoPrevMonthMargem,
      // Ano anterior
      mtdPrevYearReceita,
      mtdPrevYearLucro,
      mtdPrevYearMargem,
      variacaoPrevYearReceita,
      variacaoPrevYearLucro,
      variacaoPrevYearMargem,
    }
  }, [mtdData, faturamentoMtdPreviousMonthData, faturamentoMtdPreviousYearData, consolidatedTotals, salesType])

  // Função para lidar com clique no cabeçalho da coluna
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Se é uma nova coluna, ordena ascendente
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Função para exportar Vendas por Filial em PDF
  const handleExportVendasPorFilialPdf = async () => {
    if (!sortedVendasPorFilial || sortedVendasPorFilial.length === 0) {
      alert('Não há dados para exportar.')
      return
    }

    setIsExportingPdf(true)

    try {
      // Dynamic imports
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      // Criar documento PDF A4 Landscape
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      // Cores
      const greenColor: [number, number, number] = [22, 163, 74] // text-green-600
      const redColor: [number, number, number] = [220, 38, 38] // text-red-600
      const headerBg: [number, number, number] = [241, 245, 249] // slate-100
      const totalRowBg: [number, number, number] = [226, 232, 240] // slate-200

      // Cabeçalho do PDF
      const tenantName = currentTenant?.name || 'Empresa'
      const periodoLabel = `${format(dataInicio, 'dd/MM/yyyy')} a ${format(dataFim, 'dd/MM/yyyy')}`
      const comparisonLabel = vendasPorFilialComparisonDates
        ? `${format(new Date(vendasPorFilialComparisonDates.data_inicio + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(vendasPorFilialComparisonDates.data_fim + 'T00:00:00'), 'dd/MM/yyyy')}`
        : '-'

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Vendas por Filial', 14, 15)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Empresa: ${tenantName}`, 14, 22)
      doc.text(`Período: ${periodoLabel}`, 14, 27)
      doc.text(`Comparação de crescimento: ${comparisonLabel}`, 14, 32)
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 37)

      // Preparar dados da tabela
      const tableHead = [
        ['Filial', 'Receita Bruta', 'Δ%', 'Ticket Médio', 'Δ%', 'Custo', 'Δ%', 'Lucro Bruto', 'Δ%', 'Margem', 'Δ%', 'Entradas', 'Δ%', 'Cupons', 'Δ%', 'SKU', 'Δ%']
      ]

      // Função auxiliar para formatar variação com sinal
      const formatDelta = (value: number, suffix: string = '%') => {
        const sign = value >= 0 ? '+' : ''
        return `${sign}${value.toFixed(2)}${suffix}`
      }

      // Preparar linhas de dados
      const tableBody: string[][] = sortedVendasPorFilial.map((venda) => {
        const delta_ticket_percent = venda.pa_ticket_medio > 0
          ? ((venda.ticket_medio - venda.pa_ticket_medio) / venda.pa_ticket_medio) * 100
          : 0

        return [
          venda.filial_id.toString(),
          formatCurrency(venda.valor_total),
          formatDelta(venda.delta_valor_percent),
          formatCurrency(venda.ticket_medio),
          formatDelta(delta_ticket_percent),
          formatCurrency(venda.custo_total),
          formatDelta(venda.delta_custo_percent),
          formatCurrency(venda.total_lucro),
          formatDelta(venda.delta_lucro_percent),
          `${venda.margem_lucro.toFixed(2)}%`,
          formatDelta(venda.delta_margem, 'p.p.'),
          formatCurrency(venda.total_entradas || 0),
          formatDelta(venda.delta_entradas_percent || 0),
          (venda.total_cupons || 0).toLocaleString('pt-BR'),
          formatDelta(venda.delta_cupons_percent || 0),
          (venda.total_sku || 0).toLocaleString('pt-BR'),
          formatDelta(venda.delta_sku_percent || 0)
        ]
      })

      // Calcular totais
      const totais = sortedVendasPorFilial.reduce((acc, venda) => ({
        valor_total: acc.valor_total + venda.valor_total,
        pa_valor_total: acc.pa_valor_total + venda.pa_valor_total,
        total_transacoes: acc.total_transacoes + venda.total_transacoes,
        pa_total_transacoes: acc.pa_total_transacoes + venda.pa_total_transacoes,
        custo_total: acc.custo_total + venda.custo_total,
        pa_custo_total: acc.pa_custo_total + venda.pa_custo_total,
        total_lucro: acc.total_lucro + venda.total_lucro,
        pa_total_lucro: acc.pa_total_lucro + venda.pa_total_lucro,
        total_entradas: acc.total_entradas + (venda.total_entradas || 0),
        pa_total_entradas: acc.pa_total_entradas + (venda.pa_total_entradas || 0),
        total_cupons: acc.total_cupons + (venda.total_cupons || 0),
        pa_total_cupons: acc.pa_total_cupons + (venda.pa_total_cupons || 0),
      }), {
        valor_total: 0,
        pa_valor_total: 0,
        total_transacoes: 0,
        pa_total_transacoes: 0,
        custo_total: 0,
        pa_custo_total: 0,
        total_lucro: 0,
        pa_total_lucro: 0,
        total_entradas: 0,
        pa_total_entradas: 0,
        total_cupons: 0,
        pa_total_cupons: 0,
      })

      // SKU total usa valores distintos da API, não soma
      const total_sku = totalSkuDistinct
      const pa_total_sku = paTotalSkuDistinct

      const ticket_medio_total = totais.total_cupons > 0 ? totais.valor_total / totais.total_cupons : 0
      const pa_ticket_medio_total = totais.pa_total_cupons > 0 ? totais.pa_valor_total / totais.pa_total_cupons : 0
      const delta_ticket_total = pa_ticket_medio_total > 0 ? ((ticket_medio_total - pa_ticket_medio_total) / pa_ticket_medio_total) * 100 : 0
      const margem_total = totais.valor_total > 0 ? (totais.total_lucro / totais.valor_total) * 100 : 0
      const pa_margem_total = totais.pa_valor_total > 0 ? (totais.pa_total_lucro / totais.pa_valor_total) * 100 : 0
      const delta_valor_total = totais.pa_valor_total > 0 ? ((totais.valor_total - totais.pa_valor_total) / totais.pa_valor_total) * 100 : 0
      const delta_custo_total = totais.pa_custo_total > 0 ? ((totais.custo_total - totais.pa_custo_total) / totais.pa_custo_total) * 100 : 0
      const delta_lucro_total = totais.pa_total_lucro > 0 ? ((totais.total_lucro - totais.pa_total_lucro) / totais.pa_total_lucro) * 100 : 0
      const delta_margem_total = margem_total - pa_margem_total
      const delta_entradas_total = totais.pa_total_entradas > 0 ? ((totais.total_entradas - totais.pa_total_entradas) / totais.pa_total_entradas) * 100 : 0
      const delta_cupons_total = totais.pa_total_cupons > 0 ? ((totais.total_cupons - totais.pa_total_cupons) / totais.pa_total_cupons) * 100 : 0
      const delta_sku_total = pa_total_sku > 0 ? ((total_sku - pa_total_sku) / pa_total_sku) * 100 : 0

      // Adicionar linha de total
      const totalRow = [
        'TOTAL',
        formatCurrency(totais.valor_total),
        formatDelta(delta_valor_total),
        formatCurrency(ticket_medio_total),
        formatDelta(delta_ticket_total),
        formatCurrency(totais.custo_total),
        formatDelta(delta_custo_total),
        formatCurrency(totais.total_lucro),
        formatDelta(delta_lucro_total),
        `${margem_total.toFixed(2)}%`,
        formatDelta(delta_margem_total, 'p.p.'),
        formatCurrency(totais.total_entradas),
        formatDelta(delta_entradas_total),
        totais.total_cupons.toLocaleString('pt-BR'),
        formatDelta(delta_cupons_total),
        total_sku.toLocaleString('pt-BR'),
        formatDelta(delta_sku_total)
      ]
      tableBody.push(totalRow)

      // Índice das colunas de variação (Δ%)
      const deltaColumns = [2, 4, 6, 8, 10, 12, 14, 16]
      // Coluna de custo tem lógica invertida (aumento é ruim)
      const custoColumn = 6

      // Configuração de fonte e ajuste adaptativo para evitar quebra do último dígito/letra
      const baseTableFontSize = 7
      const minTableFontSize = 6

      type PdfDoc = {
        getFontSize: () => number
        setFontSize: (size: number) => void
        getTextWidth: (text: string) => number
      }

      type AutoTableCellPadding = number | number[] | { left?: number; right?: number; horizontal?: number }
      type AutoTableCellStyles = { cellPadding: AutoTableCellPadding; fontSize?: number }
      type AutoTableCell = { text: string[] | string; width: number; styles: AutoTableCellStyles }
      type AutoTableHookData = { section: string; cell: AutoTableCell; doc: PdfDoc }

      const getHorizontalPadding = (cellPadding: AutoTableCellPadding) => {
        if (typeof cellPadding === 'number') return cellPadding * 2
        if (Array.isArray(cellPadding)) {
          const left = cellPadding[3] ?? cellPadding[1] ?? 0
          const right = cellPadding[1] ?? cellPadding[3] ?? 0
          return left + right
        }
        if (cellPadding && typeof cellPadding === 'object') {
          const padding = cellPadding as { left?: number; right?: number; horizontal?: number }
          const left = padding.left ?? padding.horizontal ?? 0
          const right = padding.right ?? padding.horizontal ?? 0
          return left + right
        }
        return 0
      }

      const fitTextToCell = (data: AutoTableHookData) => {
        if (data.section !== 'body') return

        const text = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text ?? '')
        if (!text) return

        const docRef = data.doc
        const availableWidth = data.cell.width - getHorizontalPadding(data.cell.styles.cellPadding)
        if (availableWidth <= 0) return

        const originalDocFontSize = docRef.getFontSize()
        let fontSize = typeof data.cell.styles.fontSize === 'number' ? data.cell.styles.fontSize : baseTableFontSize

        while (fontSize > minTableFontSize) {
          docRef.setFontSize(fontSize)
          const textWidth = docRef.getTextWidth(text)
          if (textWidth <= availableWidth) break
          fontSize -= 0.5
        }

        docRef.setFontSize(originalDocFontSize)

        if (fontSize !== data.cell.styles.fontSize) {
          data.cell.styles.fontSize = fontSize
        }
      }

      // Gerar tabela
      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 43,
        margin: { left: 6, right: 6 },
        theme: 'grid',
        styles: {
          fontSize: baseTableFontSize,
          cellPadding: 1.5,
          halign: 'right',
          valign: 'middle',
        },
        headStyles: {
          fillColor: headerBg,
          textColor: [30, 41, 59], // slate-800
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold' }, // Filial
        },
        didParseCell: (data) => {
          fitTextToCell(data)

          // Aplicar cor nas colunas de variação
          if (data.section === 'body' && deltaColumns.includes(data.column.index)) {
            const cellText = data.cell.text[0] || ''
            const value = parseFloat(cellText.replace(/[+%p.]/g, '').replace(',', '.'))

            if (!isNaN(value)) {
              // Para custo, lógica invertida (aumento é ruim)
              if (data.column.index === custoColumn) {
                data.cell.styles.textColor = value >= 0 ? redColor : greenColor
              } else {
                data.cell.styles.textColor = value >= 0 ? greenColor : redColor
              }
            }
          }

          // Estilo da linha de total (última linha)
          if (data.section === 'body' && data.row.index === tableBody.length - 1) {
            data.cell.styles.fillColor = totalRowBg
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Salvar PDF
      const tenantSlug = tenantName.toLowerCase().replace(/\s+/g, '-')
      const periodoSlug = `${format(dataInicio, 'yyyyMMdd')}-${format(dataFim, 'yyyyMMdd')}`
      const nomeArquivo = `vendas-por-filial-${tenantSlug}-${periodoSlug}.pdf`
      doc.save(nomeArquivo)

    } catch (err) {
      console.error('[PDF Export] Erro ao exportar PDF:', err)
      alert(`Erro ao exportar PDF: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Dados ordenados usando useMemo para performance
  const sortedVendasPorFilial = useMemo(() => {
    // Extrair vendas do response
    const vendasPorFilial = vendasPorFilialData?.vendas || []
    
    if (!vendasPorFilial || !Array.isArray(vendasPorFilial) || vendasPorFilial.length === 0) return []

    const sorted = [...vendasPorFilial].sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortColumn) {
        case 'filial_id':
          aValue = a.filial_id
          bValue = b.filial_id
          break
        case 'valor_total':
          aValue = a.valor_total
          bValue = b.valor_total
          break
        case 'ticket_medio':
          aValue = a.ticket_medio
          bValue = b.ticket_medio
          break
        case 'custo_total':
          aValue = a.custo_total
          bValue = b.custo_total
          break
        case 'total_lucro':
          aValue = a.total_lucro
          bValue = b.total_lucro
          break
        case 'margem_lucro':
          aValue = a.margem_lucro
          bValue = b.margem_lucro
          break
        case 'total_entradas':
          aValue = a.total_entradas || 0
          bValue = b.total_entradas || 0
          break
        case 'total_cupons':
          aValue = a.total_cupons || 0
          bValue = b.total_cupons || 0
          break
        case 'total_sku':
          aValue = a.total_sku || 0
          bValue = b.total_sku || 0
          break
        default:
          return 0
      }

      if (sortDirection === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return sorted
  }, [vendasPorFilialData?.vendas, sortColumn, sortDirection])

  // Componente de ícone para ordenação
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline" />
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 inline" />
      : <ChevronDown className="ml-1 h-3 w-3 inline" />
  }

  // Buscar filiais reais do tenant atual
  const { options: todasAsFiliais, isLoading: isLoadingBranches } = useBranchesOptions({
    tenantId: currentTenant?.id,
    enabled: !!currentTenant
  })

  const isDataLoading = isLoading || !currentTenant

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          Dashboard 360
        </h1>
        <p className="text-sm text-muted-foreground">
          Análise consolidada de vendas, lucro e performance por período
        </p>
      </div>

      {/* Filtros */}
      <div className='space-y-4'>
        <div className="rounded-md border p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
            {/* FILIAIS */}
            <div className="flex flex-col gap-2 w-full lg:w-[600px]">
              <Label>Filiais</Label>
              <div className="h-10">
                <MultiSelect
                  options={todasAsFiliais}
                  value={filiaisSelecionadas}
                  onValueChange={setFiliaisSelecionadas}
                  placeholder={isLoadingBranches ? "Carregando filiais..." : "Selecione..."}
                  disabled={isLoadingBranches}
                  className="w-full h-10"
                />
              </div>
            </div>

            {/* TIPO DE VENDA */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Label>Tipo de Venda</Label>
              <div className="h-10">
                <Select value={salesType} onValueChange={(value: SalesType) => setSalesType(value)}>
                  <SelectTrigger className="w-full sm:w-[180px] h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="complete">Completo</SelectItem>
                    <SelectItem value="pdv">Venda PDV</SelectItem>
                    <SelectItem value="faturamento">Venda Faturamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* FILTRO DE PERÍODO */}
            <DashboardFilter onPeriodChange={handlePeriodChange} />
          </div>
        </div>
      </div>

      {/* Cards e Gráfico */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {isDataLoading ? (
          <>
            {/* Skeleton para CardMetric */}
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-8 w-40" />
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : data ? (
          <>
            <CardMetric
              title="Receita Bruta"
              value={formatCurrency(consolidatedTotals.receitaTotal)}
              previousValue={!shouldShowMTD() ? formatCurrency(consolidatedTotals.paReceita) : undefined}
              variationPercent={!shouldShowMTD() ? (() => {
                const variation = calculateVariationPercent(consolidatedTotals.receitaTotal, consolidatedTotals.paReceita)
                return `${variation >= 0 ? '+' : ''}${variation.toFixed(2)}%`
              })() : undefined}
              variationYear={!shouldShowMTD() ? `${(data.variacao_vendas_ano || 0) >= 0 ? '+' : ''}${(data.variacao_vendas_ano || 0).toFixed(2)}%` : undefined}
              isPositive={consolidatedTotals.receitaTotal >= consolidatedTotals.paReceita}
              comparisonLabel={getComparisonLabel()}
              ytdValue={shouldShowYTD() && ytdData ? formatCurrency(ytdData.ytd_vendas_ano_anterior) : undefined}
              ytdVariationPercent={shouldShowYTD() && ytdData && ytdData.ytd_variacao_vendas_percent != null ? `${ytdData.ytd_variacao_vendas_percent >= 0 ? '+' : ''}${ytdData.ytd_variacao_vendas_percent.toFixed(2)}%` : undefined}
              ytdLabel={shouldShowYTD() ? getYTDLabel() : undefined}
              ytdIsPositive={shouldShowYTD() && ytdData && ytdData.ytd_variacao_vendas_percent != null ? ytdData.ytd_variacao_vendas_percent >= 0 : undefined}
              mtdPreviousMonthValue={shouldShowMTD() ? formatCurrency(consolidatedMTD.mtdPrevMonthReceita) : undefined}
              mtdPreviousMonthVariationPercent={shouldShowMTD() ? `${consolidatedMTD.variacaoPrevMonthReceita >= 0 ? '+' : ''}${consolidatedMTD.variacaoPrevMonthReceita.toFixed(2)}%` : undefined}
              mtdPreviousMonthLabel={shouldShowMTD() ? getMTDPreviousMonthLabel() : undefined}
              mtdPreviousMonthIsPositive={shouldShowMTD() ? consolidatedMTD.variacaoPrevMonthReceita >= 0 : undefined}
              mtdPreviousYearValue={shouldShowMTD() ? formatCurrency(consolidatedMTD.mtdPrevYearReceita) : undefined}
              mtdPreviousYearVariationPercent={shouldShowMTD() ? `${consolidatedMTD.variacaoPrevYearReceita >= 0 ? '+' : ''}${consolidatedMTD.variacaoPrevYearReceita.toFixed(2)}%` : undefined}
              mtdPreviousYearLabel={shouldShowMTD() ? getMTDPreviousYearLabel() : undefined}
              mtdPreviousYearIsPositive={shouldShowMTD() ? consolidatedMTD.variacaoPrevYearReceita >= 0 : undefined}
            />
            <CardMetric
              title="Lucro Bruto"
              value={formatCurrency(consolidatedTotals.lucroTotal)}
              previousValue={!shouldShowMTD() ? formatCurrency(consolidatedTotals.paLucro) : undefined}
              variationPercent={!shouldShowMTD() ? (() => {
                const variation = calculateVariationPercent(consolidatedTotals.lucroTotal, consolidatedTotals.paLucro)
                return `${variation >= 0 ? '+' : ''}${variation.toFixed(2)}%`
              })() : undefined}
              variationYear={!shouldShowMTD() ? `${(data.variacao_lucro_ano || 0) >= 0 ? '+' : ''}${(data.variacao_lucro_ano || 0).toFixed(2)}%` : undefined}
              isPositive={consolidatedTotals.lucroTotal >= consolidatedTotals.paLucro}
              comparisonLabel={getComparisonLabel()}
              ytdValue={shouldShowYTD() && ytdData ? formatCurrency(ytdData.ytd_lucro_ano_anterior) : undefined}
              ytdVariationPercent={shouldShowYTD() && ytdData && ytdData.ytd_variacao_lucro_percent != null ? `${ytdData.ytd_variacao_lucro_percent >= 0 ? '+' : ''}${ytdData.ytd_variacao_lucro_percent.toFixed(2)}%` : undefined}
              ytdLabel={shouldShowYTD() ? getYTDLabel() : undefined}
              ytdIsPositive={shouldShowYTD() && ytdData && ytdData.ytd_variacao_lucro_percent != null ? ytdData.ytd_variacao_lucro_percent >= 0 : undefined}
              mtdPreviousMonthValue={shouldShowMTD() ? formatCurrency(consolidatedMTD.mtdPrevMonthLucro) : undefined}
              mtdPreviousMonthVariationPercent={shouldShowMTD() ? `${consolidatedMTD.variacaoPrevMonthLucro >= 0 ? '+' : ''}${consolidatedMTD.variacaoPrevMonthLucro.toFixed(2)}%` : undefined}
              mtdPreviousMonthLabel={shouldShowMTD() ? getMTDPreviousMonthLabel() : undefined}
              mtdPreviousMonthIsPositive={shouldShowMTD() ? consolidatedMTD.variacaoPrevMonthLucro >= 0 : undefined}
              mtdPreviousYearValue={shouldShowMTD() ? formatCurrency(consolidatedMTD.mtdPrevYearLucro) : undefined}
              mtdPreviousYearVariationPercent={shouldShowMTD() ? `${consolidatedMTD.variacaoPrevYearLucro >= 0 ? '+' : ''}${consolidatedMTD.variacaoPrevYearLucro.toFixed(2)}%` : undefined}
              mtdPreviousYearLabel={shouldShowMTD() ? getMTDPreviousYearLabel() : undefined}
              mtdPreviousYearIsPositive={shouldShowMTD() ? consolidatedMTD.variacaoPrevYearLucro >= 0 : undefined}
            />
            <CardMetric
              title="Margem Bruta"
              value={formatPercentage(consolidatedTotals.margemTotal)}
              previousValue={!shouldShowMTD() ? formatPercentage(consolidatedTotals.paMargem) : undefined}
              variationPercent={!shouldShowMTD() ? (() => {
                const variation = consolidatedTotals.margemTotal - consolidatedTotals.paMargem
                return `${variation >= 0 ? '+' : ''}${variation.toFixed(2)}p.p.`
              })() : undefined}
              variationYear={!shouldShowMTD() ? `${(data.variacao_margem_ano || 0) >= 0 ? '+' : ''}${(data.variacao_margem_ano || 0).toFixed(2)}p.p.` : undefined}
              isPositive={consolidatedTotals.margemTotal >= consolidatedTotals.paMargem}
              comparisonLabel={getComparisonLabel()}
              ytdValue={shouldShowYTD() && ytdData ? formatPercentage(ytdData.ytd_margem_ano_anterior) : undefined}
              ytdVariationPercent={shouldShowYTD() && ytdData && ytdData.ytd_variacao_margem != null ? `${ytdData.ytd_variacao_margem >= 0 ? '+' : ''}${ytdData.ytd_variacao_margem.toFixed(2)}p.p.` : undefined}
              ytdLabel={shouldShowYTD() ? getYTDLabel() : undefined}
              ytdIsPositive={shouldShowYTD() && ytdData && ytdData.ytd_variacao_margem != null ? ytdData.ytd_variacao_margem >= 0 : undefined}
              mtdPreviousMonthValue={shouldShowMTD() ? formatPercentage(consolidatedMTD.mtdPrevMonthMargem) : undefined}
              mtdPreviousMonthVariationPercent={shouldShowMTD() ? `${consolidatedMTD.variacaoPrevMonthMargem >= 0 ? '+' : ''}${consolidatedMTD.variacaoPrevMonthMargem.toFixed(2)}p.p.` : undefined}
              mtdPreviousMonthLabel={shouldShowMTD() ? getMTDPreviousMonthLabel() : undefined}
              mtdPreviousMonthIsPositive={shouldShowMTD() ? consolidatedMTD.variacaoPrevMonthMargem >= 0 : undefined}
              mtdPreviousYearValue={shouldShowMTD() ? formatPercentage(consolidatedMTD.mtdPrevYearMargem) : undefined}
              mtdPreviousYearVariationPercent={shouldShowMTD() ? `${consolidatedMTD.variacaoPrevYearMargem >= 0 ? '+' : ''}${consolidatedMTD.variacaoPrevYearMargem.toFixed(2)}p.p.` : undefined}
              mtdPreviousYearLabel={shouldShowMTD() ? getMTDPreviousYearLabel() : undefined}
              mtdPreviousYearIsPositive={shouldShowMTD() ? consolidatedMTD.variacaoPrevYearMargem >= 0 : undefined}
            />
          </>
        ) : null}
      </div>

      {/* Cards: Entradas, Perdas, Trocas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card Entradas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDataLoading || isLoadingEntradasPerdas ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">
                    {formatCurrency(entradasPerdasData?.total_entradas || 0)}
                  </p>
                  <span className="text-sm text-muted-foreground">
                    ({consolidatedTotals.receitaTotal > 0
                      ? ((entradasPerdasData?.total_entradas || 0) / consolidatedTotals.receitaTotal * 100).toFixed(2)
                      : '0.00'}% s/ Receita)
                  </span>
                </div>
                {/* Comparativo mês anterior - apenas quando filtro é por mês */}
                {shouldShowMTD() && entradasPerdasMtdData && (
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">{getMTDPreviousMonthLabel()}:</span>
                    <span>{formatCurrency(entradasPerdasMtdData.total_entradas || 0)}</span>
                    <span className="text-xs">
                      ({consolidatedMTD.mtdPrevMonthReceita > 0
                        ? ((entradasPerdasMtdData.total_entradas || 0) / consolidatedMTD.mtdPrevMonthReceita * 100).toFixed(2)
                        : '0.00'}% s/ Receita)
                    </span>
                  </div>
                )}
                {/* Comparativo ano anterior - apenas quando filtro é por ano */}
                {shouldShowYearComparison() && entradasPerdasYtdData && (
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">{getYearComparisonLabel()}:</span>
                    <span>{formatCurrency(entradasPerdasYtdData.total_entradas || 0)}</span>
                    <span className="text-xs">
                      ({ytdData?.ytd_vendas_ano_anterior && ytdData.ytd_vendas_ano_anterior > 0
                        ? ((entradasPerdasYtdData.total_entradas || 0) / ytdData.ytd_vendas_ano_anterior * 100).toFixed(2)
                        : '0.00'}% s/ Receita)
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Perdas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Perdas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDataLoading || isLoadingEntradasPerdas ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <div className="space-y-1">
                {/* Valor principal com indicador de variação */}
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(entradasPerdasData?.total_perdas || 0)}
                  </p>
                  <span className="text-sm text-muted-foreground">
                    ({consolidatedTotals.receitaTotal > 0
                      ? ((entradasPerdasData?.total_perdas || 0) / consolidatedTotals.receitaTotal * 100).toFixed(2)
                      : '0.00'}% s/ Receita)
                  </span>
                  {/* Indicador de variação - Mês */}
                  {shouldShowMTD() && entradasPerdasMtdData && (() => {
                    const atual = entradasPerdasData?.total_perdas || 0
                    const anterior = entradasPerdasMtdData.total_perdas || 0
                    const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0

                    if (anterior === 0 && atual === 0) return null

                    // Perda aumentou = ruim (vermelho, seta pra cima)
                    // Perda diminuiu = bom (verde, seta pra baixo)
                    const isIncrease = atual > anterior
                    return (
                      <span className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                        {isIncrease ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                      </span>
                    )
                  })()}
                  {/* Indicador de variação - Ano */}
                  {shouldShowYearComparison() && entradasPerdasYtdData && (() => {
                    const atual = entradasPerdasData?.total_perdas || 0
                    const anterior = entradasPerdasYtdData.total_perdas || 0
                    const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0

                    if (anterior === 0 && atual === 0) return null

                    // Perda aumentou = ruim (vermelho, seta pra cima)
                    // Perda diminuiu = bom (verde, seta pra baixo)
                    const isIncrease = atual > anterior
                    return (
                      <span className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                        {isIncrease ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                      </span>
                    )
                  })()}
                </div>
                {/* Comparativo mês anterior - apenas quando filtro é por mês */}
                {shouldShowMTD() && entradasPerdasMtdData && (
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">{getMTDPreviousMonthLabel()}:</span>
                    <span>{formatCurrency(entradasPerdasMtdData.total_perdas || 0)}</span>
                    <span className="text-xs">
                      ({consolidatedMTD.mtdPrevMonthReceita > 0
                        ? ((entradasPerdasMtdData.total_perdas || 0) / consolidatedMTD.mtdPrevMonthReceita * 100).toFixed(2)
                        : '0.00'}% s/ Receita)
                    </span>
                  </div>
                )}
                {/* Comparativo ano anterior - apenas quando filtro é por ano */}
                {shouldShowYearComparison() && entradasPerdasYtdData && (
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">{getYearComparisonLabel()}:</span>
                    <span>{formatCurrency(entradasPerdasYtdData.total_perdas || 0)}</span>
                    <span className="text-xs">
                      ({ytdData?.ytd_vendas_ano_anterior && ytdData.ytd_vendas_ano_anterior > 0
                        ? ((entradasPerdasYtdData.total_perdas || 0) / ytdData.ytd_vendas_ano_anterior * 100).toFixed(2)
                        : '0.00'}% s/ Receita)
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Trocas - Em Breve */}
        <Card className="relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Trocas
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                Em Breve
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground/50">
              --
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas e Despesas</CardTitle>
          <CardDescription>Comparativo entre total de Vendas e Despesas no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          {isChartLoading ? (
            <div className="h-[350px] w-full space-y-4">
              {/* Skeleton do gráfico */}
              <div className="flex items-end justify-between h-[300px] gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                  <Skeleton 
                    key={i} 
                    className="flex-1 rounded-t-md" 
                    style={{ height: `${Math.random() * 60 + 40}%` }}
                  />
                ))}
              </div>
              {/* Labels dos meses */}
              <div className="flex justify-between px-1">
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((mes) => (
                  <Skeleton key={mes} className="h-3 w-6" />
                ))}
              </div>
            </div>
          ) : chartData ? (
            <ChartVendas
              data={chartData}
              salesType={salesType}
              filterType={filterType}
              periodStart={dataInicio}
            />
          ) : (
            <div className="text-center text-muted-foreground">
              {error ? 'Erro ao carregar dados do gráfico.' : 'Nenhum dado para exibir.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Vendas por Filial */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Vendas por Filial</CardTitle>
            <CardDescription>Análise detalhada de vendas por filial para o período selecionado.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportVendasPorFilialPdf}
            disabled={isExportingPdf || isLoadingVendasFilial || !sortedVendasPorFilial || sortedVendasPorFilial.length === 0}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {isExportingPdf ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingVendasFilial ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 flex-1" />
                </div>
              ))}
            </div>
          ) : sortedVendasPorFilial && sortedVendasPorFilial.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent"
                        onClick={() => handleSort('filial_id')}
                      >
                        Filial
                        <SortIcon column="filial_id" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('valor_total')}
                      >
                        Receita Bruta
                        <SortIcon column="valor_total" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('ticket_medio')}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">Ticket Médio</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Vendas PDV / Cupons PDV
                          </TooltipContent>
                        </Tooltip>
                        <SortIcon column="ticket_medio" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('custo_total')}
                      >
                        Custo
                        <SortIcon column="custo_total" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('total_lucro')}
                      >
                        Lucro Bruto
                        <SortIcon column="total_lucro" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('margem_lucro')}
                      >
                        Margem Bruta
                        <SortIcon column="margem_lucro" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('total_entradas')}
                      >
                        Total Entradas
                        <SortIcon column="total_entradas" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('total_cupons')}
                      >
                        Cupons
                        <SortIcon column="total_cupons" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-accent ml-auto"
                        onClick={() => handleSort('total_sku')}
                      >
                        SKU
                        <SortIcon column="total_sku" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVendasPorFilial.map((venda) => {
                    const delta_ticket_percent = venda.pa_ticket_medio > 0
                      ? ((venda.ticket_medio - venda.pa_ticket_medio) / venda.pa_ticket_medio) * 100
                      : 0

                    // Dados de faturamento para esta filial
                    const fatFilial = faturamentoPorFilialMap.get(venda.filial_id)
                    const receitaFaturamento = fatFilial?.receita_faturamento || 0
                    const lucroFaturamento = fatFilial?.lucro_bruto_faturamento || 0
                    const cmvFaturamento = fatFilial?.cmv_faturamento || 0

                    const fatFilialComparativo = faturamentoPorFilialComparativoMap.get(venda.filial_id)
                    const paReceitaFaturamento = fatFilialComparativo?.receita_faturamento || 0
                    const paLucroFaturamento = fatFilialComparativo?.lucro_bruto_faturamento || 0
                    const paCmvFaturamento = fatFilialComparativo?.cmv_faturamento || 0

                    // Calcular receita baseada no tipo de venda selecionado
                    let receitaFilial: number
                    let lucroFilial: number
                    let custoFilial: number
                    let paReceitaFilial: number
                    let paLucroFilial: number
                    let paCustoFilial: number

                    switch (salesType) {
                      case 'pdv':
                        receitaFilial = venda.valor_total
                        lucroFilial = venda.total_lucro
                        custoFilial = venda.custo_total
                        paReceitaFilial = venda.pa_valor_total
                        paLucroFilial = venda.pa_total_lucro
                        paCustoFilial = venda.pa_custo_total
                        break
                      case 'faturamento':
                        receitaFilial = receitaFaturamento
                        lucroFilial = lucroFaturamento
                        custoFilial = cmvFaturamento
                        paReceitaFilial = paReceitaFaturamento
                        paLucroFilial = paLucroFaturamento
                        paCustoFilial = paCmvFaturamento
                        break
                      case 'complete':
                      default:
                        receitaFilial = venda.valor_total + receitaFaturamento
                        lucroFilial = venda.total_lucro + lucroFaturamento
                        custoFilial = venda.custo_total + cmvFaturamento
                        paReceitaFilial = venda.pa_valor_total + paReceitaFaturamento
                        paLucroFilial = venda.pa_total_lucro + paLucroFaturamento
                        paCustoFilial = venda.pa_custo_total + paCmvFaturamento
                        break
                    }

                    // Margem baseada nos valores filtrados
                    const margemFilial = receitaFilial > 0 ? (lucroFilial / receitaFilial) * 100 : 0
                    const paMargemFilial = paReceitaFilial > 0 ? (paLucroFilial / paReceitaFilial) * 100 : 0

                    const deltaReceitaFilial = paReceitaFilial > 0
                      ? ((receitaFilial - paReceitaFilial) / paReceitaFilial) * 100
                      : 0
                    const deltaLucroFilial = paLucroFilial > 0
                      ? ((lucroFilial - paLucroFilial) / paLucroFilial) * 100
                      : 0
                    const deltaCustoFilial = paCustoFilial > 0
                      ? ((custoFilial - paCustoFilial) / paCustoFilial) * 100
                      : 0
                    const deltaMargemFilial = margemFilial - paMargemFilial

                    return (
                      <TableRow key={venda.filial_id}>
                        <TableCell className="font-medium">{venda.filial_id}</TableCell>

                        {/* Receita Bruta (baseada no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(receitaFilial)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${deltaReceitaFilial >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deltaReceitaFilial >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {deltaReceitaFilial >= 0 ? '+' : ''}{deltaReceitaFilial.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(paReceitaFilial)}
                          </div>
                        </TableCell>
                        
                        {/* Ticket Médio */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(venda.ticket_medio)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${delta_ticket_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta_ticket_percent >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {delta_ticket_percent >= 0 ? '+' : ''}{delta_ticket_percent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(venda.pa_ticket_medio)}
                          </div>
                        </TableCell>

                        {/* Custo (baseado no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(custoFilial)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${deltaCustoFilial >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {deltaCustoFilial >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {deltaCustoFilial >= 0 ? '+' : ''}{deltaCustoFilial.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(paCustoFilial)}
                          </div>
                        </TableCell>

                        {/* Lucro Bruto (baseado no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(lucroFilial)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${deltaLucroFilial >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deltaLucroFilial >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {deltaLucroFilial >= 0 ? '+' : ''}{deltaLucroFilial.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(paLucroFilial)}
                          </div>
                        </TableCell>

                        {/* Margem Bruta (baseada no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {margemFilial.toFixed(2)}%
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${deltaMargemFilial >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deltaMargemFilial >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {deltaMargemFilial >= 0 ? '+' : ''}{deltaMargemFilial.toFixed(2)}p.p.
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {paMargemFilial.toFixed(2)}%
                          </div>
                        </TableCell>

                        {/* Total Entradas (compras) */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(venda.total_entradas || 0)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${(venda.delta_entradas_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(venda.delta_entradas_percent || 0) >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {(venda.delta_entradas_percent || 0) >= 0 ? '+' : ''}{(venda.delta_entradas_percent || 0).toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(venda.pa_total_entradas || 0)}
                          </div>
                        </TableCell>

                        {/* Cupons */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {(venda.total_cupons || 0).toLocaleString('pt-BR')}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${(venda.delta_cupons_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(venda.delta_cupons_percent || 0) >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {(venda.delta_cupons_percent || 0) >= 0 ? '+' : ''}{(venda.delta_cupons_percent || 0).toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {(venda.pa_total_cupons || 0).toLocaleString('pt-BR')}
                          </div>
                        </TableCell>

                        {/* SKU */}
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {(venda.total_sku || 0).toLocaleString('pt-BR')}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${(venda.delta_sku_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(venda.delta_sku_percent || 0) >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {(venda.delta_sku_percent || 0) >= 0 ? '+' : ''}{(venda.delta_sku_percent || 0).toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {(venda.pa_total_sku || 0).toLocaleString('pt-BR')}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Linha de Totalização */}
                  {sortedVendasPorFilial && sortedVendasPorFilial.length > 0 && (() => {
                    // Totais PDV + Entradas
                    const totaisPdv = sortedVendasPorFilial.reduce((acc, venda) => ({
                      valor_total: acc.valor_total + venda.valor_total,
                      pa_valor_total: acc.pa_valor_total + venda.pa_valor_total,
                      total_transacoes: acc.total_transacoes + venda.total_transacoes,
                      pa_total_transacoes: acc.pa_total_transacoes + venda.pa_total_transacoes,
                      custo_total: acc.custo_total + venda.custo_total,
                      pa_custo_total: acc.pa_custo_total + venda.pa_custo_total,
                      total_lucro: acc.total_lucro + venda.total_lucro,
                      pa_total_lucro: acc.pa_total_lucro + venda.pa_total_lucro,
                      total_entradas: acc.total_entradas + (venda.total_entradas || 0),
                      pa_total_entradas: acc.pa_total_entradas + (venda.pa_total_entradas || 0),
                      total_cupons: acc.total_cupons + (venda.total_cupons || 0),
                      pa_total_cupons: acc.pa_total_cupons + (venda.pa_total_cupons || 0),
                    }), {
                      valor_total: 0,
                      pa_valor_total: 0,
                      total_transacoes: 0,
                      pa_total_transacoes: 0,
                      custo_total: 0,
                      pa_custo_total: 0,
                      total_lucro: 0,
                      pa_total_lucro: 0,
                      total_entradas: 0,
                      pa_total_entradas: 0,
                      total_cupons: 0,
                      pa_total_cupons: 0,
                    })

                    // SKU total usa valores distintos da API, não soma
                    const total_sku_table = totalSkuDistinct
                    const pa_total_sku_table = paTotalSkuDistinct

                    // Totais Faturamento
                    const totalFaturamentoReceita = faturamentoData?.receita_faturamento || 0
                    const totalFaturamentoLucro = faturamentoData?.lucro_bruto_faturamento || 0
                    const totalFaturamentoCmv = faturamentoData?.cmv_faturamento || 0
                    const totalFaturamentoPaReceita = faturamentoComparativoData?.receita_faturamento || 0
                    const totalFaturamentoPaLucro = faturamentoComparativoData?.lucro_bruto_faturamento || 0
                    const totalFaturamentoPaCmv = faturamentoComparativoData?.cmv_faturamento || 0

                    // Calcular totais baseados no tipo de venda selecionado
                    let receitaTotal: number
                    let lucroTotal: number
                    let custoTotal: number
                    let paReceitaTotal: number
                    let paLucroTotal: number
                    let paCustoTotal: number

                    switch (salesType) {
                      case 'pdv':
                        receitaTotal = totaisPdv.valor_total
                        lucroTotal = totaisPdv.total_lucro
                        custoTotal = totaisPdv.custo_total
                        paReceitaTotal = totaisPdv.pa_valor_total
                        paLucroTotal = totaisPdv.pa_total_lucro
                        paCustoTotal = totaisPdv.pa_custo_total
                        break
                      case 'faturamento':
                        receitaTotal = totalFaturamentoReceita
                        lucroTotal = totalFaturamentoLucro
                        custoTotal = totalFaturamentoCmv
                        paReceitaTotal = totalFaturamentoPaReceita
                        paLucroTotal = totalFaturamentoPaLucro
                        paCustoTotal = totalFaturamentoPaCmv
                        break
                      case 'complete':
                      default:
                        receitaTotal = totaisPdv.valor_total + totalFaturamentoReceita
                        lucroTotal = totaisPdv.total_lucro + totalFaturamentoLucro
                        custoTotal = totaisPdv.custo_total + totalFaturamentoCmv
                        paReceitaTotal = totaisPdv.pa_valor_total + totalFaturamentoPaReceita
                        paLucroTotal = totaisPdv.pa_total_lucro + totalFaturamentoPaLucro
                        paCustoTotal = totaisPdv.pa_custo_total + totalFaturamentoPaCmv
                        break
                    }

                    const ticket_medio = totaisPdv.total_cupons > 0 ? totaisPdv.valor_total / totaisPdv.total_cupons : 0
                    const pa_ticket_medio = totaisPdv.pa_total_cupons > 0 ? paReceitaTotal / totaisPdv.pa_total_cupons : 0
                    const delta_ticket_percent = pa_ticket_medio > 0 ? ((ticket_medio - pa_ticket_medio) / pa_ticket_medio) * 100 : 0

                    const margem_lucro = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0
                    const pa_margem_lucro = paReceitaTotal > 0 ? (paLucroTotal / paReceitaTotal) * 100 : 0

                    const delta_receita_percent = paReceitaTotal > 0 ? ((receitaTotal - paReceitaTotal) / paReceitaTotal) * 100 : 0
                    const delta_custo_percent = paCustoTotal > 0 ? ((custoTotal - paCustoTotal) / paCustoTotal) * 100 : 0
                    const delta_lucro_percent = paLucroTotal > 0 ? ((lucroTotal - paLucroTotal) / paLucroTotal) * 100 : 0
                    const delta_margem = margem_lucro - pa_margem_lucro

                    return (
                      <TableRow className="bg-muted/30 font-bold border-t-2">
                        <TableCell>=</TableCell>

                        {/* Receita Bruta (baseada no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div>
                            {formatCurrency(receitaTotal)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${delta_receita_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta_receita_percent >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {delta_receita_percent >= 0 ? '+' : ''}{delta_receita_percent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(paReceitaTotal)}
                          </div>
                        </TableCell>

                        {/* Ticket Médio */}
                        <TableCell className="text-right">
                          <div>
                            {formatCurrency(ticket_medio)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${delta_ticket_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta_ticket_percent >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {delta_ticket_percent >= 0 ? '+' : ''}{delta_ticket_percent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(pa_ticket_medio)}
                          </div>
                        </TableCell>

                        {/* Custo (baseado no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div>
                            {formatCurrency(custoTotal)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${delta_custo_percent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {delta_custo_percent >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {delta_custo_percent >= 0 ? '+' : ''}{delta_custo_percent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(paCustoTotal)}
                          </div>
                        </TableCell>

                        {/* Lucro Bruto (baseado no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div>
                            {formatCurrency(lucroTotal)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${delta_lucro_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta_lucro_percent >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {delta_lucro_percent >= 0 ? '+' : ''}{delta_lucro_percent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {formatCurrency(paLucroTotal)}
                          </div>
                        </TableCell>

                        {/* Margem Bruta (baseada no filtro de tipo de venda) */}
                        <TableCell className="text-right">
                          <div>
                            {margem_lucro.toFixed(2)}%
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-xs ${delta_margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta_margem >= 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            <span>
                              {delta_margem >= 0 ? '+' : ''}{delta_margem.toFixed(2)}p.p.
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {comparisonPeriodLabel}: {pa_margem_lucro.toFixed(2)}%
                          </div>
                        </TableCell>

                        {/* Total Entradas (compras) */}
                        {(() => {
                          const delta_entradas_percent = totaisPdv.pa_total_entradas > 0
                            ? ((totaisPdv.total_entradas - totaisPdv.pa_total_entradas) / totaisPdv.pa_total_entradas) * 100
                            : 0
                          return (
                            <TableCell className="text-right">
                              <div>
                                {formatCurrency(totaisPdv.total_entradas)}
                              </div>
                              <div className={`flex items-center justify-end gap-1 text-xs ${delta_entradas_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {delta_entradas_percent >= 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                <span>
                                  {delta_entradas_percent >= 0 ? '+' : ''}{delta_entradas_percent.toFixed(2)}%
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {comparisonPeriodLabel}: {formatCurrency(totaisPdv.pa_total_entradas)}
                              </div>
                            </TableCell>
                          )
                        })()}

                        {/* Total Cupons */}
                        {(() => {
                          const delta_cupons_percent = totaisPdv.pa_total_cupons > 0
                            ? ((totaisPdv.total_cupons - totaisPdv.pa_total_cupons) / totaisPdv.pa_total_cupons) * 100
                            : 0
                          return (
                            <TableCell className="text-right">
                              <div>
                                {totaisPdv.total_cupons.toLocaleString('pt-BR')}
                              </div>
                              <div className={`flex items-center justify-end gap-1 text-xs ${delta_cupons_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {delta_cupons_percent >= 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                <span>
                                  {delta_cupons_percent >= 0 ? '+' : ''}{delta_cupons_percent.toFixed(2)}%
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {comparisonPeriodLabel}: {totaisPdv.pa_total_cupons.toLocaleString('pt-BR')}
                              </div>
                            </TableCell>
                          )
                        })()}

                        {/* Total SKU */}
                        {(() => {
                          const delta_sku_percent = pa_total_sku_table > 0
                            ? ((total_sku_table - pa_total_sku_table) / pa_total_sku_table) * 100
                            : 0
                          return (
                            <TableCell className="text-right">
                              <div>
                                {total_sku_table.toLocaleString('pt-BR')}
                              </div>
                              <div className={`flex items-center justify-end gap-1 text-xs ${delta_sku_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {delta_sku_percent >= 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                <span>
                                  {delta_sku_percent >= 0 ? '+' : ''}{delta_sku_percent.toFixed(2)}%
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {comparisonPeriodLabel}: {pa_total_sku_table.toLocaleString('pt-BR')}
                              </div>
                            </TableCell>
                          )
                        })()}
                      </TableRow>
                    )
                  })()}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhum dado de vendas disponível para o período selecionado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
