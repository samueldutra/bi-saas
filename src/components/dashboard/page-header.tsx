'use client'

import Link from 'next/link'
import { House, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface PageHeaderProps {
  section: string
  title: string
  description?: string
  icon?: LucideIcon
  titleClassName?: string
}

export function PageHeader({
  section,
  title,
  description,
  icon: Icon,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Link href="/dashboard" aria-label="Início">
                <House className="size-4" />
                <span className="inline-block">Início</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{section}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="space-y-1">
        <h1 className={cn('flex items-center gap-2 text-2xl font-semibold tracking-tight', titleClassName)}>
          {Icon ? <Icon className="h-6 w-6" /> : null}
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
