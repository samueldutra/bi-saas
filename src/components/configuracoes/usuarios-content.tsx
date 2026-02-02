'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
import { UserPlus, Users, Shield, Pencil, Trash2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'
import type { UserProfile as UP } from '@/types'

type UserProfile = UP & {
  tenants?: Database['public']['Tables']['tenants']['Row'] | null
}

interface UsuariosContentProps {
  currentUserRole: string
  currentUserTenantId: string | null
  selectedTenantId: string | null
}

export function UsuariosContent({ currentUserRole, currentUserTenantId, selectedTenantId }: UsuariosContentProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [selectedTenantName, setSelectedTenantName] = useState<string>('')

  useEffect(() => {
    const loadUsers = async () => {
      const supabase = createClient()

      // Carregar nome do tenant selecionado (se superadmin)
      if (currentUserRole === 'superadmin' && selectedTenantId) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', selectedTenantId)
          .single() as { data: { name: string } | null }
        
        setSelectedTenantName(tenant?.name || '')
      }

      let usersQuery = supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Admin: apenas usuários do tenant selecionado (ou tenant atual) e exclui superadmins
      const adminTenantId = currentUserRole === 'admin'
        ? (selectedTenantId || currentUserTenantId)
        : null

      if (currentUserRole === 'admin' && adminTenantId) {
        usersQuery = usersQuery
          .eq('tenant_id', adminTenantId)
          .neq('role', 'superadmin')
      }
      
      // SuperAdmin: filtra por tenant selecionado
      // - Todos os superadmins (sem filtro de tenant)
      // - Admins e users do tenant selecionado
      if (currentUserRole === 'superadmin' && selectedTenantId) {
        // Não podemos fazer OR direto no Supabase de forma simples
        // Solução: buscar todos e filtrar no client-side
        // OU fazer duas queries e combinar
        
        // Vamos buscar todos e filtrar no client (mais simples)
        // A query não terá filtro aqui, filtraremos após
      }

      const { data: userProfiles } = (await usersQuery) as { data: UP[] | null }

      // Filtro adicional para SuperAdmin com tenant selecionado
      let filteredProfiles = userProfiles || []
      if (currentUserRole === 'superadmin' && selectedTenantId) {
        filteredProfiles = userProfiles?.filter(profile => {
          // Incluir todos os superadmins
          if (profile.role === 'superadmin') return true
          // Incluir admins e users do tenant selecionado
          return profile.tenant_id === selectedTenantId
        }) || []
      }

      // Buscar todos os tenants únicos dos usuários
      const tenantIds = [...new Set(filteredProfiles?.map(u => u.tenant_id).filter(Boolean) as string[])]

      const tenantsMap = new Map()
      if (tenantIds.length > 0) {
        const { data: tenants } = (await supabase
          .from('tenants')
          .select('id, name, slug')
          .in('id', tenantIds)) as { data: { id: string; name: string; slug: string }[] | null }

        tenants?.forEach(tenant => {
          tenantsMap.set(tenant.id, tenant)
        })
      }

      // Combinar users com tenants
      const usersWithTenants: UserProfile[] = filteredProfiles?.map(profile => ({
        ...profile,
        tenants: profile.tenant_id ? tenantsMap.get(profile.tenant_id) : null
      })) || []

      setUsers(usersWithTenants)
      setLoading(false)
    }

    loadUsers()
  }, [currentUserRole, currentUserTenantId, selectedTenantId])

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

  const handleDeleteClick = async (user: UserProfile) => {
    setUserToDelete(user)

    // Buscar o email do usuário
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

    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/users/delete?userId=${userToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Usuário excluído com sucesso')
        setDeleteDialogOpen(false)
        setUserToDelete(null)
        setUserEmail('')

        // Recarregar lista de usuários
        const supabase = createClient()
        let usersQuery = supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false })

        const adminTenantId = currentUserRole === 'admin'
          ? (selectedTenantId || currentUserTenantId)
          : null

        if (currentUserRole === 'admin' && adminTenantId) {
          usersQuery = usersQuery
            .eq('tenant_id', adminTenantId)
            .neq('role', 'superadmin')
        }

        const { data: userProfiles } = (await usersQuery) as { data: UP[] | null }

        // Filtro adicional para SuperAdmin com tenant selecionado
        let filteredProfiles = userProfiles || []
        if (currentUserRole === 'superadmin' && selectedTenantId) {
          filteredProfiles = userProfiles?.filter(profile => {
            if (profile.role === 'superadmin') return true
            return profile.tenant_id === selectedTenantId
          }) || []
        }

        const tenantIds = [...new Set(filteredProfiles?.map(u => u.tenant_id).filter(Boolean) as string[])]
        const tenantsMap = new Map()

        if (tenantIds.length > 0) {
          const { data: tenants } = (await supabase
            .from('tenants')
            .select('id, name, slug')
            .in('id', tenantIds)) as { data: { id: string; name: string; slug: string }[] | null }

          tenants?.forEach(tenant => {
            tenantsMap.set(tenant.id, tenant)
          })
        }

        const usersWithTenants: UserProfile[] = filteredProfiles?.map(profile => ({
          ...profile,
          tenants: profile.tenant_id ? tenantsMap.get(profile.tenant_id) : null
        })) || []

        setUsers(usersWithTenants)
      } else {
        toast.error(data.error || 'Erro ao excluir usuário')
      }
    } catch (error) {
      console.error('Erro ao excluir usuário:', error)
      toast.error('Erro inesperado ao excluir usuário')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setUserToDelete(null)
    setUserEmail('')
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
                Todos os <strong>Superadmins</strong> + Admins e Usuários de <strong>{selectedTenantName}</strong>
              </>
            ) : currentUserRole === 'superadmin' ? (
              'Todos os usuários do sistema'
            ) : (
              'Usuários da sua empresa (superadmins não são exibidos)'
            )}
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
                        {!user.is_active && (
                          <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive text-xs">
                            <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {user.tenants && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="font-medium">Empresa:</span> {user.tenants.name}
                          </span>
                        )}
                        {!user.tenants && user.role === 'superadmin' && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Shield className="h-2.5 w-2.5" />
                            Todas as empresas
                          </Badge>
                        )}
                        {!user.tenants && user.role !== 'superadmin' && (
                          <span className="text-muted-foreground text-[10px]">Sem empresa</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/usuarios/${user.id}/editar`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:border-destructive"
                      onClick={() => handleDeleteClick(user)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>Tem certeza que deseja excluir este usuário?</div>
                <div className="bg-muted p-3 rounded-lg mt-2">
                  <div className="font-medium text-foreground">{userToDelete?.full_name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {userEmail || 'Carregando email...'}
                  </div>
                </div>
                <div className="text-destructive font-medium mt-3">
                  ⚠️ Esta ação não pode ser desfeita!
                </div>
                <div className="text-sm">
                  O usuário será permanentemente removido do sistema e não poderá mais fazer login.
                </div>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir Usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
