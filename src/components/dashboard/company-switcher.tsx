'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useTenantContext } from '@/contexts/tenant-context'

interface CompanySwitcherProps {
  variant?: 'sidebar' | 'topbar'
}

export function CompanySwitcher({ variant = 'sidebar' }: CompanySwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const { currentTenant, accessibleTenants, loading, switchTenant, canSwitchTenants } = useTenantContext()

  const isTopbar = variant === 'topbar'

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    )
  }

  // Overlay de loading durante troca de tenant
  if (switching) {
    return (
      <>
        {/* Overlay full screen */}
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">Trocando empresa...</p>
              <p className="text-sm text-muted-foreground">Aguarde enquanto carregamos os dados</p>
            </div>
          </div>
        </div>
        {/* Componente original (escondido) */}
        <div className="opacity-0">
          <div className="flex items-center px-2 py-2">
            <span className="text-sm font-medium truncate">{currentTenant?.name || '...'}</span>
          </div>
        </div>
      </>
    )
  }

  if (!currentTenant) {
    return null
  }

  // Se não for superadmin ou tiver apenas uma empresa, mostrar badge fixo (sem seletor)
  const hasMultipleTenants = accessibleTenants.length > 1

  if (!canSwitchTenants || !hasMultipleTenants) {
    return (
      <div className={cn(
        "flex items-center min-w-0",
        isTopbar ? "px-3 py-2 rounded-lg bg-muted/50 max-w-[200px] sm:max-w-[280px] md:max-w-none" : "px-2 py-2"
      )}>
        <span className={cn(
          "truncate",
          isTopbar ? "text-lg font-semibold" : "text-sm font-medium"
        )}>
          {currentTenant.name}
        </span>
      </div>
    )
  }

  // Usuário com múltiplas empresas: mostrar selector
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isTopbar ? "ghost" : "outline"}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between",
            isTopbar
              ? "h-9 px-2 gap-1.5 hover:bg-accent min-w-0 max-w-[200px] sm:max-w-[280px] md:max-w-none"
              : "w-full h-auto py-2 px-2"
          )}
        >
          <div className="flex items-center min-w-0">
            <span className={cn(
              "truncate",
              isTopbar ? "text-lg font-semibold" : "text-sm font-medium"
            )}>
              {currentTenant.name}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isTopbar && (
              <Badge variant="secondary" className="text-xs">
                {accessibleTenants.length}
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          isTopbar ? "w-64" : "w-[var(--radix-popover-trigger-width)]"
        )}
        align={isTopbar ? "end" : "start"}
        side={isTopbar ? "bottom" : "top"}
      >
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup heading="Empresas Acessíveis">
              {accessibleTenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.name}
                  disabled={switching}
                  onSelect={async () => {
                    if (tenant.id === currentTenant.id) {
                      setOpen(false)
                      return
                    }

                    setSwitching(true)
                    setOpen(false)
                    await switchTenant(tenant.id)
                    // O switchTenant já faz o redirect, então não precisa setSwitching(false)
                  }}
                >
                  {switching && tenant.id !== currentTenant.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        currentTenant.id === tenant.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  )}
                  <span className="font-medium">{tenant.name}</span>
                  {tenant.id === currentTenant.id && (
                    <Badge variant="secondary" className="ml-auto text-xs">Atual</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
