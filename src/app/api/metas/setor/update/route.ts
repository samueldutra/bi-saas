import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { isValidSchema, validateSchemaAccess } from '@/lib/security/validate-schema'
import { z } from 'zod'

const updateSetorSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  setor_id: z.union([z.string(), z.number()]),
  filial_id: z.union([z.string(), z.number()]),
  data: z.string().min(1),
  meta_percentual: z.number(),
  valor_meta: z.number(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const validation = updateSetorSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema, setor_id, filial_id, data, meta_percentual, valor_meta } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)
    if (authorizedBranches !== null && !authorizedBranches.includes(String(filial_id))) {
      return NextResponse.json(
        { error: 'Usuário não possui acesso à filial solicitada' },
        { status: 403 }
      )
    }

    console.log('[API/METAS/SETOR/UPDATE] Updating meta:', {
      schema,
      setor_id,
      filial_id,
      data,
      meta_percentual,
      valor_meta
    })

    // Atualizar meta usando RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase as any).rpc('update_meta_setor', {
      p_schema: schema,
      p_setor_id: setor_id,
      p_filial_id: filial_id,
      p_data: data,
      p_meta_percentual: meta_percentual,
      p_valor_meta: valor_meta
    }) as { data: { success: boolean; error?: string; message?: string; data?: unknown; calculated?: unknown } | null; error: { message: string; details?: string } | null }

    if (error) {
      console.error('[API/METAS/SETOR/UPDATE] RPC Error:', error)
      return safeErrorResponse(error, 'metas-setor-update')
    }

    // Verificar se a função SQL retornou sucesso
    // A função pode retornar { success: false, error: '...' } sem gerar erro no Supabase
    if (result && result.success === false) {
      console.error('[API/METAS/SETOR/UPDATE] Function returned error:', result)
      return NextResponse.json(
        {
          error: result.error || 'Erro ao atualizar meta',
          success: false
        },
        { status: 400 }
      )
    }

    console.log('[API/METAS/SETOR/UPDATE] Meta updated successfully:', result)

    // Retornar o resultado completo da função (inclui calculated com diferenças)
    return NextResponse.json({
      message: result?.message || 'Meta atualizada com sucesso',
      success: true,
      data: result?.data,
      calculated: result?.calculated
    })

  } catch (error) {
    console.error('[API/METAS/SETOR/UPDATE] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
