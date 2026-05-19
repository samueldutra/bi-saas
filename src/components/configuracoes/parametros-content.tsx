'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, XCircle, Save } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ParametrosContentProps {
  tenantId: string
}

interface TenantParameter {
  id: string
  tenant_id: string
  parameter_key: string
  parameter_value: boolean
  parameter_numeric_value: number | string | null
  created_at: string
  updated_at: string
}

const MARGEM_PERDA_KEY = 'margem_perda'
const DEFAULT_MARGEM_PERDA = '0.00'

const DEFAULT_BOOLEAN_PARAMETERS: Record<string, boolean> = {
  enable_descontos_venda: false,
  enable_faturamento_metas: false,
  enable_api_filial_vendas: false,
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

function formatMargemPerda(value: unknown): string {
  const parsed = parseNumericParameter(value)
  const boundedValue = Math.min(99.99, Math.max(0, parsed))

  return boundedValue.toFixed(2)
}

function parseMargemPerdaInput(value: string): number | null {
  const normalizedValue = value.trim().replace(',', '.')
  const candidateValue = normalizedValue === '' ? '0' : normalizedValue

  if (!/^\d{1,2}(\.\d{1,2})?$/.test(candidateValue)) {
    return null
  }

  const parsed = Number(candidateValue)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99.99) {
    return null
  }

  return Number(parsed.toFixed(2))
}

export function ParametrosContent({ tenantId }: ParametrosContentProps) {
  const [parameters, setParameters] = useState<Record<string, boolean>>(DEFAULT_BOOLEAN_PARAMETERS)
  const [margemPerda, setMargemPerda] = useState(DEFAULT_MARGEM_PERDA)
  const [margemPerdaError, setMargemPerdaError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setParameters(DEFAULT_BOOLEAN_PARAMETERS)
    setMargemPerda(DEFAULT_MARGEM_PERDA)
    setMargemPerdaError(null)
    setMessage(null)
    loadParameters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const loadParameters = async () => {
    setLoading(true)

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('tenant_parameters')
        .select('*')
        .eq('tenant_id', tenantId)

      if (error) throw error

      if (data && data.length > 0) {
        const params: Record<string, boolean> = { ...DEFAULT_BOOLEAN_PARAMETERS }

        data.forEach((param: TenantParameter) => {
          if (param.parameter_key === MARGEM_PERDA_KEY) {
            setMargemPerda(formatMargemPerda(param.parameter_numeric_value))
            return
          }

          params[param.parameter_key] = param.parameter_value
        })

        setParameters(params)
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

  const updateNumericParameter = async (key: string, value: string) => {
    const parsedValue = parseMargemPerdaInput(value)

    if (parsedValue === null) {
      setMargemPerdaError('Informe uma margem entre 0.00 e 99.99.')
      return
    }

    setUpdating(key)
    setMargemPerdaError(null)

    try {
      const supabase = createClient()

      const { data: existing, error: selectError } = await supabase
        .from('tenant_parameters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('parameter_key', key)
        .maybeSingle()

      if (selectError) throw selectError

      if (existing) {
        const { error } = await supabase
          .from('tenant_parameters')
          // @ts-expect-error - Supabase types not fully compatible
          .update({ parameter_value: false, parameter_numeric_value: parsedValue })
          // @ts-expect-error - Supabase types not fully compatible
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tenant_parameters')
          // @ts-expect-error - Supabase types not fully compatible
          .insert({
            tenant_id: tenantId,
            parameter_key: key,
            parameter_value: false,
            parameter_numeric_value: parsedValue,
          })

        if (error) throw error
      }

      setMargemPerda(formatMargemPerda(parsedValue))

      setMessage({
        type: 'success',
        text: 'Margem de perda atualizada com sucesso!'
      })
    } catch (error) {
      console.error('Error updating numeric parameter:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao atualizar margem de perda'
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleMargemPerdaChange = (value: string) => {
    const normalizedValue = value.replace(',', '.')

    if (/^\d{0,2}(\.\d{0,2})?$/.test(normalizedValue)) {
      setMargemPerda(normalizedValue)
      setMargemPerdaError(null)
    }
  }

  const handleMargemPerdaBlur = () => {
    const parsedValue = parseMargemPerdaInput(margemPerda)

    if (parsedValue !== null) {
      setMargemPerda(formatMargemPerda(parsedValue))
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

        {/* Margem de perda default */}
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-end sm:justify-between sm:space-x-4">
          <div className="flex-1 space-y-1">
            <Label
              htmlFor={MARGEM_PERDA_KEY}
              className="text-base font-medium cursor-pointer"
            >
              Margem de perda default
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando preenchido, informa a margem de perda para fins de cálculo de margem de lucro.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-44">
            <Input
              id={MARGEM_PERDA_KEY}
              inputMode="decimal"
              maxLength={5}
              placeholder={DEFAULT_MARGEM_PERDA}
              value={margemPerda}
              onBlur={handleMargemPerdaBlur}
              onChange={(event) => handleMargemPerdaChange(event.target.value)}
              disabled={updating === MARGEM_PERDA_KEY}
              aria-invalid={margemPerdaError ? true : undefined}
              aria-describedby={margemPerdaError ? 'margem_perda_error' : undefined}
              className="text-right"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => updateNumericParameter(MARGEM_PERDA_KEY, margemPerda)}
              disabled={updating === MARGEM_PERDA_KEY}
            >
              {updating === MARGEM_PERDA_KEY ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
            {margemPerdaError && (
              <p id="margem_perda_error" className="text-sm text-destructive">
                {margemPerdaError}
              </p>
            )}
          </div>
        </div>

        {/* Uso da API /filial/vendas */}
        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="enable_api_filial_vendas"
              className="text-base font-medium cursor-pointer"
            >
              Utiliza API /filial/vendas
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativado, o Dashboard 360 passa a usar as RPCs baseadas em
              `vendas_filiais_snapshot`, que espelha a API `/filial/vendas`, como
              origem dos dados PDV. Quando desativado, o módulo segue usando as
              RPCs legadas baseadas em `vendas_diarias_por_filial`.
            </p>
          </div>
          <Switch
            id="enable_api_filial_vendas"
            checked={parameters.enable_api_filial_vendas}
            onCheckedChange={(checked) => updateParameter('enable_api_filial_vendas', checked)}
            disabled={updating === 'enable_api_filial_vendas'}
          />
        </div>

        {/* Add more parameters here as needed */}
      </CardContent>
    </Card>
  )
}
