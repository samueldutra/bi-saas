'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TenantParameter {
  id: string
  tenant_id: string
  parameter_key: string
  parameter_value: boolean
}

export function useTenantParameters(tenantId: string | undefined) {
  const [parameters, setParameters] = useState<Record<string, boolean>>({
    enable_descontos_venda: false,
    enable_faturamento_metas: false,
    enable_api_filial_vendas: false,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reset parameters to default when tenant changes
    setParameters({
      enable_descontos_venda: false,
      enable_faturamento_metas: false,
      enable_api_filial_vendas: false,
    })
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
          setParameters({
            enable_descontos_venda: false,
            enable_faturamento_metas: false,
            enable_api_filial_vendas: false,
          })
          return
        }

        // Start with default values
        const params: Record<string, boolean> = {
          enable_descontos_venda: false,
          enable_faturamento_metas: false,
          enable_api_filial_vendas: false,
        }

        // Override with actual values from database
        if (data && data.length > 0) {
          data.forEach((param: TenantParameter) => {
            params[param.parameter_key] = param.parameter_value
          })
        }

        setParameters(params)
      } catch (error) {
        console.error('Error in useTenantParameters:', error)
        setParameters({
          enable_descontos_venda: false,
          enable_faturamento_metas: false,
          enable_api_filial_vendas: false,
        })
      } finally {
        setLoading(false)
      }
    }

    loadParameters()
  }, [tenantId])

  return { parameters, loading }
}
