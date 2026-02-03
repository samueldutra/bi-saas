import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

interface TotaisRow {
  dept_nivel3: string
  dept_nivel2: string
  dept_nivel1: string
  total_vendas: string | number
  total_lucro: string | number
  percentual_lucro: string | number
  total_vendas_ano_anterior: string | number
  total_lucro_ano_anterior: string | number
  percentual_lucro_ano_anterior: string | number
}

interface DepartamentoNivel1 {
  nome: string
  nivel: number
  valor_vendido: number
  lucro_total: number
  percentual_lucro: number
  valor_vendido_ano_anterior: number
  lucro_total_ano_anterior: number
  percentual_lucro_ano_anterior: number
  produtos: []
}

interface DepartamentoNivel2 {
  nome: string
  nivel: number
  valor_vendido: number
  lucro_total: number
  percentual_lucro: number
  valor_vendido_ano_anterior: number
  lucro_total_ano_anterior: number
  percentual_lucro_ano_anterior: number
  filhos: Record<string, DepartamentoNivel1>
}

interface DepartamentoNivel3 {
  nome: string
  nivel: number
  valor_vendido: number
  lucro_total: number
  percentual_lucro: number
  valor_vendido_ano_anterior: number
  lucro_total_ano_anterior: number
  percentual_lucro_ano_anterior: number
  filhos: Record<string, DepartamentoNivel2>
}

interface Hierarquia {
  [key: string]: DepartamentoNivel3
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function organizeHierarchyTotais(rows: TotaisRow[]): Hierarquia {
  const hierarquia: Hierarquia = {}

  for (const row of rows) {
    const dept3 = row.dept_nivel3
    const dept2 = row.dept_nivel2
    const dept1 = row.dept_nivel1

    if (!hierarquia[dept3]) {
      hierarquia[dept3] = {
        nome: dept3,
        nivel: 3,
        valor_vendido: 0,
        lucro_total: 0,
        percentual_lucro: 0,
        valor_vendido_ano_anterior: 0,
        lucro_total_ano_anterior: 0,
        percentual_lucro_ano_anterior: 0,
        filhos: {},
      }
    }

    if (!hierarquia[dept3].filhos[dept2]) {
      hierarquia[dept3].filhos[dept2] = {
        nome: dept2,
        nivel: 2,
        valor_vendido: 0,
        lucro_total: 0,
        percentual_lucro: 0,
        valor_vendido_ano_anterior: 0,
        lucro_total_ano_anterior: 0,
        percentual_lucro_ano_anterior: 0,
        filhos: {},
      }
    }

    if (!hierarquia[dept3].filhos[dept2].filhos[dept1]) {
      hierarquia[dept3].filhos[dept2].filhos[dept1] = {
        nome: dept1,
        nivel: 1,
        valor_vendido: 0,
        lucro_total: 0,
        percentual_lucro: 0,
        valor_vendido_ano_anterior: 0,
        lucro_total_ano_anterior: 0,
        percentual_lucro_ano_anterior: 0,
        produtos: [],
      }
    }

    const vendas = typeof row.total_vendas === 'string' ? parseFloat(row.total_vendas || '0') : (row.total_vendas || 0)
    const lucro = typeof row.total_lucro === 'string' ? parseFloat(row.total_lucro || '0') : (row.total_lucro || 0)
    const vendasPrev = typeof row.total_vendas_ano_anterior === 'string' ? parseFloat(row.total_vendas_ano_anterior || '0') : (row.total_vendas_ano_anterior || 0)
    const lucroPrev = typeof row.total_lucro_ano_anterior === 'string' ? parseFloat(row.total_lucro_ano_anterior || '0') : (row.total_lucro_ano_anterior || 0)

    const dept1Ref = hierarquia[dept3].filhos[dept2].filhos[dept1]
    dept1Ref.valor_vendido += vendas
    dept1Ref.lucro_total += lucro
    dept1Ref.valor_vendido_ano_anterior += vendasPrev
    dept1Ref.lucro_total_ano_anterior += lucroPrev
  }

  for (const dept3 of Object.values(hierarquia)) {
    for (const dept2 of Object.values(dept3.filhos)) {
      for (const dept1 of Object.values(dept2.filhos)) {
        dept2.valor_vendido += dept1.valor_vendido
        dept2.lucro_total += dept1.lucro_total
        dept2.valor_vendido_ano_anterior += dept1.valor_vendido_ano_anterior
        dept2.lucro_total_ano_anterior += dept1.lucro_total_ano_anterior
      }

      if (dept2.valor_vendido > 0) {
        dept2.percentual_lucro = (dept2.lucro_total / dept2.valor_vendido) * 100
      }
      if (dept2.valor_vendido_ano_anterior > 0) {
        dept2.percentual_lucro_ano_anterior = (dept2.lucro_total_ano_anterior / dept2.valor_vendido_ano_anterior) * 100
      }

      dept3.valor_vendido += dept2.valor_vendido
      dept3.lucro_total += dept2.lucro_total
      dept3.valor_vendido_ano_anterior += dept2.valor_vendido_ano_anterior
      dept3.lucro_total_ano_anterior += dept2.lucro_total_ano_anterior
    }

    if (dept3.valor_vendido > 0) {
      dept3.percentual_lucro = (dept3.lucro_total / dept3.valor_vendido) * 100
    }
    if (dept3.valor_vendido_ano_anterior > 0) {
      dept3.percentual_lucro_ano_anterior = (dept3.lucro_total_ano_anterior / dept3.valor_vendido_ano_anterior) * 100
    }
  }

  return hierarquia
}

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

