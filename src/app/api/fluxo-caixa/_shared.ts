import { z } from 'zod'

import type { CashFlowFiltersState } from '@/components/fluxo-caixa/types'

export const cashFlowQuerySchema = z.object({
  schema: z.string().min(1),
  data_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  data_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  filiais: z.string().optional(),
  view_mode: z
    .enum(['realizado', 'projetado', 'consolidado'])
    .default('consolidado'),
  grouping: z.enum(['diario', 'semanal', 'mensal']).default('diario'),
  origin: z
    .enum(['all', 'pdv', 'faturamento', 'receber', 'pagar', 'ajustes'])
    .default('all'),
  status: z.enum(['all', 'saudavel', 'atencao', 'critico']).default('all'),
  breakdown: z.enum(['consolidado', 'por_filial']).default('consolidado'),
})

export function getCashFlowFilters(
  query: z.infer<typeof cashFlowQuerySchema>
): Pick<
  CashFlowFiltersState,
  'breakdown' | 'grouping' | 'origin' | 'status' | 'viewMode'
> {
  return {
    viewMode: query.view_mode,
    grouping: query.grouping,
    origin: query.origin,
    status: query.status,
    breakdown: query.breakdown,
  }
}
