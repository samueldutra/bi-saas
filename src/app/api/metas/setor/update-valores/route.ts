import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'
import { isValidSchema, validateSchemaAccess } from '@/lib/security/validate-schema'
import { z } from 'zod'

const updateValoresSchema = z.object({
  schema: z.string().min(1, 'Schema é obrigatório').refine(isValidSchema, 'Schema inválido'),
  mes: z.coerce.number().int().min(1, 'Mês inválido').max(12, 'Mês inválido'),
  ano: z.coerce.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido'),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (!profile || !['superadmin', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Apenas admins podem atualizar valores realizados' },
        { status: 403 }
      )
    }

    const validation = updateValoresSchema.safeParse(await req.json())

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Schema, mês e ano são obrigatórios', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { schema, mes, ano } = validation.data

    console.log('[API/METAS/SETOR/UPDATE] Request params:', { schema, mes, ano })

    const hasSchemaAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasSchemaAccess) {
      return NextResponse.json(
        { error: 'Sem permissão para acessar este schema' },
        { status: 403 }
      )
    }

    const useFaturamentoMetas = await isFaturamentoMetasEnabled(schema)
    const rpcName = useFaturamentoMetas
      ? 'atualizar_valores_realizados_todos_setores_com_faturamento'
      : 'atualizar_valores_realizados_todos_setores'

    // Chamar função RPC para atualizar valores realizados de TODOS os setores
    // A função processa todos os setores ativos do schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (supabase.rpc as any)(rpcName, {
      p_schema: schema,
      p_mes: mes,
      p_ano: ano
    })

    if (error && useFaturamentoMetas) {
      console.warn('[API/METAS/SETOR/UPDATE] RPC com faturamento falhou, fallback legado:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (supabase.rpc as any)('atualizar_valores_realizados_todos_setores', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano
      })
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[API/METAS/SETOR/UPDATE] RPC Error:', error)
      return safeErrorResponse(error, 'metas-setor-update-valores')
    }

    console.log('[API/METAS/SETOR/UPDATE] Success:', data)

    return NextResponse.json({ 
      success: true,
      message: 'Valores realizados atualizados com sucesso',
      data 
    })
  } catch (error) {
    console.error('[API/METAS/SETOR/UPDATE] Error:', error)
    return safeErrorResponse(error, 'metas-setor-update-valores')
  }
}
