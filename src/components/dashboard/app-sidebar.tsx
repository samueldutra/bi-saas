'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileBarChart,
  LucideIcon,
  Package,
  TrendingUp,
  Target,
  ChartBarBig,
  TrendingDown,
  ShoppingCart,
  AlertTriangle,
  Newspaper,
  Radio,
  ChevronRight,
  ChartCandlestick,
} from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTenantContext } from '@/contexts/tenant-context'
import { Badge } from '@/components/ui/badge'
import { NavUser } from './nav-user'
import { SidebarCompanySwitcher } from './sidebar-company-switcher'
import { useTenantParameters } from '@/hooks/use-tenant-parameters'
import { useAuthorizedModules } from '@/hooks/use-authorized-modules'
import type { SystemModule } from '@/types/modules'

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  requiresSuperAdmin?: boolean
  requiresAdminOrAbove?: boolean
  badge?: string
  comingSoon?: boolean
  moduleId?: SystemModule
}

interface NavigationSection {
  title: string
  icon: LucideIcon
  items: NavigationItem[]
}

const visaoGeralNavigation: NavigationItem[] = [
  {
    name: 'Dashboard 360',
    href: '/dashboard',
    icon: LayoutDashboard,
    moduleId: 'dashboard',
  },
  {
    name: 'Dashboard Tempo Real',
    href: '/dashboard-tempo-real',
    icon: Radio,
    moduleId: 'dashboard_tempo_real',
  },
]

const gerencialNavigation: NavigationItem[] = [
  {
    name: 'DRE Gerencial',
    href: '/dre-gerencial',
    icon: ChartBarBig,
    moduleId: 'dre_gerencial',
  },
  {
    name: 'DRE Comparativo',
    href: '/dre-comparativo',
    icon: FileBarChart,
    moduleId: 'dre_comparativo',
  },
  {
    name: 'Descontos de Vendas',
    href: '/descontos-venda',
    icon: TrendingDown,
  },
]

const vendasNavigation: NavigationItem[] = [
  {
    name: 'Vendas por Curva',
    href: '/relatorios/venda-curva',
    icon: ShoppingCart,
    moduleId: 'relatorios_venda_curva',
  },
  {
    name: 'Produtos sem Vendas',
    href: '/relatorios/produtos-sem-vendas',
    icon: ChartCandlestick,
    moduleId: 'relatorios_produtos_sem_vendas',
  },
]

const metasNavigation: NavigationItem[] = [
  {
    name: 'Meta de Vendas Geral',
    href: '/metas/mensal',
    icon: TrendingUp,
    moduleId: 'metas_mensal',
  },
  {
    name: 'Meta de Vendas Setor',
    href: '/metas/setor',
    icon: Target,
    moduleId: 'metas_setor',
  },
]

const rupturaNavigation: NavigationItem[] = [
  {
    name: 'Previsão de Ruptura',
    href: '/relatorios/previsao-ruptura',
    icon: TrendingDown,
    moduleId: 'relatorios_previsao_ruptura',
  },
  {
    name: 'Ruptura ABCD',
    href: '/relatorios/ruptura-abcd',
    icon: AlertTriangle,
    moduleId: 'relatorios_ruptura_abcd',
  },
  {
    name: 'Dias sem Giro',
    href: '/relatorios/ruptura-venda-60d',
    icon: Package,
    moduleId: 'relatorios_ruptura_60d',
  },
]

