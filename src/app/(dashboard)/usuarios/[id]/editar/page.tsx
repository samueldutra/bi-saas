import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserForm } from '@/components/users/user-form'
import type { Database } from '@/types/database.types'
import { hasTenantAccess } from '@/lib/security/tenant-access'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get current user profile
  const { data: currentProfile } = await supabase
    .from('user_profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single() as { data: { role: string; tenant_id: string | null } | null }

  if (!currentProfile) {
    redirect('/dashboard')
  }

  // Only superadmin and admin can edit users
  if (!['superadmin', 'admin'].includes(currentProfile.role)) {
    redirect('/dashboard')
  }

  // Get user to edit
  const { data: userToEdit, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .single() as { data: UserProfile | null; error: Error | null }

  if (error || !userToEdit) {
    redirect('/usuarios')
  }

  // Admin can only edit users from accessible tenants
  if (currentProfile.role === 'admin') {
    const canEdit = await hasTenantAccess(supabase, user.id, userToEdit.tenant_id)
    if (!canEdit) {
      redirect('/usuarios')
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Editar Usuário</h2>
        <p className="text-muted-foreground">
          Atualize os dados do usuário
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
          <CardDescription>
            Edite os dados do usuário. Todos os campos marcados com * são obrigatórios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            user={userToEdit}
            currentUserRole={currentProfile.role}
            currentUserTenantId={currentProfile.tenant_id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
