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
}

export function UserForm({ user, currentUserRole, currentUserTenantId }: UserFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenants, setTenants] = useState<Tenant[]>([])

  // Form fields
  const [email, setEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [role, setRole] = useState<string>(user?.role || 'user')
  const [tenantId, setTenantId] = useState(user?.tenant_id || currentUserTenantId || '')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [authorizedBranches, setAuthorizedBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  // Inicia vazio em ambos os casos - criação e edição
  // Se for edição, carrega do banco via useEffect
  const [authorizedModules, setAuthorizedModules] = useState<SystemModule[]>([])
  const [loadingModules, setLoadingModules] = useState(false)

  // Quando role é superadmin, tenant_id deve ser null
  const shouldShowTenantField = role !== 'superadmin'

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
            setAuthorizedBranches(data.map(item => item.branch_id))
          }
        } catch (error) {
          console.error('Error loading authorized branches:', error)
        } finally {
          setLoadingBranches(false)
        }
      }
    }

    loadAuthorizedBranches()
  }, [user, supabase])

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

        // Update authorized branches
        // First, delete all existing authorized branches
        const { error: deleteError } = await supabase
          .from('user_authorized_branches')
          .delete()
          .eq('user_id', user.id)

        if (deleteError) {
          setError('Erro ao atualizar filiais autorizadas')
          setLoading(false)
          return
        }

        // Then, insert new authorized branches (if any)
        if (authorizedBranches.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (supabase as any)
            .from('user_authorized_branches')
            .insert(
              authorizedBranches.map(branchId => ({
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
          <Label htmlFor="tenant">Empresa *</Label>
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
              Como admin, você só pode criar usuários na sua empresa
            </p>
          )}
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
        <BranchSelector
          tenantId={tenantId}
          value={authorizedBranches}
          onChange={setAuthorizedBranches}
          disabled={loading || loadingBranches}
        />
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
