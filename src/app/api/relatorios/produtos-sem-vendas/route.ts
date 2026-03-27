import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const filiais = searchParams.get('filiais') || 'all'
    const diasSemVendasMin = parseInt(searchParams.get('dias_sem_vendas_min') || '15')
    const diasSemVendasMax = parseInt(searchParams.get('dias_sem_vendas_max') || '90')
    const dataReferencia = searchParams.get('data_referencia') || new Date().toISOString().split('T')[0]
    const curvaAbc = searchParams.get('curva_abc') || 'all'
    const filtroTipo = searchParams.get('filtro_tipo') || 'all'
    const departamentoIds = searchParams.get('departamento_ids') || null
    const produtoIds = searchParams.get('produto_ids') || null
    const produtoBusca = searchParams.get('produto_busca') || null
    const limit = parseInt(searchParams.get('limit') || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!schema) {
      return NextResponse.json(
        { error: 'Parâmetro obrigatório: schema' },
        { status: 400 }
      )
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!filiais || filiais === 'all') {
      return NextResponse.json(
        {
          error: 'Parâmetro inválido: filiais',
          message: 'Selecione uma filial específica para gerar este relatório.'
        },
        { status: 400 }
      )
    }

    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)
    let finalFiliais = filiais

    if (authorizedBranches !== null) {
      const requestedFiliais = filiais.split(',').map((id) => id.trim()).filter(Boolean)
      const allowedFiliais = requestedFiliais.filter((id) => authorizedBranches.includes(id))

      if (allowedFiliais.length === 0) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso às filiais solicitadas' },
          { status: 403 }
        )
      }

      finalFiliais = allowedFiliais.join(',')
    }

    console.log('[API/PRODUTOS-SEM-VENDAS] Params:', {
      schema,
      filiais: finalFiliais,
      diasSemVendasMin,
      diasSemVendasMax,
      dataReferencia,
      curvaAbc,
      filtroTipo,
      departamentoIds,
      produtoIds,
      produtoBusca,
      limit,
      offset
    })

    const { data, error } = await supabase.rpc('get_produtos_sem_vendas', {
      p_schema: schema,
      p_filiais: finalFiliais,
      p_dias_sem_vendas_min: diasSemVendasMin,
      p_dias_sem_vendas_max: diasSemVendasMax,
      p_data_referencia: dataReferencia,
      p_curva_abc: curvaAbc,
      p_filtro_tipo: filtroTipo,
      p_departamento_ids: departamentoIds,
      p_produto_ids: produtoIds,
      p_produto_busca: produtoBusca,
      p_limit: limit,
      p_offset: offset
    } as never)

    if (error) {
      console.error('[API/PRODUTOS-SEM-VENDAS] RPC Error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json(
        { 
          error: 'Erro ao buscar produtos sem vendas', 
          message: error.message,
          details: error.details,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    const resultData = (data || []) as Array<{ total_count?: number; [key: string]: unknown }>
    const totalCount = resultData.length > 0 ? (resultData[0].total_count || 0) : 0
    
    console.log('[API/PRODUTOS-SEM-VENDAS] Success:', {
      count: resultData.length || 0,
      totalCount,
      offset,
      limit
    })

    return NextResponse.json({
      data: resultData,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('[API/PRODUTOS-SEM-VENDAS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
