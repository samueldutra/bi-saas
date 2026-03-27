'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Database } from '@/types/database.types'
import { BranchSelector } from '@/components/users/branch-selector'
import { ModuleSelector } from '@/components/usuarios/module-selector'
import type { SystemModule } from '@/types/modules'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type Tenant = Database['public']['Tables']['tenants']['Row']

interface UserFormProps {
  user?: UserProfile
  currentUserRole: string
  currentUserTenantId: string | null
  currentContextTenantId?: string | null
}

type TenantScope = {
  id: string
  name: string
  isCurrent?: boolean
}

export function UserForm({
  user,
  currentUserRole,
  currentUserTenantId,
  currentContextTenantId,
}: UserFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [branchTenantScopes, setBranchTenantScopes] = useState<TenantScope[]>([])

  // Form fields
  const [email, setEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [role, setRole] = useState<string>(user?.role || 'user')
  const [tenantId, setTenantId] = useState(user?.tenant_id || currentUserTenantId || '')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [authorizedBranches, setAuthorizedBranches] = useState<string[]>([])
  const [hiddenAuthorizedBranches, setHiddenAuthorizedBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  // Inicia vazio em ambos os casos - criação e edição
  // Se for edição, carrega do banco via useEffect
  const [authorizedModules, setAuthorizedModules] = useState<SystemModule[]>([])
  const [loadingModules, setLoadingModules] = useState(false)

  // Quando role é superadmin, tenant_id deve ser null
  const shouldShowTenantField = role !== 'superadmin'
  const branchContextTenantId = currentContextTenantId || currentUserTenantId || tenantId || null

  // Load tenants based on current user role
  useEffect(() => {
    async function loadTenants() {
      if (currentUserRole === 'superadmin') {
        // Superadmin can see all tenants
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .eq('is_active', true)
          .order('name') as { data: Tenant[] | null }

        if (data) {
          setTenants(data)
        }
      } else if (currentUserRole === 'admin' && currentUserTenantId) {
        // Admin only sees their own tenant
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', currentUserTenantId)
          .single() as { data: Tenant | null }

        if (data) {
          setTenants([data])
        }
      }
    }

    loadTenants()
  }, [currentUserRole, currentUserTenantId, supabase])

  // Load user email when editing
  useEffect(() => {
    async function loadUserEmail() {
      if (user) {
        try {
          const response = await fetch(`/api/users/get-email?userId=${user.id}`)
          if (response.ok) {
            const data = await response.json()
            setEmail(data.email || '')
            setOriginalEmail(data.email || '')
          }
        } catch (error) {
          console.error('Error loading user email:', error)
        }
      }
    }

    loadUserEmail()
  }, [user])

  // Load authorized branches when editing
  useEffect(() => {
    async function loadAuthorizedBranches() {
      if (user) {
        setLoadingBranches(true)
        try {
          const { data, error } = await supabase
            .from('user_authorized_branches')
            .select('branch_id')
            .eq('user_id', user.id) as { data: { branch_id: string }[] | null; error: Error | null }

          if (!error && data) {
            const allBranchIds = data.map((item) => item.branch_id)

            if (currentUserRole === 'superadmin' || !branchContextTenantId) {
              setAuthorizedBranches(allBranchIds)
              setHiddenAuthorizedBranches([])
              return
            }

            const visibleResponse = await fetch(`/api/branches?tenant_id=${branchContextTenantId}`)
            if (!visibleResponse.ok) {
              throw new Error('Erro ao carregar filiais visíveis do tenant atual')
            }

            const visibleResult = await visibleResponse.json() as {
              branches: Array<{ id: string }>
            }

            const visibleBranchIds = new Set((visibleResult.branches || []).map((branch) => branch.id))

            setAuthorizedBranches(allBranchIds.filter((branchId) => visibleBranchIds.has(branchId)))
            setHiddenAuthorizedBranches(allBranchIds.filter((branchId) => !visibleBranchIds.has(branchId)))
          }
        } catch (error) {
          console.error('Error loading authorized branches:', error)
          setAuthorizedBranches([])
          setHiddenAuthorizedBranches([])
        } finally {
          setLoadingBranches(false)
        }
      }
    }

    loadAuthorizedBranches()
  }, [branchContextTenantId, currentUserRole, user, supabase])

  // Load authorized modules when editing
  useEffect(() => {
    async function loadAuthorizedModules() {
      if (user) {
        setLoadingModules(true)
        try {
          const response = await fetch(`/api/users/authorized-modules?userId=${user.id}`)
          if (response.ok) {
            const data = await response.json()
            // Se for user, carrega módulos do banco
            // Se for admin/superadmin, carrega todos (para caso mude para user)
            setAuthorizedModules(data.modules || [])
          }
        } catch (error) {
          console.error('Error loading authorized modules:', error)
          setAuthorizedModules([])
        } finally {
          setLoadingModules(false)
        }
      } else {
        // Criação de novo usuário: inicia vazio, usuário deve selecionar
        setAuthorizedModules([])
      }
    }

    loadAuthorizedModules()
  }, [user])

  useEffect(() => {
    async function loadBranchTenantScopes() {
      if (!user) {
        if (tenantId) {
          const currentTenant = tenants.find((tenant) => tenant.id === tenantId)
          setBranchTenantScopes(
            currentTenant
              ? [{ id: currentTenant.id, name: currentTenant.name, isCurrent: true }]
              : []
          )
        } else {
          setBranchTenantScopes([])
        }
        return
      }

      if (currentUserRole !== 'superadmin') {
        const currentTenant = tenants.find((tenant) => tenant.id === branchContextTenantId)
        setBranchTenantScopes(
          currentTenant
            ? [{ id: currentTenant.id, name: currentTenant.name, isCurrent: true }]
            : []
        )
        return
      }

      const tenantMap = new Map<string, TenantScope>()

      if (user.tenant_id) {
        const primaryTenant = tenants.find((tenant) => tenant.id === user.tenant_id)
        if (primaryTenant) {
          tenantMap.set(primaryTenant.id, {
            id: primaryTenant.id,
            name: primaryTenant.name,
          })
        }
      }

      try {
        const response = await fetch(`/api/users/tenant-access?userId=${user.id}`)
        if (response.ok) {
          const result = await response.json()
          const linkedTenants = (result.data || []) as Array<{
            tenant?: { id: string; name: string }
            tenant_id: string
          }>

          linkedTenants.forEach((row) => {
            if (row.tenant?.id) {
              tenantMap.set(row.tenant.id, {
                id: row.tenant.id,
                name: row.tenant.name,
              })
            }
          })
        }
      } catch (fetchError) {
        console.error('Erro ao carregar tenants aplicados do usuário:', fetchError)
      }

      const orderedScopes = Array.from(tenantMap.values()).sort((left, right) => {
        const leftIsCurrent = left.id === currentContextTenantId
        const rightIsCurrent = right.id === currentContextTenantId

        if (leftIsCurrent && !rightIsCurrent) return -1
        if (!leftIsCurrent && rightIsCurrent) return 1
        return left.name.localeCompare(right.name, 'pt-BR')
      }).map((scope) => ({
        ...scope,
        isCurrent: scope.id === currentContextTenantId,
      }))

      if (
        currentContextTenantId &&
        !orderedScopes.some((scope) => scope.id === currentContextTenantId)
      ) {
        const currentTenant = tenants.find((tenant) => tenant.id === currentContextTenantId)
        if (currentTenant) {
          orderedScopes.unshift({
            id: currentTenant.id,
            name: currentTenant.name,
            isCurrent: true,
          })
        }
      }

      setBranchTenantScopes(orderedScopes)
    }

    loadBranchTenantScopes()
  }, [branchContextTenantId, currentContextTenantId, currentUserRole, tenantId, tenants, user])

  // Get available roles based on current user role
  const getAvailableRoles = () => {
    if (currentUserRole === 'superadmin') {
      return [
        { value: 'superadmin', label: 'Super Admin' },
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'Usuário' },
      ]
    } else if (currentUserRole === 'admin') {
      return [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'Usuário' },
      ]
    }
    return []
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!user) {
        // Creating new user
        if (!email || !password) {
          setError('Email e senha são obrigatórios')
          setLoading(false)
          return
        }

        if (password.length < 6) {
          setError('A senha deve ter no mínimo 6 caracteres')
          setLoading(false)
          return
        }

        if (!fullName.trim()) {
          setError('Nome completo é obrigatório')
          setLoading(false)
          return
        }

        // Validate authorized modules for role = user
        if (role === 'user' && authorizedModules.length === 0) {
          setError('Pelo menos um módulo deve ser selecionado para usuários')
          setLoading(false)
          return
        }

        // Call API route to create user (requires admin API)
        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            full_name: fullName.trim(),
            role,
            tenant_id: role === 'superadmin' ? null : tenantId,
            is_active: isActive,
            authorized_branches: authorizedBranches,
            authorized_modules: role === 'user' ? authorizedModules : [],
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          setError(result.error || 'Erro ao criar usuário')
          setLoading(false)
          return
        }

        router.push('/usuarios')
        router.refresh()
      } else {
        // Updating existing user
        if (!fullName.trim()) {
          setError('Nome completo é obrigatório')
          setLoading(false)
          return
        }

        // Validate authorized modules for role = user
        if (role === 'user' && authorizedModules.length === 0) {
          setError('Pelo menos um módulo deve ser selecionado para usuários')
          setLoading(false)
          return
        }

        if (!email.trim()) {
          setError('Email é obrigatório')
          setLoading(false)
          return
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          setError('Email inválido')
          setLoading(false)
          return
        }

        // Check if email changed
        const emailChanged = originalEmail !== email.trim()

        // Update email if changed (using admin API)
        if (emailChanged) {
          const emailResponse = await fetch('/api/users/update-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              newEmail: email.trim(),
            }),
          })

          const emailResult = await emailResponse.json()

          if (!emailResponse.ok) {
            setError(emailResult.error || 'Erro ao atualizar email')
            setLoading(false)
            return
          }
        }

        // Update other user profile fields
        const updateData: Record<string, string | boolean | null> = {
          full_name: fullName.trim(),
          role,
          tenant_id: role === 'superadmin' ? null : tenantId,
          is_active: isActive,
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', user.id)

        if (updateError) {
          setError(updateError.message)
          setLoading(false)
          return
        }

        const branchesToPersist = currentUserRole === 'superadmin'
          ? authorizedBranches
          : Array.from(new Set([...hiddenAuthorizedBranches, ...authorizedBranches]))

        // Update authorized branches
        if (currentUserRole === 'superadmin') {
          const { error: deleteError } = await supabase
            .from('user_authorized_branches')
            .delete()
            .eq('user_id', user.id)

          if (deleteError) {
            setError('Erro ao atualizar filiais autorizadas')
            setLoading(false)
            return
          }
        } else {
          const visibleResponse = await fetch(`/api/branches?tenant_id=${branchContextTenantId}`)
          if (!visibleResponse.ok) {
            setError('Erro ao carregar filiais do tenant atual')
            setLoading(false)
            return
          }

          const visibleResult = await visibleResponse.json() as {
            branches: Array<{ id: string }>
          }

          const visibleBranchIds = (visibleResult.branches || []).map((branch) => branch.id)

          if (visibleBranchIds.length > 0) {
            const { error: deleteError } = await supabase
              .from('user_authorized_branches')
              .delete()
              .eq('user_id', user.id)
              .in('branch_id', visibleBranchIds)

            if (deleteError) {
              setError('Erro ao atualizar filiais autorizadas do tenant atual')
              setLoading(false)
              return
            }
          }
        }

        if (branchesToPersist.length > 0) {
          const branchIdsToInsert = currentUserRole === 'superadmin'
            ? branchesToPersist
            : authorizedBranches

          if (branchIdsToInsert.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insertError } = await (supabase as any)
              .from('user_authorized_branches')
              .insert(
                branchIdsToInsert.map((branchId) => ({
                  user_id: user.id,
                  branch_id: branchId,
                }))
              )

            if (insertError) {
              setError('Erro ao salvar filiais autorizadas')
              setLoading(false)
              return
            }
          }
        }

        // Update authorized modules
        if (role === 'user') {
          // Se role é user, salvar módulos selecionados
          const modulesResponse = await fetch('/api/users/authorized-modules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user.id,
              modules: authorizedModules,
            }),
          })

          if (!modulesResponse.ok) {
            setError('Erro ao atualizar módulos autorizados')
            setLoading(false)
            return
          }
        } else {
          // Se role é admin/superadmin, limpar todos os módulos autorizados
          const modulesResponse = await fetch('/api/users/authorized-modules', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user.id,
            }),
          })

          if (!modulesResponse.ok) {
            console.warn('Erro ao limpar módulos autorizados (não crítico)')
          }
        }

        router.push('/usuarios')
        router.refresh()
      }
    } catch {
      setError('Erro inesperado ao salvar usuário')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!user && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              A senha deve ter no mínimo 6 caracteres
            </p>
          </div>
        </>
      )}

      {user && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Alterar o email do usuário (não requer confirmação)
            </p>
          </div>
          
          {email && originalEmail && email !== originalEmail && (
            <Alert>
              <AlertDescription>
                <p className="font-medium mb-2">⚠️ Importante sobre alteração de email:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>O usuário será desconectado automaticamente</li>
                  <li>O email antigo <strong>não funcionará mais</strong> para login</li>
                  <li>Apenas o novo email poderá ser usado para acessar o sistema</li>
                  <li>A alteração é <strong>imediata</strong> (sem confirmação por email)</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome Completo *</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Nome completo do usuário"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {shouldShowTenantField && (
        <div className="space-y-2">
          <Label htmlFor="tenant">Empresa Principal *</Label>
          <Select value={tenantId} onValueChange={setTenantId} disabled={loading || currentUserRole === 'admin'}>
            <SelectTrigger id="tenant">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUserRole === 'admin' && (
            <p className="text-xs text-muted-foreground">
              Como admin, você só pode criar usuários na sua empresa principal.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A empresa principal define o vínculo base do usuário no cadastro. Em usuários multi-tenant, ela não limita
            sozinha os tenants ou filiais adicionais aos quais o usuário pode receber acesso.
          </p>
        </div>
      )}

      {!shouldShowTenantField && (
        <Alert>
          <AlertDescription>
            Superadmins não são vinculados a uma empresa específica e têm acesso a todas as empresas do sistema.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="role">Perfil *</Label>
        <Select value={role} onValueChange={setRole} disabled={loading}>
          <SelectTrigger id="role">
            <SelectValue placeholder="Selecione o perfil" />
          </SelectTrigger>
          <SelectContent>
            {getAvailableRoles().map((roleOption) => (
              <SelectItem key={roleOption.value} value={roleOption.value}>
                {roleOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {currentUserRole === 'admin'
            ? 'Como admin, você pode criar outros admins, usuários e visualizadores'
            : 'Como superadmin, você pode criar qualquer tipo de usuário'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={isActive ? 'active' : 'inactive'}
          onValueChange={(value) => setIsActive(value === 'active')}
          disabled={loading}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {shouldShowTenantField && tenantId && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Diferença importante:</strong> Empresa Principal é o tenant base do cadastro. Já as Filiais
            Autorizadas controlam em quais filiais o usuário pode operar considerando o tenant atual e também outros
            tenants já aplicados a ele.
          </div>

          <BranchSelector
            tenantId={tenantId}
            tenantScopes={branchTenantScopes}
            value={authorizedBranches}
            onChange={setAuthorizedBranches}
            disabled={loading || loadingBranches}
          />
        </div>
      )}

      {/* Módulos Autorizados */}
      <div className="space-y-2 border-t pt-6">
        {role === 'user' ? (
          <ModuleSelector
            selectedModules={authorizedModules}
            onChange={setAuthorizedModules}
            disabled={loading || loadingModules}
            showFullAccessMessage={false}
          />
        ) : (
          <ModuleSelector
            selectedModules={[]}
            onChange={() => {}}
            disabled={true}
            showFullAccessMessage={true}
          />
        )}
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {user ? 'Atualizar Usuário' : 'Criar Usuário'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
