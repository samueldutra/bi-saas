'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { format, parse, isValid, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type FilterType = 'month' | 'year' | 'custom'

interface DashboardFilterProps {
  onPeriodChange: (dataInicial: Date, dataFinal: Date, filterType: FilterType) => void
}

const MONTHS = [
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

// Gera lista de anos (ano atual e 10 anos anteriores)
const generateYears = () => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = 0; i <= 10; i++) {
    const year = currentYear - i
    years.push({ value: year.toString(), label: year.toString() })
  }
  return years
}

const YEARS = generateYears()

export function DashboardFilter({ onPeriodChange }: DashboardFilterProps) {
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const [filterType, setFilterType] = useState<FilterType>('month')
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth.toString())
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString())
  
  // Estados para período customizado
  const [startDateInput, setStartDateInput] = useState<string>('')
  const [endDateInput, setEndDateInput] = useState<string>('')
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)

  // Estados para controlar o mês exibido no calendário (mantém o mês selecionado ao reabrir)
  const [startMonth, setStartMonth] = useState<Date | undefined>(undefined)
  const [endMonth, setEndMonth] = useState<Date | undefined>(undefined)

  const getMonthPeriod = (monthIndex: number, yearValue: number) => {
    const firstDay = startOfMonth(new Date(yearValue, monthIndex))
    const isCurrentMonth = monthIndex === currentMonth && yearValue === currentYear

    if (isCurrentMonth) {
      const yesterday = new Date()
      yesterday.setHours(0, 0, 0, 0)
      yesterday.setDate(yesterday.getDate() - 1)

      return {
        firstDay,
        lastDay: yesterday < firstDay ? firstDay : yesterday,
      }
    }

    return {
      firstDay,
      lastDay: endOfMonth(new Date(yearValue, monthIndex)),
    }
  }

  // Inicialização - aplica filtro do mês atual
  useEffect(() => {
    const monthIndex = parseInt(selectedMonth)
    const yearValue = parseInt(selectedYear)
    const { firstDay, lastDay } = getMonthPeriod(monthIndex, yearValue)

    onPeriodChange(firstDay, lastDay, 'month')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Atualiza quando muda o mês selecionado
  useEffect(() => {
    if (filterType === 'month') {
      const monthIndex = parseInt(selectedMonth)
      const yearValue = parseInt(selectedYear)
      const { firstDay, lastDay } = getMonthPeriod(monthIndex, yearValue)

      onPeriodChange(firstDay, lastDay, 'month')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, filterType])

  // Atualiza quando muda o ano selecionado
  useEffect(() => {
    if (filterType === 'year') {
      const yearValue = parseInt(selectedYear)
      const firstDay = new Date(yearValue, 0, 1) // 1º de Janeiro
      const lastDay = new Date(yearValue, 11, 31) // 31 de Dezembro

      onPeriodChange(firstDay, lastDay, 'year')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, filterType])

  // Atualiza quando muda para período customizado
  useEffect(() => {
    if (filterType === 'custom' && startDateInput && endDateInput) {
      const startDate = parse(startDateInput, 'dd/MM/yyyy', new Date())
      const endDate = parse(endDateInput, 'dd/MM/yyyy', new Date())

      if (isValid(startDate) && isValid(endDate)) {
        onPeriodChange(startDate, endDate, 'custom')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateInput, endDateInput, filterType])

  const handleFilterTypeChange = (value: FilterType) => {
    setFilterType(value)

    if (value === 'month') {
      // Sempre usa o ano atual no filtro por mês
      setSelectedYear(currentYear.toString())
      setSelectedMonth(currentMonth.toString())
      // Volta para o mês atual quando muda para filtro por mês
      const { firstDay, lastDay } = getMonthPeriod(currentMonth, currentYear)

      onPeriodChange(firstDay, lastDay, 'month')
    } else if (value === 'year') {
      // Filtra pelo ano
      const yearValue = parseInt(selectedYear)
      const firstDay = new Date(yearValue, 0, 1) // 1º de Janeiro
      const lastDay = new Date(yearValue, 11, 31) // 31 de Dezembro

      onPeriodChange(firstDay, lastDay, 'year')
    } else {
      // Inicializa com o mês atual quando muda para customizado
      const now = new Date()
      const firstDay = startOfMonth(now)
      const lastDay = endOfMonth(now)
      setStartDateInput(format(firstDay, 'dd/MM/yyyy'))
      setEndDateInput(format(lastDay, 'dd/MM/yyyy'))
      setStartMonth(firstDay) // Inicializa o mês do calendário
      setEndMonth(lastDay)    // Inicializa o mês do calendário
      onPeriodChange(firstDay, lastDay, 'custom')
    }
  }

  const handleStartDateChange = (value: string) => {
    setStartDateInput(value)
    const parsedDate = parse(value, 'dd/MM/yyyy', new Date())
    if (isValid(parsedDate)) {
      setStartMonth(parsedDate)
    }
  }

  const handleEndDateChange = (value: string) => {
    setEndDateInput(value)
    const parsedDate = parse(value, 'dd/MM/yyyy', new Date())
    if (isValid(parsedDate)) {
      setEndMonth(parsedDate)
    }
  }

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

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
      {/* Filtrar por */}
      <div className="flex flex-col gap-2 w-full sm:w-[250px] flex-shrink-0">
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
          {/* Escolha o mês */}
          <div className="flex flex-col gap-2 w-full sm:w-[250px] flex-shrink-0">
            <Label className="text-sm">Escolha o mês</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-10 w-full min-w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : filterType === 'year' ? (
        <>
          {/* Escolha o ano */}
          <div className="flex flex-col gap-2 w-full sm:w-[250px] flex-shrink-0">
            <Label className="text-sm">Escolha o ano</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-10 w-full min-w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          {/* Data Inicial */}
          <div className="flex flex-col gap-2 w-full sm:w-[140px] flex-shrink-0">
            <Label className="text-sm">Data Inicial</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="dd/mm/aaaa"
                value={startDateInput}
                onChange={(e) => handleStartDateChange(e.target.value)}
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
          <span className="hidden lg:block text-muted-foreground self-end pb-2 flex-shrink-0">→</span>

          {/* Data Final */}
          <div className="flex flex-col gap-2 w-full sm:w-[140px] flex-shrink-0">
            <Label className="text-sm">Data Final</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="dd/mm/aaaa"
                value={endDateInput}
                onChange={(e) => handleEndDateChange(e.target.value)}
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
    </div>
  )
}
