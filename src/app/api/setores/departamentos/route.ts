import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// GET - Lista departamentos de um nível específico
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
    const nivel = searchParams.get('nivel')
    const includeParents = searchParams.get('include_parents') === 'true'

    if (!schema || !nivel) {
      return NextResponse.json(
        { error: 'Schema e nível são obrigatórios' },
        { status: 400 }
      )
    }

    const nivelNumero = Number(nivel)
    if (!Number.isInteger(nivelNumero) || nivelNumero < 1 || nivelNumero > 6) {
      return NextResponse.json(
        { error: 'Nível inválido. Use um valor entre 1 e 6.' },
        { status: 400 }
      )
    }

    // Validar acesso ao schema
    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tableName = `departments_level_${nivelNumero}`
    const columns = includeParents && nivelNumero === 1
      ? 'id, departamento_id, descricao, pai_level_2_id, pai_level_3_id, pai_level_4_id, pai_level_5_id, pai_level_6_id'
      : 'id, departamento_id, descricao'

    const { data, error } = await supabase
      .schema(schema as 'public')
      .from(tableName)
      .select(columns)
      .order('descricao')

    if (error) {
      console.error('[API/SETORES/DEPARTAMENTOS] Error:', error)
      return NextResponse.json({ error: 'Erro ao buscar departamentos' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/SETORES/DEPARTAMENTOS] Exception:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
