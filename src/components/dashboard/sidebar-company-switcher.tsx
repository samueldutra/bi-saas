'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTenantContext } from '@/contexts/tenant-context'

export function SidebarCompanySwitcher() {
  const [open, setOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const { currentTenant, accessibleTenants, loading, switchTenant, canSwitchTenants } = useTenantContext()
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === 'collapsed'

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="line-clamp-2 font-medium leading-snug">Carregando...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!currentTenant) {
    return null
  }

  const hasMultipleTenants = accessibleTenants.length > 1
  const canSwitch = canSwitchTenants && hasMultipleTenants

  if (isCollapsed) {
    const initials = currentTenant.name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()

    return (
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#4F46E5]">
        <span className="text-sm font-bold text-white">{initials}</span>
      </div>
    )
  }

  if (!canSwitch) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="line-clamp-2 font-medium leading-snug">{currentTenant.name}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <>
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm" />,
        document.body
      )}

      {switching && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
            <div className="text-center">
              <p className="text-lg font-semibold">Trocando empresa...</p>
              <p className="text-sm text-muted-foreground">Aguarde enquanto carregamos os dados</p>
            </div>
          </div>
        </div>
      )}

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="line-clamp-2 font-medium leading-snug">{currentTenant.name}</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="z-[70] max-h-[400px] w-(--radix-dropdown-menu-trigger-width) min-w-72 overflow-y-auto rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={8}
            >
              <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">
                Empresas
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accessibleTenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
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
                    'gap-3 p-2',
                    tenant.id === currentTenant.id && 'bg-sidebar-accent'
                  )}
                >
                  <div className="flex size-8 items-center justify-center rounded-md border bg-transparent">
                    <Building2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="line-clamp-2 font-medium leading-snug">{tenant.name}</span>
                  </div>
                  <Check
                    className={cn(
                      'size-4',
                      tenant.id === currentTenant.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
