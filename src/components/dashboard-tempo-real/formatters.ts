export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export const formatValueShort = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`
  }

  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`
  }

  return `R$ ${value.toFixed(0)}`
}
