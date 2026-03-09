'use client'

import { Moon, Sun } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/contexts/theme-context'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  const handleCheckedChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  return (
    <label className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sun className={`h-4 w-4 ${!isDark ? 'text-foreground' : ''}`} />
        <Switch
          checked={isDark}
          onCheckedChange={handleCheckedChange}
          aria-label="Alternar tema"
        />
        <Moon className={`h-4 w-4 ${isDark ? 'text-foreground' : ''}`} />
      </div>
      <span className="min-w-14 font-medium">
        {isDark ? 'Escuro' : 'Claro'}
      </span>
    </label>
  )
}
