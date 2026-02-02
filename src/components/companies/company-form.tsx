'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { maskCNPJInput, getCNPJError } from '@/lib/validations/cnpj'
import { maskPhoneInput, getPhoneError } from '@/lib/validations/phone'
import type { Tenant } from '@/types'

interface CompanyFormProps {
  company?: Tenant
  mode: 'create' | 'edit'
}

interface SchemaCreationDetails {
  schema: string
  tablesCreated: number
  indexesCreated: number
  primaryKeysCreated: number
  uniqueConstraintsCreated: number
  foreignKeysCreated: number
  materializedViewsCreated: number
  functionsCreated: number
  triggersCreated: number
}

export function CompanyForm({ company, mode }: CompanyFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState(company?.name || '')
  const [slug, setSlug] = useState(company?.slug || '')
  const [cnpj, setCNPJ] = useState(company?.cnpj || '')
  const [phone, setPhone] = useState(company?.phone || '')
  const [supabaseSchema, setSupabaseSchema] = useState(
    company?.supabase_schema || ''
  )

  // Schema creation state
  const [createSchema, setCreateSchema] = useState(false)
  const [creatingSchema, setCreatingSchema] = useState(false)
  const [schemaProgress, setSchemaProgress] = useState('')
  const [showSchemaAlert, setShowSchemaAlert] = useState(false)
  const [createdSchemaName, setCreatedSchemaName] = useState('')
  const [schemaDetails, setSchemaDetails] =
    useState<SchemaCreationDetails | null>(null)

  // Generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (mode === 'create') {
      const generatedSlug = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generatedSlug)
    }
  }

  const handleCNPJChange = (value: string) => {
    const masked = maskCNPJInput(value)
    setCNPJ(masked)
  }

  const handlePhoneChange = (value: string) => {
    const masked = maskPhoneInput(value)
    setPhone(masked)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validations
    if (!name.trim()) {
      setError('Nome da empresa é obrigatório')
      return
    }

    if (!slug.trim()) {
      setError('Slug é obrigatório')
      return
    }

    if (cnpj) {
      const cnpjError = getCNPJError(cnpj)
      if (cnpjError) {
        setError(cnpjError)
        return
      }
    }

    if (phone) {
      const phoneError = getPhoneError(phone)
      if (phoneError) {
        setError(phoneError)
        return
      }
    }

    // Validate schema name if creating schema
    if (createSchema && supabaseSchema) {
      if (!/^[a-z][a-z0-9_]*$/.test(supabaseSchema)) {
        setError(
          'Nome do schema inválido. Use apenas letras minúsculas, números e underscore, começando com letra.'
        )
        return
      }
    }

    setLoading(true)

    try {
      let schemaCreated = false

      // If user wants to create schema and schema name is provided
      if (mode === 'create' && createSchema && supabaseSchema.trim()) {
        setCreatingSchema(true)
        setSchemaProgress('Criando schema no banco de dados...')

        const response = await fetch('/api/admin/create-schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schemaName: supabaseSchema.trim(),
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          setCreatingSchema(false)
          setError(result.error || 'Erro ao criar schema')
          setLoading(false)
          return
        }

        schemaCreated = true
        setCreatedSchemaName(supabaseSchema.trim())
        setSchemaDetails(result.details)
        setSchemaProgress('Schema criado! Salvando empresa...')
        setCreatingSchema(false)
      }

      if (mode === 'create') {
        // Create new company
        const tenantData: Record<string, string | boolean | null> = {
          name: name.trim(),
          slug: slug.trim(),
          cnpj: cnpj.trim() || null,
          phone: phone.trim() || null,
          supabase_schema: supabaseSchema.trim() || null,
          is_active: true,
        }

        const { error: insertError } = await supabase
          .from('tenants')
          // @ts-expect-error - Supabase type inference limitation
          .insert(tenantData)

        if (insertError) {
          if (insertError.message.includes('duplicate key')) {
            if (insertError.message.includes('slug')) {
              setError('Já existe uma empresa com este slug')
            } else if (insertError.message.includes('cnpj')) {
              setError('Já existe uma empresa com este CNPJ')
            } else if (insertError.message.includes('supabase_schema')) {
              setError('Já existe uma empresa com este schema')
            } else {
              setError('Erro ao criar empresa: dados duplicados')
            }
          } else {
            setError(`Erro ao criar empresa: ${insertError.message}`)
          }
          setLoading(false)
          return
        }

        // If schema was created, show alert modal
        if (schemaCreated) {
          setLoading(false)
          setShowSchemaAlert(true)
        } else {
          router.push('/empresas')
          router.refresh()
        }
      } else {
        // Update existing company
        const updateData: Record<string, string | null> = {
          name: name.trim(),
          slug: slug.trim(),
          cnpj: cnpj.trim() || null,
          phone: phone.trim() || null,
          supabase_schema: supabaseSchema.trim() || null,
        }

        const { error: updateError } = await supabase
          .from('tenants')
          .update(updateData)
          .eq('id', company!.id)

        if (updateError) {
          if (updateError.message.includes('duplicate key')) {
            if (updateError.message.includes('slug')) {
              setError('Já existe uma empresa com este slug')
            } else if (updateError.message.includes('cnpj')) {
              setError('Já existe uma empresa com este CNPJ')
            } else if (updateError.message.includes('supabase_schema')) {
              setError('Já existe uma empresa com este schema')
            } else {
              setError('Erro ao atualizar empresa: dados duplicados')
            }
          } else {
            setError(`Erro ao atualizar empresa: ${updateError.message}`)
          }
          setLoading(false)
          return
        }

        router.push('/empresas')
        router.refresh()
      }
    } catch {
      setError('Erro inesperado ao salvar empresa')
      setLoading(false)
    }
  }

  const handleAlertClose = () => {
    setShowSchemaAlert(false)
    router.push('/empresas')
    router.refresh()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome da Empresa <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Minha Empresa Ltda"
              required
              disabled={loading}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex: minha-empresa"
              required
              disabled={loading}
              pattern="[a-z0-9-]+"
              title="Apenas letras minúsculas, números e hífens"
            />
            <p className="text-xs text-muted-foreground">
              Identificador único (apenas letras minúsculas, números e hífens)
            </p>
          </div>

          {/* CNPJ */}
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={(e) => handleCNPJChange(e.target.value)}
              placeholder="00.000.000/0000-00"
              disabled={loading}
              maxLength={18}
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(11) 98765-4321"
              disabled={loading}
              maxLength={15}
            />
          </div>

          {/* Schema Supabase */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="supabase_schema">Schema Supabase</Label>
            <Input
              id="supabase_schema"
              value={supabaseSchema}
              onChange={(e) => setSupabaseSchema(e.target.value)}
              placeholder="Ex: empresa_dados"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Nome do schema no Supabase onde estão os dados financeiros desta
              empresa
            </p>
          </div>

          {/* Checkbox para criar schema automaticamente */}
          {supabaseSchema.trim() && mode === 'create' && (
            <div className="md:col-span-2 flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Checkbox
                id="createSchema"
                checked={createSchema}
                onCheckedChange={(checked) =>
                  setCreateSchema(checked as boolean)
                }
                disabled={loading}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="createSchema"
                  className="text-sm font-medium cursor-pointer"
                >
                  Criar schema automaticamente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Clona a estrutura completa do schema okilao (tabelas, índices,
                  triggers, functions, materialized views e dados de
                  referência).
                </p>
              </div>
            </div>
          )}

          {/* Progresso da criação do schema */}
          {creatingSchema && (
            <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {schemaProgress}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/empresas')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Criar Empresa' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>

      {/* Modal de alerta após criação do schema */}
      <AlertDialog open={showSchemaAlert} onOpenChange={setShowSchemaAlert}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Schema criado com sucesso!
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  O schema{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                    {createdSchemaName}
                  </code>{' '}
                  foi criado com todas as tabelas, índices e configurações.
                </p>

                {schemaDetails && (
                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                    <div>Tabelas: {schemaDetails.tablesCreated}</div>
                    <div>Índices: {schemaDetails.indexesCreated}</div>
                    <div>Primary Keys: {schemaDetails.primaryKeysCreated}</div>
                    <div>Foreign Keys: {schemaDetails.foreignKeysCreated}</div>
                    <div>Functions: {schemaDetails.functionsCreated}</div>
                    <div>Triggers: {schemaDetails.triggersCreated}</div>
                    <div>MVs: {schemaDetails.materializedViewsCreated}</div>
                    <div>Unique: {schemaDetails.uniqueConstraintsCreated}</div>
                  </div>
                )}

                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Ação manual necessária
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                    Para o schema funcionar, você precisa adicioná-lo aos{' '}
                    <strong>Exposed schemas</strong> no Supabase Dashboard:
                  </p>
                  <ol className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-decimal list-inside space-y-1">
                    <li>
                      Acesse o Supabase Dashboard → <strong>Settings</strong> →{' '}
                      <strong>API</strong>
                    </li>
                    <li>
                      No campo &quot;Exposed schemas&quot;, adicione:{' '}
                      <code className="bg-amber-200 dark:bg-amber-900 px-1 rounded">
                        {createdSchemaName}
                      </code>
                    </li>
                    <li>Salve e aguarde 1-2 minutos para propagar</li>
                  </ol>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleAlertClose}>
              Entendi, ir para empresas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