    if (!requestedFilialId) {
      return NextResponse.json({ error: 'Filial é obrigatória' }, { status: 400 })
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

    const now = new Date()
    const isMesAtual = now.getMonth() + 1 === mes && now.getFullYear() === ano
    const dataFimOverride = compareAnoAnterior && isMesAtual
      ? now.toISOString().slice(0, 10)
      : null

    const rpcClient = supabase as unknown as {
      rpc: (fn: string, params: Record<string, unknown>) => Promise<{
        data: unknown
        error: { message?: string } | null
      }>
    }

    const fetchTotais = async (filiais: number[]) => {
      const { data, error } = await rpcClient.rpc('get_venda_curva_totais', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano,
        p_filial_ids: filiais,
        p_page: 1,
        p_page_size: 10000,
        p_data_fim_override: dataFimOverride,
      })

      if (error) {
        throw error
      }
      return (data || []) as TotaisRow[]
    }

    let rows: TotaisRow[] = []
    if (finalFilialIds.length === 1) {
      const { data, error } = await rpcClient.rpc('get_venda_curva_totais', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano,
        p_filial_ids: finalFilialIds,
        p_page: page,
        p_page_size: pageSize,
        p_data_fim_override: dataFimOverride,
      })

      if (error) {
        console.error('[Venda Curva Totais] RPC error:', error)
        return NextResponse.json({ error: error.message || 'Erro ao buscar dados' }, { status: 500 })
      }
      rows = (data || []) as TotaisRow[]
    } else {
      try {
        for (const filialId of finalFilialIds) {
          const result = await fetchTotais([filialId])
          rows.push(...result)
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        console.error('[Venda Curva Totais] RPC error:', err)
        return NextResponse.json({ error: err?.message || 'Erro ao buscar dados' }, { status: 500 })
      }
    }
    if (rows.length === 0) {
      return NextResponse.json({
        total_records: 0,
        page: 1,
        page_size: pageSize,
        total_pages: 0,
        hierarquia: []
      })
    }

    const hierarquiaObj = organizeHierarchyTotais(rows)
    let hierarquiaArray = Object.values(hierarquiaObj)
      .map((dept3) => ({
        dept3_id: hashCode(dept3.nome),
        dept_nivel3: dept3.nome,
        total_vendas: dept3.valor_vendido,
        total_lucro: dept3.lucro_total,
        margem: dept3.percentual_lucro,
        total_vendas_ano_anterior: dept3.valor_vendido_ano_anterior,
        total_lucro_ano_anterior: dept3.lucro_total_ano_anterior,
        margem_ano_anterior: dept3.percentual_lucro_ano_anterior,
        nivel2: Object.values(dept3.filhos)
          .map((dept2) => ({
            dept2_id: hashCode(dept2.nome),
            dept_nivel2: dept2.nome,
            total_vendas: dept2.valor_vendido,
            total_lucro: dept2.lucro_total,
            margem: dept2.percentual_lucro,
            total_vendas_ano_anterior: dept2.valor_vendido_ano_anterior,
            total_lucro_ano_anterior: dept2.lucro_total_ano_anterior,
            margem_ano_anterior: dept2.percentual_lucro_ano_anterior,
            nivel1: Object.values(dept2.filhos)
              .map((dept1) => ({
                dept1_id: hashCode(dept1.nome),
                dept_nivel1: dept1.nome,
                total_vendas: dept1.valor_vendido,
                total_lucro: dept1.lucro_total,
                margem: dept1.percentual_lucro,
                total_vendas_ano_anterior: dept1.valor_vendido_ano_anterior,
                total_lucro_ano_anterior: dept1.lucro_total_ano_anterior,
                margem_ano_anterior: dept1.percentual_lucro_ano_anterior,
                produtos: [],
              }))
              .sort((a, b) => b.total_vendas - a.total_vendas)
          }))
          .sort((a, b) => b.total_vendas - a.total_vendas)
      }))
      .sort((a, b) => b.total_vendas - a.total_vendas)

    if (finalFilialIds.length > 1) {
      const start = (page - 1) * pageSize
      const end = start + pageSize
      hierarquiaArray = hierarquiaArray.slice(start, end)
    }

    return NextResponse.json({
      total_records: Object.keys(hierarquiaObj).length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(Object.keys(hierarquiaObj).length / pageSize),
      hierarquia: hierarquiaArray
    })
  } catch (error) {
    console.error('[Venda Curva Totais] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao buscar relatório' },
      { status: 500 }
    )
  }
}
