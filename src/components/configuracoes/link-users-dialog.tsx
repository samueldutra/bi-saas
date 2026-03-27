'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Building2, Link2, Loader2, Search, Shield, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'

type LinkableUser = {
  id: string
  full_name: string
  role: 'admin' | 'user'
  is_active: boolean
  email: string | null
  primary_tenant: {
    id: string
    name: string
    slug: string
  } | null
}

interface LinkUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string | null
  tenantName: string
  onLinked: () => Promise<void>
}

export function LinkUsersDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  onLinked,
}: LinkUsersDialogProps) {
  const [users, setUsers] = useState<LinkableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [linkingUserId, setLinkingUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadLinkableUsers() {
      if (!open || !tenantId) return

      setLoading(true)
      try {
        const response = await fetch(`/api/users/linkable?tenantId=${tenantId}`)
        const result = await response.json()

        if (!response.ok) {
          toast.error(result.error || 'Erro ao carregar usuários disponíveis')
          setUsers([])
          return
        }

        setUsers(result.data || [])
      } catch (error) {
        console.error('Erro ao carregar usuários vinculáveis:', error)
        toast.error('Erro inesperado ao carregar usuários disponíveis')
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    loadLinkableUsers()
  }, [open, tenantId])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return users
    }

    return users.filter((user) => {
      const haystack = [
        user.full_name,
        user.email || '',
        user.primary_tenant?.name || '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [search, users])

  const handleLinkUser = async (userId: string) => {
    if (!tenantId) return

    setLinkingUserId(userId)
    try {
      const response = await fetch('/api/users/tenant-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          tenantId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Erro ao vincular usuário')
        return
      }

      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId))
      toast.success('Usuário vinculado ao tenant com sucesso')
      await onLinked()
    } catch (error) {
      console.error('Erro ao vincular usuário:', error)
      toast.error('Erro inesperado ao vincular usuário')
    } finally {
      setLinkingUserId(null)
    }
  }

  const getRoleBadge = (role: LinkableUser['role']) => {
    const labels = {
      admin: 'Admin',
      user: 'Usuário',
    } as const

    return (
      <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="text-xs">
        {labels[role]}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Vincular Usuários
          </DialogTitle>
          <DialogDescription>
            Selecione usuários já cadastrados em outros tenants para também terem acesso a{' '}
            <strong>{tenantName || 'este tenant'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, email ou empresa principal"
              className="pl-9"
            />
          </div>

          <div className="rounded-xl border">
            <ScrollArea className="h-[360px]">
              <div className="space-y-3 p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando usuários disponíveis...
                  </div>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-xl border border-border p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{user.full_name}</span>
                          {getRoleBadge(user.role)}
                          {!user.is_active && (
                            <Badge variant="outline" className="text-xs text-destructive">
                              Inativo
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {user.email || 'Email não encontrado'}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          Empresa principal:{' '}
                          <span className="font-medium text-foreground/80">
                            {user.primary_tenant?.name || 'Sem empresa'}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleLinkUser(user.id)}
                        disabled={linkingUserId === user.id}
                      >
                        {linkingUserId === user.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Vinculando...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Vincular
                          </>
                        )}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/50" />
                    <div className="mt-3 text-sm font-medium">
                      Nenhum usuário disponível para vínculo
                    </div>
                    <div className="mt-1 max-w-md text-xs text-muted-foreground">
                      Só aparecem aqui usuários `admin` e `user` de outros tenants que ainda não têm acesso
                      ao tenant atual.
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <Shield className="h-3.5 w-3.5" />
              Observação sobre módulos
            </div>
            <div className="mt-1">
              Para usuários com role `user`, os módulos autorizados continuam sendo globais por usuário,
              não por tenant.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