const perdasNavigation: NavigationItem[] = [
  {
    name: 'Relatório de Perdas',
    href: '/relatorios/perdas',
    icon: Newspaper,
    moduleId: 'relatorios_perdas',
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { userProfile, currentTenant } = useTenantContext()
  const { state } = useSidebar()
  const { parameters } = useTenantParameters(currentTenant?.id)
  const { hasModuleAccess, hasFullAccess } = useAuthorizedModules()
  const isCollapsed = state === 'collapsed'

  const isSuperAdmin = userProfile?.role === 'superadmin'
  const isAdminOrAbove = ['superadmin', 'admin'].includes(userProfile?.role || '')

  // Filter navigation items based on user role, tenant parameters, and authorized modules
  const filterNavigation = (items: NavigationItem[]) => items.filter(item => {
    if (item.requiresSuperAdmin && !isSuperAdmin) {
      return false
    }
    if (item.requiresAdminOrAbove && !isAdminOrAbove) {
      return false
    }
    // Filter "Descontos de Vendas" based on tenant parameter
    if (item.href === '/descontos-venda' && !parameters.enable_descontos_venda) {
      return false
    }
    // Filter based on authorized modules (only for users with role = 'user')
    if (item.moduleId && !hasFullAccess && !hasModuleAccess(item.moduleId)) {
      return false
    }
    return true
  })

  const filteredVisaoGeralNav = filterNavigation(visaoGeralNavigation)
  const filteredGerencialNav = filterNavigation(gerencialNavigation)
  const filteredVendasNav = filterNavigation(vendasNavigation)
  const filteredMetasNav = filterNavigation(metasNavigation)
  const filteredRupturaNav = filterNavigation(rupturaNavigation)
  const filteredPerdasNav = filterNavigation(perdasNavigation)
  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href
    }

    return pathname === href || pathname.startsWith(`${href}/`)
  }
  const navigationSections: NavigationSection[] = [
    {
      title: 'Visão Geral',
      icon: LayoutDashboard,
      items: filteredVisaoGeralNav,
    },
    {
      title: 'Gerencial',
      icon: ChartBarBig,
      items: filteredGerencialNav,
    },
    {
      title: 'Vendas',
      icon: ShoppingCart,
      items: filteredVendasNav,
    },
    {
      title: 'Metas',
      icon: Target,
      items: filteredMetasNav,
    },
    {
      title: 'Ruptura',
      icon: AlertTriangle,
      items: filteredRupturaNav,
    },
    {
      title: 'Perdas',
      icon: Newspaper,
      items: filteredPerdasNav,
    },
  ].filter((section) => section.items.length > 0)

  // Use tenant ID as key to force re-render when tenant changes
  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r border-sidebar-border" key={currentTenant?.id || 'no-tenant'}>
      <SidebarHeader className="items-center gap-3 px-2 py-4">
        <div className={cn('flex w-full', isCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-between gap-3')}>
          <div className={cn(isCollapsed ? 'w-auto' : 'w-[200px] self-start')}>
            <SidebarCompanySwitcher />
          </div>
          <SidebarTrigger className="size-8 shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigationSections.map((section) => {
              const SectionIcon = section.icon

              return (
                <Collapsible
                  key={section.title}
                  asChild
                  defaultOpen
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={section.title}>
                        <SectionIcon />
                        <span>{section.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 dark:text-white" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item) => {
                          const isActive = isItemActive(item.href)
                          const ItemIcon = item.icon
                          const isLiveModule = item.href === '/dashboard-tempo-real'

                          return (
                            <SidebarMenuSubItem key={item.name}>
                              {item.comingSoon ? (
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={false}
                                  className="pointer-events-none opacity-70"
                                >
                                  <div>
                                    <ItemIcon />
                                    <span>{item.name}</span>
                                    <Badge variant="secondary" className="ml-auto text-xs">
                                      Em breve
                                    </Badge>
                                  </div>
                                </SidebarMenuSubButton>
                              ) : (
                                <SidebarMenuSubButton asChild isActive={isActive}>
                                  <Link href={item.href}>
                                    <ItemIcon className={isLiveModule ? 'animate-pulse-live' : undefined} />
                                    <span>{item.name}</span>
                                    {item.badge && (
                                      <Badge variant="secondary" className="ml-auto text-xs">
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User */}
      <SidebarSeparator />
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
