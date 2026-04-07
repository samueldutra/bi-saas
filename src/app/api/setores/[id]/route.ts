import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateSchemaAccess, isValidSchema } from '@/lib/security/validate-schema'
import { z } from 'zod'
import { createSetorErrorResponse } from '@/app/api/setores/error-response'

const putSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  nome: z.string().min(1, 'Nome obrigatório').max(255, 'Nome muito longo'),
  departamento_nivel: z.number().int().min(1).max(6),
  departamento_ids: z.array(z.number().int().positive()),
})

// PUT - Atualiza um setor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = await params

    // Validar dados com Zod
    const validation = putSchema.safeParse(body)
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

    const setorId = Number(id)
    if (!Number.isFinite(setorId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .schema(schema as 'public')
      .from('setores')
      .update({
        nome,
        departamento_nivel,
        departamento_ids,
        updated_at: new Date().toISOString()
      })
      .eq('id', setorId)
      .select()
      .single()

    if (error) {
      console.error('[API/SETORES] Error:', error)
      return createSetorErrorResponse(error, 'Erro ao atualizar setor')
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

// DELETE - Exclui um setor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const { id } = await params

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

    const setorId = Number(id)
    if (!Number.isFinite(setorId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { error } = await supabase
      .schema(schema as 'public')
      .from('setores')
      .delete()
      .eq('id', setorId)

    if (error) {
      console.error('[API/SETORES] Error:', error)
      return NextResponse.json({ error: 'Erro ao excluir setor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API/SETORES] Exception:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
