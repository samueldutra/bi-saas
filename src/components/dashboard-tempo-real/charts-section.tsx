'use client'

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

import { DASHBOARD_TEMPO_REAL_TEXT } from './config'
import { formatCurrency, formatValueShort } from './formatters'
import { DashboardTempoRealSectionError } from './section-error'
import type { VendasPorHoraData, VendasPorLojaResponse } from './types'

type DashboardTempoRealChartsSectionProps = {
  vendasPorHora?: VendasPorHoraData
  vendasPorLojaData?: VendasPorLojaResponse
  isLoadingVendasHora: boolean
  isLoadingVendasPorLoja: boolean
  errorVendasHora?: string | null
  errorVendasPorLoja?: string | null
}

const vendasHoraChartConfig = {
  total_vendas: {
    label: 'Total vendido',
    color: 'hsl(142, 76%, 45%)',
  },
} satisfies ChartConfig

const barChartConfig = {
  receita_oferta: {
    label: DASHBOARD_TEMPO_REAL_TEXT.charts.ofertaLabel,
    color: 'hsl(38, 92%, 50%)',
  },
  receita_normal: {
    label: DASHBOARD_TEMPO_REAL_TEXT.charts.geralLabel,
    color: 'hsl(142, 76%, 45%)',
  },
}

type VendasHoraTickProps = {
  x?: number
  y?: number
  payload?: {
    value?: string
  }
}

type VendasHoraYAxisTickProps = {
  x?: number
  y?: number
  payload?: {
    value?: number
  }
}

function VendasHoraXAxisTick({ x = 0, y = 0, payload }: VendasHoraTickProps) {
  const faixa = payload?.value ?? ''
  const [inicio = '', fim = ''] = faixa.split(' às ')

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="middle"
        fill="currentColor"
        className="fill-muted-foreground text-[11px]"
      >
        <tspan x={0} dy={0}>
          {`${inicio}:00`}
        </tspan>
        <tspan x={0} dy={14}>
          às
        </tspan>
        <tspan x={0} dy={14}>
          {`${fim}:00`}
        </tspan>
      </text>
    </g>
  )
}

function VendasHoraYAxisTick({ x = 0, y = 0, payload }: VendasHoraYAxisTickProps) {
  const value = payload?.value ?? 0

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill="currentColor"
        className="fill-muted-foreground text-[11px]"
        style={{ whiteSpace: 'pre' }}
      >
        {formatValueShort(Number(value))}
      </text>
    </g>
  )
}

