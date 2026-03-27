import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createSchemaRequestSchema = z.object({
  schemaName: z.string()
    .trim()
    .min(1, 'schemaName é obrigatório')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Nome do schema inválido. Use apenas letras minúsculas, números e underscore, começando com letra.'
    ),
})

/**
 * POST /api/admin/create-schema
 *
 * Cria um novo schema PostgreSQL clonando a estrutura do schema okilao.
 * Apenas superadmins podem executar essa ação.
 *
 * Body:
 * - schemaName: Nome do schema a ser criado (apenas letras minúsculas, números e underscore)
 *
 * Retorna:
 * - success: boolean
 * - message: string
 * - details: objeto com contadores de objetos criados
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // 1. Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Verificar se é superadmin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: 'Erro ao verificar perfil do usuário' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Perfil de usuário não encontrado' },
        { status: 404 }
      )
    }

    const userRole = (profile as { role: string }).role
    if (userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Apenas superadmins podem criar schemas' },
        { status: 403 }
      )
    }

    // 3. Obter parâmetros
    const validation = createSchemaRequestSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schemaName } = validation.data

    // 5. Verificar se o nome não é um schema reservado
    const reservedSchemas = [
      'public',
      'pg_catalog',
      'information_schema',
      'pg_toast',
      'pg_temp',
      'graphql_public',
      'supabase_functions',
      'extensions',
      'auth',
      'storage',
      'realtime',
      'vault',
      'pgsodium',
      'pgsodium_masks',
    ]

    if (reservedSchemas.includes(schemaName.toLowerCase())) {
      return NextResponse.json(
        { error: 'Este nome de schema é reservado e não pode ser usado' },
        { status: 400 }
      )
    }

    // 6. Chamar RPC para criar schema (sempre clona de okilao)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc(
      'clone_schema_for_tenant',
      {
        p_target_schema: schemaName,
      }
    )

    if (error) {
      console.error('Erro ao criar schema:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao criar schema' },
        { status: 500 }
      )
    }

    // 7. Verificar resultado da RPC
    if (!data || !data.success) {
      return NextResponse.json(
        { error: data?.error || 'Erro desconhecido ao criar schema' },
        { status: 400 }
      )
    }

    // 8. Retornar sucesso
    return NextResponse.json({
      success: true,
      message: `Schema "${schemaName}" criado com sucesso!`,
      details: {
        schema: data.schema,
        tablesCreated: data.tables_created,
        indexesCreated: data.indexes_created,
        primaryKeysCreated: data.primary_keys_created,
        uniqueConstraintsCreated: data.unique_constraints_created,
        foreignKeysCreated: data.foreign_keys_created,
        materializedViewsCreated: data.materialized_views_created,
        functionsCreated: data.functions_created,
        triggersCreated: data.triggers_created,
      },
    })
  } catch (error) {
    console.error('Erro interno ao criar schema:', error)
    return NextResponse.json(
      { error: 'Erro interno ao criar schema' },
      { status: 500 }
    )
  }
}
