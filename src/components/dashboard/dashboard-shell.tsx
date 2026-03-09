'use client'

import * as React from 'react'
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import { TopBar } from './top-bar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useTheme } from '@/contexts/theme-context'

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/logo_bussola_dark_mode.svg' : '/logo_bussola.svg'

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "16rem",
        "--sidebar-width-icon": "3.5rem",
      } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="bg-transparent md:rounded-none md:shadow-none">
        <header className="relative flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="pointer-events-none absolute inset-x-0 flex justify-center">
            <Link href="/dashboard" className="pointer-events-auto flex items-center justify-center">
              <img
                src={logoSrc}
                alt="Bússola ByDevIngá"
                style={{ height: '40px', width: 'auto' }}
              />
            </Link>
          </div>
          <div className="flex w-full items-center gap-2 px-2">
            <TopBar />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-background shadow-sm">
          <div className="flex h-full flex-col gap-4 overflow-auto p-4">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
