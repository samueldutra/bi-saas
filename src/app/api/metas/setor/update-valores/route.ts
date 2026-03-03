import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'

export async function POST(req: NextRequest) {
  try {
    const { schema, mes, ano } = await req.json()

    console.log('[API/METAS/SETOR/UPDATE] Request params:', { schema, mes, ano })

    if (!schema || !mes || !ano) {
      return NextResponse.json(
        { error: 'Schema, mês e ano são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
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
