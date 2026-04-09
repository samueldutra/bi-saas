"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { MultiFilialFilter, type FilialOption } from "@/components/filters"
import { Search, CalendarIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, parse, isValid, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

export type FilterType = 'month' | 'year' | 'custom'

const MESES = [
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Março' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Maio' },
  { value: '5', label: 'Junho' },
  { value: '6', label: 'Julho' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Setembro' },
  { value: '9', label: 'Outubro' },
  { value: '10', label: 'Novembro' },
  { value: '11', label: 'Dezembro' },
]

const getAnosDisponiveis = () => {
  const anoAtual = new Date().getFullYear()
  return Array.from({ length: 10 }, (_, i) => anoAtual - i)
}

export interface FilterConfig {
  filiais: FilialOption[]
  filterType: FilterType
  mes: number
  ano: number
  dataInicio: Date
  dataFim: Date
}

interface DREFilterProps {
  filiaisSelecionadas: FilialOption[]
  setFiliaisSelecionadas: (filiais: FilialOption[]) => void
  mes: number
  setMes: (mes: number) => void
  ano: number
  setAno: (ano: number) => void
  branches: FilialOption[]
  isLoadingBranches: boolean
  appliedPeriod?: {
    filterType: FilterType
    mes: number
    ano: number
    dataInicio: Date
    dataFim: Date
  }
  onFilter: (config: FilterConfig) => void
}

export function DREFilter({
  filiaisSelecionadas,
  setFiliaisSelecionadas,
  mes,
  setMes,
  ano,
  setAno,
  branches,
  isLoadingBranches,
  appliedPeriod,
  onFilter,
}: DREFilterProps) {
  // Estados locais para os filtros (não aplicados ainda)
  const [localFiliais, setLocalFiliais] = useState<FilialOption[]>(filiaisSelecionadas)
  const [localMes, setLocalMes] = useState<number>(mes)
  const [localAno, setLocalAno] = useState<number>(ano)

  // Tipo de filtro de período
  const [filterType, setFilterType] = useState<FilterType>(appliedPeriod?.filterType || (mes === -1 ? 'year' : 'month'))

  // Estados para período customizado
  const [startDateInput, setStartDateInput] = useState<string>('')
  const [endDateInput, setEndDateInput] = useState<string>('')
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)

  // Estados para controlar o mês exibido no calendário (mantém o mês selecionado ao reabrir)
  const [startMonth, setStartMonth] = useState<Date | undefined>(undefined)
  const [endMonth, setEndMonth] = useState<Date | undefined>(undefined)

  // Sincronizar quando filtros externos mudarem (ex: inicialização)
  useEffect(() => {
    setLocalFiliais(filiaisSelecionadas)
  }, [filiaisSelecionadas])

  useEffect(() => {
    setLocalMes(mes)
  }, [mes])

  useEffect(() => {
    setLocalAno(ano)
  }, [ano])

  useEffect(() => {
    if (appliedPeriod?.filterType) {
      setFilterType(appliedPeriod.filterType)
    }

    if (appliedPeriod?.filterType === 'custom') {
      setStartDateInput(format(appliedPeriod.dataInicio, 'dd/MM/yyyy'))
      setEndDateInput(format(appliedPeriod.dataFim, 'dd/MM/yyyy'))
      setStartMonth(appliedPeriod.dataInicio)
      setEndMonth(appliedPeriod.dataFim)
    }
  }, [appliedPeriod])

  // Calcular datas baseado nos filtros
  const calculateDates = (type: FilterType, mesParam: number, anoParam: number): { dataInicio: Date, dataFim: Date } => {
    if (type === 'custom') {
      const startDate = startDateInput ? parse(startDateInput, 'dd/MM/yyyy', new Date()) : new Date()
      const endDate = endDateInput ? parse(endDateInput, 'dd/MM/yyyy', new Date()) : new Date()
      return {
        dataInicio: isValid(startDate) ? startDate : new Date(),
        dataFim: isValid(endDate) ? endDate : new Date()
      }
    } else if (type === 'year') {
      return {
        dataInicio: new Date(anoParam, 0, 1),
        dataFim: new Date(anoParam, 11, 31)
      }
    } else {
      return {
        dataInicio: startOfMonth(new Date(anoParam, mesParam)),
        dataFim: endOfMonth(new Date(anoParam, mesParam))
      }
    }
  }

  const getAppliedDates = () => {
    if (appliedPeriod) {
      return {
        dataInicio: appliedPeriod.dataInicio,
        dataFim: appliedPeriod.dataFim
      }
    }

    return calculateDates(filterType, localMes, localAno)
  }

  const getCurrentSelectionDates = (type: FilterType) => {
    if (type === 'custom') {
      const startDate = parse(startDateInput, 'dd/MM/yyyy', new Date())
      const endDate = parse(endDateInput, 'dd/MM/yyyy', new Date())

      if (isValid(startDate) && isValid(endDate) && startDate <= endDate) {
        return {
          dataInicio: startDate,
          dataFim: endDate
        }
      }

      return getAppliedDates()
    }

    return calculateDates(type, localMes, localAno)
  }

  // Aplicar filtros
  const handleFilter = () => {
    const { dataInicio, dataFim } = calculateDates(filterType, localMes, localAno)

    let mesParaAPI = localMes
    if (filterType === 'year') {
      mesParaAPI = -1
    } else if (filterType === 'custom') {
      const startDate = parse(startDateInput, 'dd/MM/yyyy', new Date())
      const endDate = parse(endDateInput, 'dd/MM/yyyy', new Date())
      if (isValid(startDate) && isValid(endDate)) {
        if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
          mesParaAPI = startDate.getMonth()
        } else {
          mesParaAPI = -1
        }
      }
    }

    setFiliaisSelecionadas(localFiliais)
    setMes(mesParaAPI)
    setAno(filterType === 'custom' && startDateInput
      ? parse(startDateInput, 'dd/MM/yyyy', new Date()).getFullYear()
      : localAno)

    onFilter({
      filiais: localFiliais,
      filterType,
      mes: mesParaAPI,
      ano: filterType === 'custom' && startDateInput
        ? parse(startDateInput, 'dd/MM/yyyy', new Date()).getFullYear()
        : localAno,
      dataInicio,
      dataFim
    })
  }

  // Handler para mudança de tipo de filtro
  const handleFilterTypeChange = (value: FilterType) => {
    const previousFilterType = filterType
    setFilterType(value)

    if (value === 'month' && localMes === -1) {
      setLocalMes(new Date().getMonth())
    } else if (value === 'year') {
      setLocalMes(-1)
    } else if (value === 'custom') {
      const baseDates = getCurrentSelectionDates(previousFilterType)

      setStartDateInput(format(baseDates.dataInicio, 'dd/MM/yyyy'))
      setEndDateInput(format(baseDates.dataFim, 'dd/MM/yyyy'))
      setStartMonth(baseDates.dataInicio)
      setEndMonth(baseDates.dataFim)
    }
  }

  // Handlers para datas customizadas
  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDateInput(format(date, 'dd/MM/yyyy'))
      setStartMonth(date) // Mantém o mês selecionado
      setShowStartDatePicker(false)
    }
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      setEndDateInput(format(date, 'dd/MM/yyyy'))
      setEndMonth(date) // Mantém o mês selecionado
      setShowEndDatePicker(false)
    }
  }

  // Atualizar mês exibido quando o input muda manualmente
  const handleStartDateInputChange = (value: string) => {
    setStartDateInput(value)
    const parsedDate = parse(value, 'dd/MM/yyyy', new Date())
    if (isValid(parsedDate)) {
      setStartMonth(parsedDate)
    }
  }

  const handleEndDateInputChange = (value: string) => {
    setEndDateInput(value)
    const parsedDate = parse(value, 'dd/MM/yyyy', new Date())
    if (isValid(parsedDate)) {
      setEndMonth(parsedDate)
    }
  }

  // Validar datas customizadas
  const isCustomValid = () => {
    if (filterType !== 'custom') return true
    const startDate = parse(startDateInput, 'dd/MM/yyyy', new Date())
    const endDate = parse(endDateInput, 'dd/MM/yyyy', new Date())
    return isValid(startDate) && isValid(endDate) && startDate <= endDate
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Filtros em uma única linha no desktop */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
          {/* Filiais */}
          <div className="flex flex-col gap-2 w-full lg:w-[280px] flex-shrink-0">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Filiais</Label>
              {localFiliais.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {localFiliais.length} selecionada(s)
                </span>
              )}
            </div>
            <MultiFilialFilter
              filiais={branches}
              selectedFiliais={localFiliais}
              onChange={setLocalFiliais}
              disabled={isLoadingBranches}
              placeholder={isLoadingBranches ? "Carregando..." : "Selecione as filiais"}
            />
          </div>

          {/* Filtrar por */}
          <div className="flex flex-col gap-2 w-full sm:w-[200px] flex-shrink-0">
            <Label className="text-sm">Filtrar por</Label>
            <Select value={filterType} onValueChange={handleFilterTypeChange}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="custom">Período Customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Condicional: Mês, Ano ou Período Customizado */}
          {filterType === 'month' ? (
            <>
              {/* Mês */}
              <div className="flex flex-col gap-2 w-full sm:w-[160px] flex-shrink-0">
                <Label className="text-sm">Mês</Label>
                <Select value={localMes.toString()} onValueChange={(value) => setLocalMes(parseInt(value))}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((mesItem) => (
                      <SelectItem key={mesItem.value} value={mesItem.value}>
                        {mesItem.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ano */}
              <div className="flex flex-col gap-2 w-full sm:w-[120px] flex-shrink-0">
                <Label className="text-sm">Ano</Label>
                <Select value={localAno.toString()} onValueChange={(value) => setLocalAno(parseInt(value))}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAnosDisponiveis().map((anoItem) => (
                      <SelectItem key={anoItem} value={anoItem.toString()}>
                        {anoItem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : filterType === 'year' ? (
            <>
              {/* Ano */}
              <div className="flex flex-col gap-2 w-full sm:w-[120px] flex-shrink-0">
                <Label className="text-sm">Ano</Label>
                <Select value={localAno.toString()} onValueChange={(value) => setLocalAno(parseInt(value))}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAnosDisponiveis().map((anoItem) => (
                      <SelectItem key={anoItem} value={anoItem.toString()}>
                        {anoItem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              {/* Data Inicial */}
              <div className="flex flex-col gap-2 w-full sm:w-[150px] flex-shrink-0">
                <Label className="text-sm">Data Inicial</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="dd/mm/aaaa"
                    value={startDateInput}
                    onChange={(e) => handleStartDateInputChange(e.target.value)}
                    className="w-full h-10 text-center pr-9"
                    maxLength={10}
                  />
                  <Popover open={showStartDatePicker} onOpenChange={setShowStartDatePicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-accent"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDateInput ? parse(startDateInput, 'dd/MM/yyyy', new Date()) : undefined}
                        onSelect={handleStartDateSelect}
                        month={startMonth}
                        onMonthChange={setStartMonth}
                        captionLayout="dropdown"
                        startMonth={new Date(2020, 0)}
                        endMonth={new Date(2030, 11)}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Seta separadora - oculta em mobile */}
              <span className="hidden lg:flex items-end pb-2 text-muted-foreground">→</span>

              {/* Data Final */}
              <div className="flex flex-col gap-2 w-full sm:w-[150px] flex-shrink-0">
                <Label className="text-sm">Data Final</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="dd/mm/aaaa"
                    value={endDateInput}
                    onChange={(e) => handleEndDateInputChange(e.target.value)}
                    className="w-full h-10 text-center pr-9"
                    maxLength={10}
                  />
                  <Popover open={showEndDatePicker} onOpenChange={setShowEndDatePicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-accent"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDateInput ? parse(endDateInput, 'dd/MM/yyyy', new Date()) : undefined}
                        onSelect={handleEndDateSelect}
                        month={endMonth}
                        onMonthChange={setEndMonth}
                        captionLayout="dropdown"
                        startMonth={new Date(2020, 0)}
                        endMonth={new Date(2030, 11)}
                        locale={ptBR}
                        disabled={(date) => {
                          const startDate = startDateInput ? parse(startDateInput, 'dd/MM/yyyy', new Date()) : undefined
                          return startDate && isValid(startDate) ? date < startDate : false
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </>
          )}

          {/* Botão Filtrar */}
          <div className="flex flex-col gap-2 w-full sm:w-auto flex-shrink-0">
            <Label className="text-sm invisible">Ação</Label>
            <Button
              onClick={handleFilter}
              className="h-10 w-full sm:w-[120px]"
              disabled={isLoadingBranches || localFiliais.length === 0 || !isCustomValid()}
            >
              <Search className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
