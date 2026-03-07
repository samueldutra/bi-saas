'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
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
  areaChartConfig: Record<string, { label: string; color: string }>
  errorVendasHora?: string | null
  errorVendasPorLoja?: string | null
}

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

export function DashboardTempoRealChartsSection({
  vendasPorHora,
  vendasPorLojaData,
  isLoadingVendasHora,
  isLoadingVendasPorLoja,
  areaChartConfig,
  errorVendasHora,
  errorVendasPorLoja,
}: DashboardTempoRealChartsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{DASHBOARD_TEMPO_REAL_TEXT.charts.vendasHoraTitle}</CardTitle>
          <CardDescription>
            {DASHBOARD_TEMPO_REAL_TEXT.charts.vendasHoraDescription} ({vendasPorHora?.filiais?.length || 0} {DASHBOARD_TEMPO_REAL_TEXT.charts.branchesSuffix})
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
            Array.isArray(vendasPorHora.filiais) &&
            vendasPorHora.filiais.length > 0 ? (
            <div className="space-y-3">
              <ChartContainer config={areaChartConfig} className="h-64 w-full">
                <AreaChart data={vendasPorHora.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => formatValueShort(value)} tick={{ fontSize: 12 }} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null

                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <p className="mb-2 text-sm font-medium">{DASHBOARD_TEMPO_REAL_TEXT.charts.hourLabel} {label}</p>
                          <div className="space-y-1">
                            {payload.map((entry) => {
                              const filialName =
                                areaChartConfig[entry.dataKey as string]?.label || entry.dataKey

                              return (
                                <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                                  <div
                                    className="h-3 w-3 shrink-0 rounded-sm"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span>
                                    {filialName} - {formatCurrency(Number(entry.value))}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }}
                  />
                  {vendasPorHora.filiais.map((filial) => (
                    <Area
                      key={filial.id}
                      type="monotone"
                      dataKey={filial.id.toString()}
                      name={filial.nome}
                      fill={filial.cor}
                      fillOpacity={0.3}
                      stroke={filial.cor}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>

              <div
                className="flex flex-wrap justify-center gap-2 overflow-y-auto border-t pt-3"
                style={{ maxHeight: vendasPorHora.filiais.length > 10 ? '80px' : 'auto' }}
              >
                {vendasPorHora.filiais.map((filial) => (
                  <div key={filial.id} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: filial.cor }}
                    />
                    <span className="max-w-[100px] truncate text-muted-foreground" title={filial.nome}>
                      {filial.nome}
                    </span>
                  </div>
                ))}
              </div>
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
