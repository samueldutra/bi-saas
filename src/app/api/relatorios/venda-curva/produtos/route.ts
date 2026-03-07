import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

interface ProdutoRow {
  dept_nivel3: string
  dept_nivel2: string
  dept_nivel1: string
  produto_codigo: number
  produto_descricao: string
  filial_id: number
  qtde: string | number
  valor_vendas: string | number
  valor_lucro: string | number
  percentual_lucro: string | number
  curva_venda: string
  curva_lucro: string
  qtde_ano_anterior?: string | number
  valor_vendas_ano_anterior?: string | number
  valor_lucro_ano_anterior?: string | number
  percentual_lucro_ano_anterior?: string | number
}

type TipoBusca = 'departamento' | 'setor' | 'produto'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const schema = searchParams.get('schema')
    if (!schema) {
      return NextResponse.json({ error: 'Schema não informado' }, { status: 400 })
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth()))
    const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
    const requestedFilialId = searchParams.get('filial_id') || null
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '50')
    const compareAnoAnterior = searchParams.get('compare_ano_anterior') === '1'
    const dept3 = searchParams.get('dept3') || ''
    const dept2 = searchParams.get('dept2') || ''
    const dept1 = searchParams.get('dept1') || ''
    const tipoBusca = (searchParams.get('tipo_busca') as TipoBusca | null) || 'departamento'
    const departamentoIds = searchParams.get('departamento_ids')
    const setorIds = searchParams.get('setor_ids')
    const busca = searchParams.get('busca')

    if (!requestedFilialId) {
      return NextResponse.json({ error: 'Filial é obrigatória' }, { status: 400 })
    }

    if (!dept3 || !dept2 || !dept1) {
      return NextResponse.json({ error: 'Depto 3/2/1 são obrigatórios' }, { status: 400 })
    }

    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)
    let finalFilialIds: number[] = []

    if (authorizedBranches === null) {
      const ids = requestedFilialId.split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id))

      if (ids.length === 0) {
        return NextResponse.json({ error: 'Filial específica é obrigatória para este relatório' }, { status: 400 })
      }
      finalFilialIds = ids
    } else {
      const requestedIds = requestedFilialId.split(',').map(id => id.trim())
      const authorizedIds = requestedIds.filter(id => authorizedBranches.includes(id))

      if (authorizedIds.length === 0) {
        return NextResponse.json({
          error: 'Você não tem permissão para acessar as filiais solicitadas',
          authorized_filiais: authorizedBranches
        }, { status: 403 })
      }

      finalFilialIds = authorizedIds.map(id => parseInt(id, 10))
    }

    if (isNaN(mes) || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })
    }

    if (isNaN(ano) || ano < 2000 || ano > 2100) {
      return NextResponse.json({ error: 'Ano inválido' }, { status: 400 })
    }

    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Página inválida' }, { status: 400 })
    }

    if (isNaN(pageSize) || pageSize < 1 || pageSize > 10000) {
      return NextResponse.json({ error: 'Tamanho de página inválido' }, { status: 400 })
    }

    const departamentoIdsArray = departamentoIds
      ? departamentoIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
      : null
    const setorIdsArray = setorIds
      ? setorIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
      : null

    const now = new Date()
    const isMesAtual = now.getMonth() + 1 === mes && now.getFullYear() === ano
    const dataFimOverride = compareAnoAnterior && isMesAtual
      ? now.toISOString().slice(0, 10)
      : null

    const searchValue = tipoBusca === 'produto' && busca?.trim() ? `%${busca.trim()}%` : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_venda_curva_produtos', {
      p_schema: schema,
      p_mes: mes,
      p_ano: ano,
      p_filial_ids: finalFilialIds,
      p_dept_nivel3: dept3,
      p_dept_nivel2: dept2,
      p_dept_nivel1: dept1,
      p_page: page,
      p_page_size: pageSize,
      p_data_fim_override: dataFimOverride,
      p_departamento_ids: departamentoIdsArray,
      p_setor_ids: setorIdsArray,
      p_search: searchValue,
    })

    if (error) {
      console.error('[Venda Curva Produtos] RPC error:', error)
      return NextResponse.json({ error: error.message || 'Erro ao buscar dados' }, { status: 500 })
    }

    const rows = (data || []) as ProdutoRow[]
    return NextResponse.json({
      page,
      page_size: pageSize,
      items: rows.map((row) => ({
        codigo: row.produto_codigo,
        descricao: row.produto_descricao,
        filial_id: row.filial_id,
        qtde: typeof row.qtde === 'string' ? parseFloat(row.qtde || '0') : (row.qtde || 0),
        qtde_ano_anterior: typeof row.qtde_ano_anterior === 'string' ? parseFloat(row.qtde_ano_anterior || '0') : (row.qtde_ano_anterior || 0),
        valor_vendas: typeof row.valor_vendas === 'string' ? parseFloat(row.valor_vendas || '0') : (row.valor_vendas || 0),
        valor_vendas_ano_anterior: typeof row.valor_vendas_ano_anterior === 'string' ? parseFloat(row.valor_vendas_ano_anterior || '0') : (row.valor_vendas_ano_anterior || 0),
        valor_lucro: typeof row.valor_lucro === 'string' ? parseFloat(row.valor_lucro || '0') : (row.valor_lucro || 0),
        valor_lucro_ano_anterior: typeof row.valor_lucro_ano_anterior === 'string' ? parseFloat(row.valor_lucro_ano_anterior || '0') : (row.valor_lucro_ano_anterior || 0),
        percentual_lucro: typeof row.percentual_lucro === 'string' ? parseFloat(row.percentual_lucro || '0') : (row.percentual_lucro || 0),
        percentual_lucro_ano_anterior: typeof row.percentual_lucro_ano_anterior === 'string' ? parseFloat(row.percentual_lucro_ano_anterior || '0') : (row.percentual_lucro_ano_anterior || 0),
        curva_venda: row.curva_venda,
        curva_lucro: row.curva_lucro,
      })),
      has_more: rows.length === pageSize,
    })
  } catch (error) {
    console.error('[Venda Curva Produtos] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao buscar produtos' },
      { status: 500 }
    )
  }
}
