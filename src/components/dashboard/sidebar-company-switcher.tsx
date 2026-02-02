'use client'

import * as React from 'react'
import { Check, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useTenantContext } from '@/contexts/tenant-context'
import { useSidebar } from '@/components/ui/sidebar'

export function SidebarCompanySwitcher() {
  const [open, setOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const { currentTenant, accessibleTenants, loading, switchTenant, canSwitchTenants } = useTenantContext()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-10 rounded-xl bg-[#A368FB]">
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      </div>
    )
  }

  if (!currentTenant) return null

  const hasMultipleTenants = accessibleTenants.length > 1
  const canSwitch = canSwitchTenants && hasMultipleTenants

  // Filter tenants based on search query
  const filteredTenants = accessibleTenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Collapsed state: show initials
  if (isCollapsed) {
    const initials = currentTenant.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()

    return (
      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#A368FB] mx-auto">
        <span className="text-sm font-bold text-white">{initials}</span>
      </div>
    )
  }

  // No switch option: display name only
  if (!canSwitch) {
    return (
      <div className="flex items-center h-10 px-3 rounded-xl bg-[#A368FB]">
        <span className="text-sm font-medium text-white truncate">
          {currentTenant.name}
        </span>
      </div>
    )
  }

  // Full version with selector
  return (
    <>
      {switching && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-[#A368FB]" />
            <div className="text-center">
              <p className="text-lg font-semibold">Trocando empresa...</p>
              <p className="text-sm text-muted-foreground">Aguarde enquanto carregamos os dados</p>
            </div>
          </div>
        </div>
      )}

      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) setSearchQuery('')
      }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full h-10 px-3 flex items-center justify-between rounded-xl bg-[#A368FB] hover:bg-[#8B4FE8] text-white transition-colors cursor-pointer"
          >
            <span className="text-sm font-medium truncate">
              {currentTenant.name}
            </span>
            <div className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full bg-white transition-transform",
              open && "rotate-180"
            )}>
              <ChevronUp className="h-4 w-4 text-[#A368FB]" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 border-0 rounded-xl overflow-hidden shadow-lg"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="bg-[#A368FB] rounded-xl overflow-hidden">
            {/* Search input */}
            <div className="px-3 py-2.5 border-b border-white/20">
              <input
                type="text"
                placeholder="Pesquisa por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white/70 placeholder:text-white/50 text-sm outline-none"
              />
            </div>

            {/* Company list */}
            <div className="max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full">
              {filteredTenants.length === 0 ? (
                <div className="px-3 py-2 text-sm text-white/70">
                  Nenhuma empresa encontrada.
                </div>
              ) : (
                filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    disabled={switching}
                    onClick={async () => {
                      if (tenant.id === currentTenant.id) {
                        setOpen(false)
                        return
                      }
                      setSwitching(true)
                      setOpen(false)
                      await switchTenant(tenant.id)
                    }}
                    className={cn(
                      "w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/10 transition-colors disabled:opacity-50",
                      tenant.id === currentTenant.id && "bg-white/10"
                    )}
                  >
                    <span className={cn(
                      "text-sm truncate",
                      tenant.id === currentTenant.id ? "text-white font-medium" : "text-white/80"
                    )}>
                      {tenant.name}
                    </span>
                    {tenant.id === currentTenant.id && (
                      <Check className="h-4 w-4 text-white shrink-0 ml-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
