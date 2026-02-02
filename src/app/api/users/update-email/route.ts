import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { z } from 'zod'
import { hasTenantAccess } from '@/lib/security/tenant-access'

const updateEmailSchema = z.object({
  userId: z.string().uuid('ID do usuário deve ser um UUID válido'),
  newEmail: z.string().email('Email inválido'),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get current user profile
    const { data: currentProfile } = (await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()) as { data: { role: string; tenant_id: string | null } | null }

    if (!currentProfile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Only superadmin and admin can update user emails
    if (!['superadmin', 'admin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()

    // Validar dados com Zod
    const validation = updateEmailSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { userId, newEmail } = validation.data

    // Get user to update
    const { data: userToUpdate } = (await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', userId)
      .single()) as { data: { tenant_id: string | null } | null }

    if (!userToUpdate) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Admin can only update users from accessible tenants
    if (currentProfile.role === 'admin') {
      const canManage = await hasTenantAccess(supabase, user.id, userToUpdate.tenant_id)
      if (!canManage) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    
    if (existingUser && existingUser.users) {
      const emailExists = existingUser.users.some(
        (u) => u.email === newEmail && u.id !== userId
      )
      
      if (emailExists) {
        return NextResponse.json(
          { error: 'Este email já está em uso' },
          { status: 400 }
        )
      }
    }

    // Update user email using Supabase Admin API
    // IMPORTANTE: Usar email_confirm: true para alteração imediata sem confirmação dupla
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        email_confirm: true // Confirma o email imediatamente, sem processo duplo
      }
    )

    if (updateError) {
      console.error('Error updating user email:', updateError)
      return safeErrorResponse(updateError, 'update-email')
    }

    // Invalidar todas as sessões do usuário para forçar novo login
    try {
      await supabaseAdmin.auth.admin.signOut(userId)
      console.log('Sessões do usuário invalidadas após alteração de email')
    } catch (signOutError) {
      console.error('Erro ao invalidar sessões:', signOutError)
      // Não falhar se não conseguir invalidar sessões
    }

    return NextResponse.json({
      success: true,
      message: 'Email atualizado com sucesso. O usuário precisará fazer login novamente.',
      user: updatedUser,
    })
  } catch (error) {
    console.error('Unexpected error updating email:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao atualizar email' },
      { status: 500 }
    )
  }
}
