'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ParametrosContentProps {
  tenantId: string
}

interface TenantParameter {
  id: string
  tenant_id: string
  parameter_key: string
  parameter_value: boolean
  created_at: string
  updated_at: string
}

export function ParametrosContent({ tenantId }: ParametrosContentProps) {
  const [parameters, setParameters] = useState<Record<string, boolean>>({
    enable_descontos_venda: false,
    enable_faturamento_metas: false,
  })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadParameters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const loadParameters = async () => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('tenant_parameters')
        .select('*')
        .eq('tenant_id', tenantId)

      if (error) throw error

      if (data && data.length > 0) {
        const params: Record<string, boolean> = {}
        data.forEach((param: TenantParameter) => {
          params[param.parameter_key] = param.parameter_value
        })
        setParameters(prev => ({ ...prev, ...params }))
      }
    } catch (error) {
      console.error('Error loading parameters:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar parâmetros'
      })
    } finally {
      setLoading(false)
    }
  }

  const updateParameter = async (key: string, value: boolean) => {
    setUpdating(key)
    try {
      const supabase = createClient()

      // Check if parameter exists
      const { data: existing, error: selectError } = await supabase
        .from('tenant_parameters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('parameter_key', key)
        .maybeSingle()

      if (selectError) throw selectError

      if (existing) {
        // Update existing parameter
        const { error } = await supabase
          .from('tenant_parameters')
          // @ts-expect-error - Supabase types not fully compatible
          .update({ parameter_value: value })
          // @ts-expect-error - Supabase types not fully compatible
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // Insert new parameter
        const { error } = await supabase
          .from('tenant_parameters')
          // @ts-expect-error - Supabase types not fully compatible
          .insert({
            tenant_id: tenantId,
            parameter_key: key,
            parameter_value: value,
          })

        if (error) throw error
      }

      setParameters(prev => ({ ...prev, [key]: value }))

      setMessage({
        type: 'success',
        text: 'Parâmetro atualizado com sucesso!'
      })

      // Reload page to apply changes in navigation
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error('Error updating parameter:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao atualizar parâmetro'
      })
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros do Sistema</CardTitle>
        <CardDescription>
          Configure os módulos e funcionalidades disponíveis para esta empresa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Message Alert */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
        {/* Módulo de Descontos Venda */}
        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="enable_descontos_venda"
              className="text-base font-medium cursor-pointer"
            >
              Utiliza Módulo de Desconto Venda
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativado, o módulo de Descontos Venda ficará disponível no menu Gerencial.
              Ao desativar, o módulo será ocultado e não poderá ser acessado.
            </p>
          </div>
          <Switch
            id="enable_descontos_venda"
            checked={parameters.enable_descontos_venda}
            onCheckedChange={(checked) => updateParameter('enable_descontos_venda', checked)}
            disabled={updating === 'enable_descontos_venda'}
          />
        </div>

        {/* Modo de cálculo de Metas com Faturamento */}
        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="enable_faturamento_metas"
              className="text-base font-medium cursor-pointer"
            >
              Usa vendas Faturamento em METAS
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativado, a geração e atualização de Metas Mensais e Metas por Setor
              passa a considerar vendas da tabela de Faturamento junto com a tabela de Vendas.
              Quando desativado, o comportamento permanece exatamente o atual.
            </p>
          </div>
          <Switch
            id="enable_faturamento_metas"
            checked={parameters.enable_faturamento_metas}
            onCheckedChange={(checked) => updateParameter('enable_faturamento_metas', checked)}
            disabled={updating === 'enable_faturamento_metas'}
          />
        </div>

        {/* Add more parameters here as needed */}
      </CardContent>
    </Card>
  )
}
