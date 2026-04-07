'use client'

import { Plus, Settings } from 'lucide-react'
import { useTenantContext } from '@/contexts/tenant-context'
import { SetoresContent } from '@/components/configuracoes/setores-content'
import { Button } from '@/components/ui/button'

export default function SetoresPage() {
  const { currentTenant } = useTenantContext()

  if (!currentTenant?.supabase_schema) {
    return (
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" />
          Setores
        </h1>
        <p className="text-sm text-muted-foreground">
          Selecione um tenant ativo para gerenciar os setores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Settings className="h-6 w-6" />
            Setores
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os setores e os departamentos associados ao schema atual.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            const event = new CustomEvent('openSetorDialog')
            window.dispatchEvent(event)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Setor
        </Button>
      </div>

      <SetoresContent tenantSchema={currentTenant.supabase_schema} />
    </div>
  )
}
