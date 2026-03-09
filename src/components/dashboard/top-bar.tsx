'use client'

import { ThemeToggle } from './theme-toggle'

export function TopBar() {
  return (
    <div className="flex flex-1 items-center justify-end gap-2">
      <ThemeToggle />
    </div>
  )
}
