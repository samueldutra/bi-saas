import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hasTenantAccess } from '@/lib/security/tenant-access'

/**
 * DELETE /api/users/delete
 *
 * Deleta um usuário do sistema (Auth + Profile)
 * Requer role: admin ou superadmin
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Obter perfil do usuário logado
    const { data: currentUserProfile } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Verificar permissões (apenas admin e superadmin podem deletar usuários)
    if (!['admin', 'superadmin'].includes(currentUserProfile.role)) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Obter ID do usuário a ser deletado
    const { searchParams } = new URL(request.url)
    const userIdToDelete = searchParams.get('userId')

    if (!userIdToDelete) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Não permitir que usuário delete a si mesmo
    if (userIdToDelete === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Obter dados do usuário a ser deletado
    const { data: userToDelete } = await supabase
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', userIdToDelete)
      .single() as { data: { role: string; tenant_id: string | null } | null }

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Regra: Admin não pode deletar superadmin
    if (currentUserProfile.role === 'admin' && userToDelete.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Admins cannot delete superadmins' },
        { status: 403 }
      )
    }

    // Regra: Admin só pode deletar usuários de tenants acessíveis
    if (currentUserProfile.role === 'admin') {
      const canManage = await hasTenantAccess(supabase, user.id, userToDelete.tenant_id)
      if (!canManage) {
        return NextResponse.json(
          { error: 'You can only delete users from accessible tenants' },
          { status: 403 }
        )
      }
    }

    // Criar cliente admin do Supabase (necessário para deletar do auth.users)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not found')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Attempting to delete user:', userIdToDelete)

    // Deletar do auth.users (isso também vai deletar de user_profiles devido ao CASCADE)
    const { data: deleteData, error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
      userIdToDelete
    )

    if (deleteAuthError) {
      console.error('Error deleting user from auth:', deleteAuthError)
      return NextResponse.json(
        { error: `Falha ao deletar usuário: ${deleteAuthError.message}` },
        { status: 500 }
      )
    }

    console.log('User deleted successfully:', deleteData)

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      userId: userIdToDelete
    })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/users/delete:', error)
    return NextResponse.json(
      { error: 'Unexpected error occurred' },
      { status: 500 }
    )
  }
}
