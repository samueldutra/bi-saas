'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type FilterType } from '@/components/despesas/dre-filter'
import { differenceInCalendarDays, format, subDays, subYears } from 'date-fns'
import { TrendingUp, TrendingDown, Receipt, SquarePercent } from 'lucide-react'

interface IndicadoresData {
  receitaBruta: number
  lucroBruto: number
  cmv: number
  totalDespesas: number
  lucroLiquido: number
  margemLucroBruto: number
  margemLucroLiquido: number
}

interface ComparacaoIndicadores {
  current: IndicadoresData
  pam: {
    data: IndicadoresData
    ano: number
  }
  paa: {
    data: IndicadoresData
    ano: number
  }
}

interface IndicatorsCardsProps {
  indicadores: ComparacaoIndicadores | null
  loading: boolean
  mes: number
  filterType: FilterType
  appliedPeriod: {
    dataInicio: Date
    dataFim: Date
  }
}

export function IndicatorsCards({ indicadores, loading, mes, filterType, appliedPeriod }: IndicatorsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  // const formatPercent = (value: number) => {
  //   return `${value.toFixed(2)}%`
  // }

  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: false }
    const percent = ((current - previous) / previous) * 100
    return {
      percent: Math.abs(percent),
      isPositive: current > previous
    }
  }

  // Abreviações dos meses em português
  const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

  // Função para obter abreviação do mês
  const getMesAbrev = (mesIndex: number): string => {
    return MESES_ABREV[mesIndex] || ''
  }

  // Função para obter abreviação do mês anterior
  const getMesAnteriorAbrev = (mesIndex: number): string => {
    const mesAnterior = mesIndex - 1 < 0 ? 11 : mesIndex - 1
    return MESES_ABREV[mesAnterior] || ''
  }

  const formatRangeLabel = (start: Date, end: Date): string => {
    return `${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`
  }

  const getCustomComparisonLabels = () => {
    const totalDias = differenceInCalendarDays(appliedPeriod.dataFim, appliedPeriod.dataInicio) + 1
    const pamFim = subDays(appliedPeriod.dataInicio, 1)
    const pamInicio = subDays(appliedPeriod.dataInicio, totalDias)
    const paaInicio = subYears(appliedPeriod.dataInicio, 1)
    const paaFim = subYears(appliedPeriod.dataFim, 1)

    return {
      pam: formatRangeLabel(pamInicio, pamFim),
      paa: formatRangeLabel(paaInicio, paaFim)
    }
  }

  if (loading || !indicadores) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const { current, pam, paa } = indicadores

  // Determinar labels baseados no filtro de mês
  const customLabels = filterType === 'custom' ? getCustomComparisonLabels() : null
  const labelPam = filterType === 'custom'
    ? customLabels?.pam || ''
    : mes === -1
      ? `${pam.ano} (YTD)`
      : `${getMesAnteriorAbrev(mes)}/${pam.ano}`

  const labelPaa = filterType === 'custom'
    ? customLabels?.paa || ''
    : mes === -1
      ? `${paa.ano} (YTD)`
      : `${getMesAbrev(mes)}/${paa.ano}`
  const showPaa = filterType === 'custom' || mes !== -1

  // Calcular variações para Receita Bruta
  const variacaoPamReceita = calculateVariation(current.receitaBruta, pam.data.receitaBruta)
  const variacaoPaaReceita = calculateVariation(current.receitaBruta, paa.data.receitaBruta)

  // Calcular variações para CMV
  const variacaoPamCmv = calculateVariation(current.cmv, pam.data.cmv)
  const variacaoPaaCmv = calculateVariation(current.cmv, paa.data.cmv)

  // Calcular variações para Lucro Bruto
  const variacaoPamLucroBruto = calculateVariation(current.lucroBruto, pam.data.lucroBruto)
  const variacaoPaaLucroBruto = calculateVariation(current.lucroBruto, paa.data.lucroBruto)

  // Calcular variações para Total de Despesas
  const variacaoPamDespesas = calculateVariation(current.totalDespesas, pam.data.totalDespesas)
  const variacaoPaaDespesas = calculateVariation(current.totalDespesas, paa.data.totalDespesas)

  // Calcular variações para Lucro Líquido (não usado atualmente)
  // const variacaoPamLucroLiquido = calculateVariation(current.lucroLiquido, pam.data.lucroLiquido)
  // const variacaoPaaLucroLiquido = calculateVariation(current.lucroLiquido, paa.data.lucroLiquido)

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* Card 1: Receita Bruta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Receita Bruta</CardTitle>
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-base lg:text-lg font-bold truncate">{formatCurrency(current.receitaBruta)}</div>
          
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>{labelPam}:</span>
              <span className="font-medium">{formatCurrency(pam.data.receitaBruta)}</span>
            </div>
            {pam.data.receitaBruta > 0 && (
              <div className={`text-[10px] flex items-center gap-1 ${
                variacaoPamReceita.isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {variacaoPamReceita.isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                <span>
                  {variacaoPamReceita.percent.toFixed(1)}%
                </span>
              </div>
            )}
            {showPaa && (
              <>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-2">
                  <span>{labelPaa}:</span>
                  <span className="font-medium">{formatCurrency(paa.data.receitaBruta)}</span>
                </div>
                {paa.data.receitaBruta > 0 && (
                  <div className={`text-[10px] flex items-center gap-1 ${
                    variacaoPaaReceita.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {variacaoPaaReceita.isPositive ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    <span>
                      {variacaoPaaReceita.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: CMV */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">CMV</CardTitle>
          <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-base lg:text-lg font-bold truncate">{formatCurrency(current.cmv)}</div>
          
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>{labelPam}:</span>
              <span className="font-medium">{formatCurrency(pam.data.cmv)}</span>
            </div>
            {pam.data.cmv > 0 && (
              <div className={`text-[10px] flex items-center gap-1 ${
                current.cmv <= pam.data.cmv
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {current.cmv <= pam.data.cmv ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : (
                  <TrendingUp className="h-2.5 w-2.5" />
                )}
                <span>
                  {Math.abs(variacaoPamCmv.percent).toFixed(1)}%
                </span>
              </div>
            )}
            {showPaa && (
              <>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-2">
                  <span>{labelPaa}:</span>
                  <span className="font-medium">{formatCurrency(paa.data.cmv)}</span>
                </div>
                {paa.data.cmv > 0 && (
                  <div className={`text-[10px] flex items-center gap-1 ${
                    current.cmv <= paa.data.cmv
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {current.cmv <= paa.data.cmv ? (
                      <TrendingDown className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingUp className="h-2.5 w-2.5" />
                    )}
                    <span>
                      {Math.abs(variacaoPaaCmv.percent).toFixed(1)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Lucro Bruto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Lucro Bruto</CardTitle>
          <SquarePercent className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-base lg:text-lg font-bold truncate">{formatCurrency(current.lucroBruto)}</div>
          <div className="text-[10px] text-muted-foreground mb-2 truncate">
            {current.margemLucroBruto.toFixed(2)}% da Receita Bruta
          </div>
          
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>{labelPam}:</span>
              <span className="font-medium">{formatCurrency(pam.data.lucroBruto)}</span>
            </div>
            {pam.data.lucroBruto > 0 && (
              <div className={`text-[10px] flex items-center gap-1 ${
                variacaoPamLucroBruto.isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {variacaoPamLucroBruto.isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                <span>
                  {variacaoPamLucroBruto.percent.toFixed(1)}%
                </span>
              </div>
            )}
            {showPaa && (
              <>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-2">
                  <span>{labelPaa}:</span>
                  <span className="font-medium">{formatCurrency(paa.data.lucroBruto)}</span>
                </div>
                {paa.data.lucroBruto > 0 && (
                  <div className={`text-[10px] flex items-center gap-1 ${
                    variacaoPaaLucroBruto.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {variacaoPaaLucroBruto.isPositive ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    <span>
                      {variacaoPaaLucroBruto.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Total de Despesas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Total de Despesas</CardTitle>
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-base lg:text-lg font-bold truncate">{formatCurrency(current.totalDespesas)}</div>
          {current.receitaBruta > 0 && (
            <div className="text-[10px] text-muted-foreground mb-2 truncate">
              {((current.totalDespesas / current.receitaBruta) * 100).toFixed(2)}% da Receita Bruta
            </div>
          )}
          
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>{labelPam}:</span>
              <span className="font-medium">{formatCurrency(pam.data.totalDespesas)}</span>
            </div>
            {pam.data.totalDespesas > 0 && (
              <div className={`text-[10px] flex items-center gap-1 ${
                current.totalDespesas <= pam.data.totalDespesas
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {current.totalDespesas <= pam.data.totalDespesas ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : (
                  <TrendingUp className="h-2.5 w-2.5" />
                )}
                <span>
                  {variacaoPamDespesas.percent.toFixed(1)}%
                </span>
              </div>
            )}
            {showPaa && (
              <>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-2">
                  <span>{labelPaa}:</span>
                  <span className="font-medium">{formatCurrency(paa.data.totalDespesas)}</span>
                </div>
                {paa.data.totalDespesas > 0 && (
                  <div className={`text-[10px] flex items-center gap-1 ${
                    current.totalDespesas <= paa.data.totalDespesas
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {current.totalDespesas <= paa.data.totalDespesas ? (
                      <TrendingDown className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingUp className="h-2.5 w-2.5" />
                    )}
                    <span>
                      {variacaoPaaDespesas.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 5: Lucro Líquido */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Lucro Líquido</CardTitle>
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-base lg:text-lg font-bold truncate">{formatCurrency(current.lucroLiquido)}</div>
          {current.receitaBruta > 0 && (
            <div className="text-[10px] text-muted-foreground mb-2 truncate">
              {current.margemLucroLiquido.toFixed(2)}% da Receita Bruta
            </div>
          )}
          
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-muted-foreground truncate">
              Lucro Líquido = Lucro Bruto - Despesas
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
