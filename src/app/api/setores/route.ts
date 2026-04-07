import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateSchemaAccess, isValidSchema } from '@/lib/security/validate-schema'
import { z } from 'zod'
import { createSetorErrorResponse } from '@/app/api/setores/error-response'

// GET - Lista todos os setores
// Parâmetros:
// - schema: Schema do tenant (obrigatório)
// - include_level1: Se true, inclui departamento_ids_nivel_1 mapeados (opcional)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const includeLevel1 = searchParams.get('include_level1') === 'true'

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema é obrigatório' },
        { status: 400 }
      )
    }

    // Validar acesso ao schema
    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Se precisa dos departamento_ids de nível 1, usa a RPC
    if (includeLevel1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        'get_setores_com_nivel1',
        { p_schema: schema }
      )

      if (error) {
        console.error('[API/SETORES] RPC Error:', error)
        return NextResponse.json({ error: 'Erro ao buscar setores' }, { status: 500 })
      }

      return NextResponse.json(data || [])
    }

    // Query padrão sem mapeamento
    const { data, error } = await supabase
      .schema(schema as 'public')
      .from('setores')
      .select('*')
      .order('nome')

    if (error) {
      console.error('[API/SETORES] Error:', error)
      return NextResponse.json({ error: 'Erro ao buscar setores' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/SETORES] Exception:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

const postSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  nome: z.string().min(1, 'Nome obrigatório').max(255, 'Nome muito longo'),
  departamento_nivel: z.number().int().min(1).max(6),
  departamento_ids: z.array(z.number().int().positive()),
})

// POST - Cria um novo setor
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validar dados com Zod
    const validation = postSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema, nome, departamento_nivel, departamento_ids } = validation.data

    // Validar acesso ao schema
    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .schema(schema as 'public')
      .from('setores')
      .insert({
        nome,
        departamento_nivel,
        departamento_ids
      })
      .select()
      .single()

    if (error) {
      console.error('[API/SETORES] Error:', error)
      return createSetorErrorResponse(error, 'Erro ao criar setor')
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/SETORES] Exception:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
