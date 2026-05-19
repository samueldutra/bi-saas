'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TenantParameter {
  id: string
  tenant_id: string
  parameter_key: string
  parameter_value: boolean
  parameter_numeric_value: number | string | null
}

const MARGEM_PERDA_KEY = 'margem_perda'

const DEFAULT_BOOLEAN_PARAMETERS: Record<string, boolean> = {
  enable_descontos_venda: false,
  enable_faturamento_metas: false,
  enable_api_filial_vendas: false,
}

const DEFAULT_NUMERIC_PARAMETERS: Record<string, number> = {
  margem_perda: 0,
}

function parseNumericParameter(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function useTenantParameters(tenantId: string | undefined) {
  const [parameters, setParameters] = useState<Record<string, boolean>>(DEFAULT_BOOLEAN_PARAMETERS)
  const [numericParameters, setNumericParameters] = useState<Record<string, number>>(DEFAULT_NUMERIC_PARAMETERS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reset parameters to default when tenant changes
    setParameters(DEFAULT_BOOLEAN_PARAMETERS)
    setNumericParameters(DEFAULT_NUMERIC_PARAMETERS)
    setLoading(true)

    if (!tenantId) {
      setLoading(false)
      return
    }

    const loadParameters = async () => {
      try {
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('tenant_parameters')
          .select('*')
          .eq('tenant_id', tenantId)

        if (error) {
          console.error('Error loading tenant parameters:', error)
          setParameters(DEFAULT_BOOLEAN_PARAMETERS)
          setNumericParameters(DEFAULT_NUMERIC_PARAMETERS)
          return
        }

        // Start with default values
        const params: Record<string, boolean> = { ...DEFAULT_BOOLEAN_PARAMETERS }
        const numericParams: Record<string, number> = { ...DEFAULT_NUMERIC_PARAMETERS }

        // Override with actual values from database
        if (data && data.length > 0) {
          data.forEach((param: TenantParameter) => {
            if (param.parameter_key === MARGEM_PERDA_KEY) {
              numericParams[MARGEM_PERDA_KEY] = parseNumericParameter(param.parameter_numeric_value)
              return
            }

            params[param.parameter_key] = param.parameter_value
          })
        }

        setParameters(params)
        setNumericParameters(numericParams)
      } catch (error) {
        console.error('Error in useTenantParameters:', error)
        setParameters(DEFAULT_BOOLEAN_PARAMETERS)
        setNumericParameters(DEFAULT_NUMERIC_PARAMETERS)
      } finally {
        setLoading(false)
      }
    }

    loadParameters()
  }, [tenantId])

  return { parameters, numericParameters, loading }
}
