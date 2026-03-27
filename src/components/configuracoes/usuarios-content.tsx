'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Building2, Link2, Pencil, Shield, Trash2, Unlink2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { LinkUsersDialog } from '@/components/configuracoes/link-users-dialog'

type TenantSummary = {
  id: string
  name: string
  slug: string
}

type UserProfile = {
  id: string
  tenant_id: string | null
  full_name: string
  avatar_url: string | null
  role: 'superadmin' | 'admin' | 'user' | 'viewer'
  can_switch_tenants: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  access_type: 'primary' | 'linked' | 'superadmin'
  linked_at: string | null
  primary_tenant: TenantSummary | null
}

interface UsuariosContentProps {
  currentUserRole: string
  currentUserTenantId: string | null
  selectedTenantId: string | null
}

export function UsuariosContent({ currentUserRole, currentUserTenantId, selectedTenantId }: UsuariosContentProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'delete' | 'unlink'>('delete')
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [selectedTenantName, setSelectedTenantName] = useState<string>('')

  const effectiveTenantId = selectedTenantId || currentUserTenantId

  const loadUsers = useCallback(async () => {
    if (!effectiveTenantId) {
      setUsers([])
      setSelectedTenantName('')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/users/by-tenant?tenantId=${effectiveTenantId}`)
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Erro ao carregar usuários')
        setUsers([])
        setSelectedTenantName('')
        return
      }

      setUsers(result.data || [])
      setSelectedTenantName(result.tenant?.name || '')
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      toast.error('Erro inesperado ao carregar usuários')
      setUsers([])
      setSelectedTenantName('')
    } finally {
      setLoading(false)
    }
  }, [effectiveTenantId])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    const handleOpenLinkDialog = () => {
      if (currentUserRole === 'superadmin' && effectiveTenantId) {
        setLinkDialogOpen(true)
      }
    }

    window.addEventListener('openLinkUserDialog', handleOpenLinkDialog)
    return () => {
      window.removeEventListener('openLinkUserDialog', handleOpenLinkDialog)
    }
  }, [currentUserRole, effectiveTenantId])

  // Calculate stats
  const totalUsers = users?.length || 0
  const superAdmins = users?.filter(u => u.role === 'superadmin').length || 0
  const admins = users?.filter(u => u.role === 'admin').length || 0
  const regularUsers = users?.filter(u => u.role === 'user').length || 0
  const activeUsers = users?.filter(u => u.is_active).length || 0

  const getRoleBadge = (role: string) => {
    const variants = {
      superadmin: 'destructive',
      admin: 'default',
      user: 'secondary',
      viewer: 'outline',
    } as const

    const labels = {
      superadmin: 'Super Admin',
      admin: 'Admin',
      user: 'Usuário',
      viewer: 'Visualizador',
    } as const

    return (
      <Badge variant={variants[role as keyof typeof variants] || 'secondary'} className="text-xs">
        {labels[role as keyof typeof labels] || role}
      </Badge>
    )
  }

  const handleDeleteClick = async (user: UserProfile, mode: 'delete' | 'unlink') => {
    setUserToDelete(user)
    setDialogMode(mode)

    if (mode === 'delete') {
      try {
        const response = await fetch(`/api/users/get-email?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          setUserEmail(data.email || 'Email não encontrado')
        } else {
          setUserEmail('Email não encontrado')
        }
      } catch (error) {
        console.error('Error fetching user email:', error)
        setUserEmail('Email não encontrado')
      }
    } else {
      setUserEmail('')
    }

    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete || !effectiveTenantId) return

    setIsDeleting(true)

    try {
      const response = dialogMode === 'delete'
        ? await fetch(`/api/users/delete?userId=${userToDelete.id}`, {
          method: 'DELETE',
        })
        : await fetch(
          `/api/users/tenant-access?userId=${userToDelete.id}&tenantId=${effectiveTenantId}`,
          {
            method: 'DELETE',
          }
        )

      const data = await response.json()

      if (response.ok) {
        toast.success(
          dialogMode === 'delete'
            ? 'Usuário excluído com sucesso'
            : 'Usuário desvinculado do tenant com sucesso'
        )
        setDeleteDialogOpen(false)
        setUserToDelete(null)
        setUserEmail('')
        await loadUsers()
      } else {
        toast.error(
          data.error ||
          (dialogMode === 'delete'
            ? 'Erro ao excluir usuário'
            : 'Erro ao desvincular usuário do tenant')
        )
      }
    } catch (error) {
      console.error('Erro ao executar ação no usuário:', error)
      toast.error(
        dialogMode === 'delete'
          ? 'Erro inesperado ao excluir usuário'
          : 'Erro inesperado ao desvincular usuário'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setUserToDelete(null)
    setUserEmail('')
  }

  const getAccessBadge = (user: UserProfile) => {
    if (user.access_type === 'linked') {
      return (
        <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary">
          <Link2 className="h-2.5 w-2.5" />
          Vinculado
        </Badge>
      )
    }

    if (user.access_type === 'primary') {
      return (
        <Badge variant="outline" className="text-xs">
          Principal
        </Badge>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-muted-foreground">
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-elevated border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Total de Usuários</CardTitle>
            <Users className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-primary">{totalUsers}</div>
            <p className="text-[10px] text-muted-foreground">
              {activeUsers} ativos
            </p>
          </CardContent>
        </Card>

        {currentUserRole === 'superadmin' && (
          <Card className="card-elevated border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Super Admins</CardTitle>
              <Shield className="h-3.5 w-3.5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-destructive">{superAdmins}</div>
              <p className="text-[10px] text-muted-foreground">
                Acesso total
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Admins</CardTitle>
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{admins}</div>
            <p className="text-[10px] text-muted-foreground">
              Gestores da empresa
            </p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Usuários</CardTitle>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{regularUsers}</div>
            <p className="text-[10px] text-muted-foreground">
              Acesso completo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base">Lista de Usuários</CardTitle>
          <CardDescription className="text-xs">
            {currentUserRole === 'superadmin' && selectedTenantId && selectedTenantName ? (
              <>
                Todos os <strong>Superadmins</strong> + usuários com acesso a <strong>{selectedTenantName}</strong>
              </>
            ) : currentUserRole === 'superadmin' ? (
              'Todos os usuários do sistema'
            ) : (
              'Usuários com acesso à sua empresa (superadmins não são exibidos)'
            )}
          </CardDescription>
          <CardDescription className="text-xs">
            Usuários com badge <strong>Vinculado</strong> têm empresa principal em outro tenant. Para role `user`,
            os módulos autorizados continuam globais por usuário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users && users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border border-border rounded-xl hover:bg-accent/50 hover:border-primary/50 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 ring-1 ring-primary/20">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{user.full_name}</h3>
                        {getRoleBadge(user.role)}
                        {getAccessBadge(user)}
                        {!user.is_active && (
                          <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive text-xs">
                            <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {user.primary_tenant && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="font-medium">Empresa principal:</span> {user.primary_tenant.name}
                          </span>
                        )}
                        {!user.primary_tenant && user.role === 'superadmin' && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Shield className="h-2.5 w-2.5" />
                            Todas as empresas
                          </Badge>
                        )}
                        {user.access_type === 'linked' && selectedTenantName && (
                          <span className="text-primary text-[10px]">
                            Acesso adicional em {selectedTenantName}
                          </span>
                        )}
                        {!user.primary_tenant && user.role !== 'superadmin' && (
                          <span className="text-muted-foreground text-[10px]">Sem empresa</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(currentUserRole === 'superadmin' || user.access_type !== 'linked') && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/usuarios/${user.id}/editar?tenantId=${effectiveTenantId}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}

                    {user.access_type === 'linked' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-700 hover:text-amber-700 hover:border-amber-500"
                        onClick={() => handleDeleteClick(user, 'unlink')}
                      >
                        <Unlink2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:border-destructive"
                        onClick={() => handleDeleteClick(user, 'delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-3 text-sm font-semibold">Nenhum usuário cadastrado</h3>
                <p className="text-muted-foreground text-xs mt-2">
                  Comece adicionando usuários ao sistema
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/usuarios/novo">
                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                    Adicionar Usuário
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <LinkUsersDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        tenantId={effectiveTenantId}
        tenantName={selectedTenantName}
        onLinked={loadUsers}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogMode === 'delete' ? 'Confirmar Exclusão' : 'Confirmar Desvinculação'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  {dialogMode === 'delete'
                    ? 'Tem certeza que deseja excluir este usuário?'
                    : 'Tem certeza que deseja remover o acesso deste usuário ao tenant atual?'}
                </div>
                <div className="bg-muted p-3 rounded-lg mt-2">
                  <div className="font-medium text-foreground">{userToDelete?.full_name}</div>
                  {dialogMode === 'delete' ? (
                    <div className="text-sm text-muted-foreground mt-1">
                      {userEmail || 'Carregando email...'}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1">
                      Empresa principal: {userToDelete?.primary_tenant?.name || 'Sem empresa'}
                    </div>
                  )}
                </div>
                {dialogMode === 'delete' ? (
                  <>
                    <div className="text-destructive font-medium mt-3">
                      ⚠️ Esta ação não pode ser desfeita!
                    </div>
                    <div className="text-sm">
                      O usuário será permanentemente removido do sistema e não poderá mais fazer login.
                    </div>
                  </>
                ) : (
                  <div className="text-sm">
                    O usuário continuará existindo no sistema, mas perderá o acesso ao tenant selecionado.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className={
                dialogMode === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }
            >
              {isDeleting
                ? dialogMode === 'delete'
                  ? 'Excluindo...'
                  : 'Desvinculando...'
                : dialogMode === 'delete'
                  ? 'Excluir Usuário'
                  : 'Desvincular Usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
