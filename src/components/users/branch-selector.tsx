'use client'

import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

type Option = Record<'value' | 'label', string>

type TenantBranchScope = {
  id: string
  name: string
  isCurrent?: boolean
}

interface BranchSelectorProps {
  tenantId?: string
  tenantScopes?: TenantBranchScope[]
  value: string[] // Array of branch IDs (UUIDs)
  onChange: (branchIds: string[]) => void
  disabled?: boolean
  className?: string
}

export function BranchSelector({
  tenantId,
  tenantScopes,
  value = [],
  onChange,
  disabled = false,
  className,
}: BranchSelectorProps) {
  const [branchOptions, setBranchOptions] = useState<Option[]>([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)

  const normalizedTenantScopes = useMemo(() => {
    if (tenantScopes && tenantScopes.length > 0) {
      return tenantScopes
    }

    if (tenantId) {
      return [{ id: tenantId, name: 'Tenant atual', isCurrent: true }]
    }

    return []
  }, [tenantId, tenantScopes])

  useEffect(() => {
    async function loadBranches() {
      if (normalizedTenantScopes.length === 0) {
        setBranchOptions([])
        return
      }

      setIsLoadingBranches(true)
      try {
        const responses = await Promise.all(
          normalizedTenantScopes.map(async (scope) => {
            const response = await fetch(`/api/branches?tenant_id=${scope.id}`)
            if (!response.ok) {
              throw new Error('Erro ao buscar filiais')
            }

            const result = await response.json() as {
              branches: Array<{
                id: string
                branch_code: string
                store_code?: string
              }>
            }

            return {
              scope,
              branches: result.branches || [],
            }
          })
        )

        const options = responses.flatMap(({ scope, branches }) =>
          branches.map((branch) => {
            const tenantPrefix = scope.isCurrent
              ? `${scope.name} (tenant atual)`
              : scope.name

            const branchLabel = branch.store_code
              ? `Filial ${branch.branch_code} - ${branch.store_code}`
              : `Filial ${branch.branch_code}`

            return {
              value: branch.id,
              label: `${tenantPrefix} • ${branchLabel}`,
            }
          })
        )

        setBranchOptions(options)
      } catch (error) {
        console.error('Erro ao carregar filiais autorizáveis:', error)
        setBranchOptions([])
      } finally {
        setIsLoadingBranches(false)
      }
    }

    loadBranches()
  }, [normalizedTenantScopes])

  const selectedBranches = useMemo(() => {
    if (!value || value.length === 0) return []

    return branchOptions.filter((option) =>
      value.includes(option.value)
    )
  }, [value, branchOptions])

  const handleBranchChange = (newValue: Option[]) => {
    onChange(newValue.map((option) => option.value))
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="authorized-branches">
          Filiais Autorizadas
          <span className="text-xs text-muted-foreground ml-2 font-normal">
            (opcional)
          </span>
        </Label>

        <MultiSelect
          options={branchOptions}
          value={selectedBranches}
          onValueChange={handleBranchChange}
          placeholder={
            isLoadingBranches
              ? 'Carregando filiais...'
              : 'Selecione as filiais autorizadas'
          }
          disabled={disabled || isLoadingBranches}
          variant="default"
        />

        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
            {selectedBranches.length === 0 ? (
              <>
                <strong>Acesso total:</strong> Usuário terá acesso a todas as filiais dos tenants aplicados.
              </>
            ) : (
              <>
                <strong>Acesso restrito:</strong> Usuário terá acesso apenas às {selectedBranches.length} filiai{selectedBranches.length === 1 ? '' : 's'} selecionada{selectedBranches.length === 1 ? '' : 's'}.
              </>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
