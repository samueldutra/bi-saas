'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Wallet } from 'lucide-react'

interface CashFlowEmptyStateProps {
  title?: string
  description?: string
}

export function CashFlowEmptyState({
  title = 'Nenhum movimento encontrado',
  description = 'Ajuste os filtros de período, filial ou origem para visualizar o fluxo de caixa no recorte desejado.',
}: CashFlowEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