export function DashboardTempoRealChartsSection({
  vendasPorHora,
  vendasPorLojaData,
  isLoadingVendasHora,
  isLoadingVendasPorLoja,
  errorVendasHora,
  errorVendasPorLoja,
}: DashboardTempoRealChartsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{DASHBOARD_TEMPO_REAL_TEXT.charts.vendasHoraTitle}</CardTitle>
          <CardDescription>
            {DASHBOARD_TEMPO_REAL_TEXT.charts.vendasHoraDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorVendasHora && (isLoadingVendasHora || vendasPorHora) && (
            <DashboardTempoRealSectionError
              className="mb-4"
              message={errorVendasHora}
            />
          )}
          {isLoadingVendasHora ? (
            <Skeleton className="h-80 w-full" />
          ) : errorVendasHora && !vendasPorHora ? (
            <div className="flex h-80 items-center justify-center">
              <DashboardTempoRealSectionError message={errorVendasHora} />
            </div>
          ) : vendasPorHora?.data &&
            Array.isArray(vendasPorHora.data) &&
            vendasPorHora.data.length > 0 &&
            vendasPorHora.data.some((faixa) => faixa.total_vendas > 0) ? (
            <div className="space-y-3">
              <ChartContainer config={vendasHoraChartConfig} className="h-72 w-full">
                <BarChart
                  accessibilityLayer
                  data={vendasPorHora.data}
                  margin={{ top: 24, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="faixa"
                    tickLine={false}
                    tickMargin={16}
                    axisLine={false}
                    height={56}
                    interval={0}
                    tick={<VendasHoraXAxisTick />}
                  />
                  <YAxis
                    width={68}
                    tick={<VendasHoraYAxisTick />}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value) => (
                          <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">Total vendido</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {formatCurrency(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="total_vendas"
                    fill="var(--color-total_vendas)"
                    radius={8}
                  >
                    <LabelList
                      dataKey="total_vendas"
                      position="top"
                      offset={12}
                      className="fill-foreground"
                      fontSize={12}
                      formatter={(value: number) => formatValueShort(value)}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.charts.noSalesData}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{DASHBOARD_TEMPO_REAL_TEXT.charts.vendasPorLojaTitle}</CardTitle>
          <CardDescription>
            {DASHBOARD_TEMPO_REAL_TEXT.charts.vendasPorLojaDescription} ({vendasPorLojaData?.lojas?.length || 0} {DASHBOARD_TEMPO_REAL_TEXT.charts.branchesSuffix})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorVendasPorLoja && (isLoadingVendasPorLoja || vendasPorLojaData) && (
            <DashboardTempoRealSectionError
              className="mb-4"
              message={errorVendasPorLoja}
            />
          )}
          {isLoadingVendasPorLoja ? (
            <Skeleton className="h-80 w-full" />
          ) : errorVendasPorLoja && !vendasPorLojaData ? (
            <div className="flex h-80 items-center justify-center">
              <DashboardTempoRealSectionError message={errorVendasPorLoja} />
            </div>
          ) : vendasPorLojaData?.lojas && vendasPorLojaData.lojas.length > 0 ? (
            <div className="space-y-4">
              <div
                className="overflow-y-auto"
                style={{ maxHeight: vendasPorLojaData.lojas.length > 8 ? '320px' : '220px' }}
              >
                <ChartContainer
                  config={barChartConfig}
                  className="w-full"
                  style={{ height: Math.max(200, vendasPorLojaData.lojas.length * 28) }}
                >
                  <BarChart
                    data={vendasPorLojaData.lojas}
                    layout="vertical"
                    margin={{ top: 5, right: 80, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <YAxis
                      dataKey="filial_nome"
                      type="category"
                      width={80}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => (value.length > 12 ? `${value.slice(0, 12)}...` : value)}
                    />
                    <XAxis type="number" hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, item) => (
                            <>
                              <div
                                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: item.color }}
                              />
                              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                <span className="text-muted-foreground">
                                  {name === 'receita_oferta'
                                    ? DASHBOARD_TEMPO_REAL_TEXT.charts.ofertaLabel
                                    : DASHBOARD_TEMPO_REAL_TEXT.charts.geralLabel}
                                </span>
                                <span className="font-mono text-foreground font-medium tabular-nums">
                                  {formatCurrency(Number(value))}
                                </span>
                              </div>
                            </>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="receita_oferta"
                      stackId="receita"
                      fill="var(--color-receita_oferta)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="receita_normal"
                      stackId="receita"
                      fill="var(--color-receita_normal)"
                      radius={[0, 4, 4, 0]}
                    >
                      <LabelList
                        dataKey="receita_total"
                        position="right"
                        offset={8}
                        className="fill-foreground"
                        fontSize={11}
                        formatter={(value: number) => formatValueShort(value)}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>

              {vendasPorLojaData.lojas.length <= 8 && (
                <div className="border-t pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {DASHBOARD_TEMPO_REAL_TEXT.charts.metaTitle}
                  </p>
                  <div
                    className="space-y-2 overflow-y-auto"
                    style={{ maxHeight: vendasPorLojaData.lojas.length > 6 ? '150px' : 'auto' }}
                  >
                    {vendasPorLojaData.lojas.map((loja) => (
                      <div key={loja.filial_id} className="flex items-center gap-2">
                        <span className="w-20 truncate text-xs" title={loja.filial_nome}>
                          {loja.filial_nome}
                        </span>
                        <Progress value={Math.min(loja.atingimento_meta, 100)} className="h-2 flex-1" />
                        <span className="w-12 text-right text-xs">
                          {loja.atingimento_meta.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center text-muted-foreground">
              {DASHBOARD_TEMPO_REAL_TEXT.charts.noStoreData}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
