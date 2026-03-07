import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// Types
interface Produto {
  codigo: number
  nome: string
  filial_id: number
  quantidade_vendida: number
  quantidade_vendida_ano_anterior: number
  valor_vendido: number
  lucro_total: number
  percentual_lucro: number
  valor_vendido_ano_anterior: number
  lucro_total_ano_anterior: number
  percentual_lucro_ano_anterior: number
  curva_venda: string
  curva_lucro: string
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
  produtos: Produto[]
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

interface RowData {
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

type PrevYearMap = Map<string, {
  qtde: number
  valor_vendas: number
  valor_lucro: number
  percentual_lucro: number
}>

type TipoBusca = 'departamento' | 'setor' | 'produto'

// Helper para gerar ID único a partir de string
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get schema from query params
    const schema = searchParams.get('schema')
    if (!schema) {
      return NextResponse.json({ error: 'Schema não informado' }, { status: 400 })
    }

    // Validar acesso ao schema
    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get parameters
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth()))
    const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
    const requestedFilialId = searchParams.get('filial_id') || null
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '50')
    const compareAnoAnterior = searchParams.get('compare_ano_anterior') === '1'
    const tipoBusca = (searchParams.get('tipo_busca') as TipoBusca | null) || 'departamento'
    const departamentoIds = searchParams.get('departamento_ids')
    const setorIds = searchParams.get('setor_ids')
    const busca = searchParams.get('busca')

    // Validate filial_id is required
    if (!requestedFilialId) {
      return NextResponse.json({ error: 'Filial é obrigatória' }, { status: 400 })
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filials to use based on authorization
    let finalFilialIds: number[] = []

    if (authorizedBranches === null) {
      // User has no restrictions - use requested values
      const ids = requestedFilialId.split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id))

      if (ids.length === 0) {
        return NextResponse.json({ error: 'Filial específica é obrigatória para este relatório' }, { status: 400 })
      }
      finalFilialIds = ids
    } else {
      // User has restrictions - filter requested filials by authorized branches
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

    // Validate parameters
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
    const buscaText = tipoBusca === 'produto' && busca?.trim() ? `%${busca.trim()}%` : null

    const requestStart = Date.now()
    console.log('[Venda Curva] Calling RPC with params:', {
      p_schema: schema,
      p_mes: mes,
      p_ano: ano,
      p_filial_ids: finalFilialIds,
      p_page: page,
      p_page_size: pageSize,
      compareAnoAnterior,
      tipoBusca,
      departamentoIdsArray,
      setorIdsArray,
      buscaText,
      requestedFilialId,
      authorizedBranches,
    })

    const now = new Date()
    const isMesAtual = now.getMonth() + 1 === mes && now.getFullYear() === ano
    const inlinePrevYearCutoff = compareAnoAnterior && isMesAtual
      ? now.toISOString().slice(0, 10)
      : undefined

    const rpcClient = supabase as unknown as {
      rpc: (fn: string, params: Record<string, unknown>) => Promise<{
        data: unknown
        error: { message?: string; details?: string; hint?: string; code?: string } | null
      }>
    }

    const fetchReportFast = async (
      targetAno: number,
      targetPage: number,
      targetPageSize: number,
      dataFimOverride?: string
    ): Promise<{ rows: RowData[]; supportsInlinePrevYear: boolean } | null> => {
      try {
        const rpcParams: Record<string, unknown> = {
          p_schema: schema,
          p_mes: mes,
          p_ano: targetAno,
          p_filial_ids: finalFilialIds,
          p_page: targetPage,
          p_page_size: targetPageSize,
          p_data_fim_override: dataFimOverride ?? null,
          p_departamento_ids: departamentoIdsArray,
          p_setor_ids: setorIdsArray,
          p_busca: buscaText,
        }
        const { data, error } = await rpcClient.rpc('get_venda_curva_report_fast', rpcParams)

        if (error) {
          throw error
        }

        return {
          rows: (data || []) as RowData[],
          supportsInlinePrevYear: true,
        }
      } catch (error: unknown) {
        const err = error as { message?: string; details?: string; hint?: string; code?: string }
        console.warn('[Venda Curva] Error fetching report fast, falling back to v3:', {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
        })
        return null
      }
    }

    const fetchReport = async (
      targetAno: number,
      targetPage: number,
      targetPageSize: number,
      dataFimOverride?: string
    ): Promise<{ rows: RowData[]; supportsInlinePrevYear: boolean }> => {
      try {
        const rpcParams: Record<string, unknown> = {
          p_schema: schema,
          p_mes: mes,
          p_ano: targetAno,
          p_filial_ids: finalFilialIds,
          p_page: targetPage,
          p_page_size: targetPageSize,
          p_data_fim_override: dataFimOverride ?? null,
          p_departamento_ids: departamentoIdsArray,
          p_setor_ids: setorIdsArray,
          p_busca: buscaText,
        }
        const { data, error } = await rpcClient.rpc('get_venda_curva_report_v3', rpcParams)

        if (error) {
          throw error
        }

        return {
          rows: (data || []) as RowData[],
          supportsInlinePrevYear: false
        }
      } catch (error: unknown) {
        const err = error as { message?: string; details?: string; hint?: string; code?: string }
        console.error('[Venda Curva] Error fetching report v3, falling back to v2:', {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
        })

        const rpcParams: Record<string, unknown> = {
          p_schema: schema,
          p_mes: mes,
          p_ano: targetAno,
          p_filial_ids: finalFilialIds,
          p_page: targetPage,
          p_page_size: targetPageSize,
          p_data_fim_override: dataFimOverride ?? null,
          p_departamento_ids: departamentoIdsArray,
          p_setor_ids: setorIdsArray,
          p_busca: buscaText,
        }
        const { data, error: v2Error } = await rpcClient.rpc('get_venda_curva_report_v2', rpcParams)

        if (!v2Error) {
          return {
            rows: (data || []) as RowData[],
            supportsInlinePrevYear: false
          }
        }

        console.error('[Venda Curva] Error fetching report v2, falling back to v1:', {
          message: v2Error.message,
          details: v2Error.details,
          hint: v2Error.hint,
          code: v2Error.code,
        })

        const results: RowData[] = []
        for (const filialId of finalFilialIds) {
          const rpcParams: Record<string, unknown> = {
            p_schema: schema,
            p_mes: mes,
            p_ano: targetAno,
            p_filial_id: filialId,
            p_page: targetPage,
            p_page_size: targetPageSize,
            p_data_fim_override: dataFimOverride ?? null,
            p_departamento_ids: departamentoIdsArray,
            p_setor_ids: setorIdsArray,
            p_busca: buscaText,
          }
          const { data, error: v1Error } = await rpcClient.rpc('get_venda_curva_report', rpcParams)

          if (v1Error) {
            console.error('[Venda Curva] Error fetching report v1 for filial', filialId, ':', {
              message: v1Error.message,
              details: v1Error.details,
              hint: v1Error.hint,
              code: v1Error.code,
            })
            throw new Error(`Erro ao buscar dados da filial ${filialId}: ${v1Error.message}`)
          }

          results.push(...((data || []) as RowData[]))
        }

        return {
          rows: results,
          supportsInlinePrevYear: false
        }
      }
    }

    // Call RPC function for each filial in parallel (ano atual)
    const rpcStart = Date.now()
    const fastResult = await fetchReportFast(ano, page, pageSize, inlinePrevYearCutoff)
    const { rows: dataArray, supportsInlinePrevYear } = fastResult ?? await fetchReport(ano, page, pageSize)
    const rpcDurationMs = Date.now() - rpcStart

    if (dataArray.length === 0) {
      console.log('[Venda Curva] No data received')
      return NextResponse.json({
        total_records: 0,
        page: 1,
        page_size: pageSize,
        total_pages: 0,
        hierarquia: []
      })
    }

    console.log('[Venda Curva] Received', dataArray.length, 'rows total from', finalFilialIds.length, 'filiais')

    let prevYearMap: PrevYearMap | null = null
    let prevYearDurationMs = 0
    if (compareAnoAnterior && dataArray.length > 0 && !supportsInlinePrevYear) {
      const prevYearStart = Date.now()
      let prevYearDataFimOverride: string | undefined
      if (isMesAtual) {
        const prevYear = now.getFullYear() - 1
        const cutoffDate = new Date(prevYear, now.getMonth(), now.getDate())
        prevYearDataFimOverride = cutoffDate.toISOString().slice(0, 10)
      }
      const currentKeys = new Set(
        dataArray.map((row) => buildRowKey(row.dept_nivel3, row.dept_nivel2, row.dept_nivel1, row.produto_codigo, row.filial_id))
      )
      const prevYearDataResult = await fetchReport(ano - 1, 1, 10000, prevYearDataFimOverride)
      const prevYearData = prevYearDataResult.rows
      prevYearMap = new Map()
      for (const row of prevYearData) {
        const key = buildRowKey(row.dept_nivel3, row.dept_nivel2, row.dept_nivel1, row.produto_codigo, row.filial_id)
        if (!currentKeys.has(key)) continue
        prevYearMap.set(key, {
          qtde: typeof row.qtde === 'string' ? parseFloat(row.qtde || '0') : (row.qtde || 0),
          valor_vendas: typeof row.valor_vendas === 'string' ? parseFloat(row.valor_vendas || '0') : (row.valor_vendas || 0),
          valor_lucro: typeof row.valor_lucro === 'string' ? parseFloat(row.valor_lucro || '0') : (row.valor_lucro || 0),
          percentual_lucro: typeof row.percentual_lucro === 'string' ? parseFloat(row.percentual_lucro || '0') : (row.percentual_lucro || 0),
        })
      }
      prevYearDurationMs = Date.now() - prevYearStart
    }

    // Organize data hierarchically
    const hierarchyStart = Date.now()
    const hierarquiaObj = organizeHierarchyFlat(dataArray, prevYearMap)
    const hierarchyDurationMs = Date.now() - hierarchyStart
    
    // Convert hierarchy object to array format expected by frontend
    // Sort nivel3 by total_vendas DESC
    const hierarquiaArray = Object.values(hierarquiaObj)
      .map((dept3) => ({
        dept3_id: hashCode(dept3.nome),
        dept_nivel3: dept3.nome,
        total_vendas: dept3.valor_vendido,
        total_lucro: dept3.lucro_total,
        margem: dept3.percentual_lucro,
        total_vendas_ano_anterior: dept3.valor_vendido_ano_anterior,
        total_lucro_ano_anterior: dept3.lucro_total_ano_anterior,
        margem_ano_anterior: dept3.percentual_lucro_ano_anterior,
        // Sort nivel2 by total_vendas DESC
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
            // Sort nivel1 by total_vendas DESC
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
                produtos: dept1.produtos.map((p) => ({
                  codigo: p.codigo,
                  descricao: p.nome,
                  filial_id: p.filial_id,
                  qtde: p.quantidade_vendida,
                  qtde_ano_anterior: p.quantidade_vendida_ano_anterior,
                  valor_vendas: p.valor_vendido,
                  valor_lucro: p.lucro_total,
                  percentual_lucro: p.percentual_lucro,
                  valor_vendas_ano_anterior: p.valor_vendido_ano_anterior,
                  valor_lucro_ano_anterior: p.lucro_total_ano_anterior,
                  percentual_lucro_ano_anterior: p.percentual_lucro_ano_anterior,
                  curva_venda: p.curva_venda,
                  curva_lucro: p.curva_lucro
                }))
              }))
              .sort((a, b) => b.total_vendas - a.total_vendas) // Sort nivel1
          }))
          .sort((a, b) => b.total_vendas - a.total_vendas) // Sort nivel2
      }))
      .sort((a, b) => b.total_vendas - a.total_vendas) // Sort nivel3

    const totalDurationMs = Date.now() - requestStart
    console.log('[Venda Curva] Hierarchy array length:', hierarquiaArray.length)
    console.log('[Venda Curva] Sample dept3:', hierarquiaArray[0] ? {
      nome: hierarquiaArray[0].dept_nivel3,
      nivel2_count: hierarquiaArray[0].nivel2?.length
    } : 'N/A')
    console.log('[Venda Curva] Timings (ms):', {
      rpc: rpcDurationMs,
      prev_year: prevYearDurationMs,
      hierarchy: hierarchyDurationMs,
      total: totalDurationMs,
      fast_rpc: supportsInlinePrevYear,
    })

    return NextResponse.json({
      total_records: hierarquiaArray.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(hierarquiaArray.length / pageSize),
      hierarquia: hierarquiaArray
    })
  } catch (error) {
    console.error('[Venda Curva] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao buscar relatório' },
      { status: 500 }
    )
  }
}

function buildRowKey(
  dept3: string,
  dept2: string,
  dept1: string,
  produtoCodigo: number,
  filialId: number
) {
  return `${dept3}||${dept2}||${dept1}||${produtoCodigo}||${filialId}`
}

// Organize data hierarchically from flat data
function organizeHierarchyFlat(data: RowData[], prevYearMap?: PrevYearMap | null): Hierarquia {
  const hierarquia: Hierarquia = {}

  // Group by dept_nivel3
  for (const row of data) {
    const dept3 = row.dept_nivel3
    const dept2 = row.dept_nivel2
    const dept1 = row.dept_nivel1

    // Initialize nivel 3
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
      filhos: {}
    }
    }

    // Initialize nivel 2
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
        filhos: {}
      }
    }

    // Initialize nivel 1
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
        produtos: []
      }
    }

    // Add product
    const rowKey = buildRowKey(dept3, dept2, dept1, row.produto_codigo, row.filial_id)
    const prevFromMap = prevYearMap?.get(rowKey)
    const prev = prevFromMap ?? {
      qtde: typeof row.qtde_ano_anterior === 'string' ? parseFloat(row.qtde_ano_anterior || '0') : (row.qtde_ano_anterior || 0),
      valor_vendas: typeof row.valor_vendas_ano_anterior === 'string' ? parseFloat(row.valor_vendas_ano_anterior || '0') : (row.valor_vendas_ano_anterior || 0),
      valor_lucro: typeof row.valor_lucro_ano_anterior === 'string' ? parseFloat(row.valor_lucro_ano_anterior || '0') : (row.valor_lucro_ano_anterior || 0),
      percentual_lucro: typeof row.percentual_lucro_ano_anterior === 'string' ? parseFloat(row.percentual_lucro_ano_anterior || '0') : (row.percentual_lucro_ano_anterior || 0),
    }
    const produto = {
      codigo: row.produto_codigo,
      nome: row.produto_descricao,
      filial_id: row.filial_id,
      quantidade_vendida: typeof row.qtde === 'string' ? parseFloat(row.qtde || '0') : (row.qtde || 0),
      quantidade_vendida_ano_anterior: prev?.qtde ?? 0,
      valor_vendido: typeof row.valor_vendas === 'string' ? parseFloat(row.valor_vendas || '0') : (row.valor_vendas || 0),
      lucro_total: typeof row.valor_lucro === 'string' ? parseFloat(row.valor_lucro || '0') : (row.valor_lucro || 0),
      percentual_lucro: typeof row.percentual_lucro === 'string' ? parseFloat(row.percentual_lucro || '0') : (row.percentual_lucro || 0),
      valor_vendido_ano_anterior: prev?.valor_vendas ?? 0,
      lucro_total_ano_anterior: prev?.valor_lucro ?? 0,
      percentual_lucro_ano_anterior: prev?.percentual_lucro ?? 0,
      curva_venda: row.curva_venda,
      curva_lucro: row.curva_lucro
    }
    hierarquia[dept3].filhos[dept2].filhos[dept1].produtos.push(produto)

    // Accumulate values for nivel 1
    hierarquia[dept3].filhos[dept2].filhos[dept1].valor_vendido += produto.valor_vendido
    hierarquia[dept3].filhos[dept2].filhos[dept1].lucro_total += produto.lucro_total
    hierarquia[dept3].filhos[dept2].filhos[dept1].valor_vendido_ano_anterior += produto.valor_vendido_ano_anterior
    hierarquia[dept3].filhos[dept2].filhos[dept1].lucro_total_ano_anterior += produto.lucro_total_ano_anterior

    // Accumulate values for nivel 2
    hierarquia[dept3].filhos[dept2].valor_vendido += produto.valor_vendido
    hierarquia[dept3].filhos[dept2].lucro_total += produto.lucro_total
    hierarquia[dept3].filhos[dept2].valor_vendido_ano_anterior += produto.valor_vendido_ano_anterior
    hierarquia[dept3].filhos[dept2].lucro_total_ano_anterior += produto.lucro_total_ano_anterior

    // Accumulate values for nivel 3
    hierarquia[dept3].valor_vendido += produto.valor_vendido
    hierarquia[dept3].lucro_total += produto.lucro_total
    hierarquia[dept3].valor_vendido_ano_anterior += produto.valor_vendido_ano_anterior
    hierarquia[dept3].lucro_total_ano_anterior += produto.lucro_total_ano_anterior
  }

  // Calculate percentual_lucro for all levels
  for (const dept3 of Object.values(hierarquia)) {
    if (dept3.valor_vendido > 0) {
      dept3.percentual_lucro = (dept3.lucro_total / dept3.valor_vendido) * 100
    }
    if (dept3.valor_vendido_ano_anterior > 0) {
      dept3.percentual_lucro_ano_anterior = (dept3.lucro_total_ano_anterior / dept3.valor_vendido_ano_anterior) * 100
    }

    for (const dept2 of Object.values(dept3.filhos)) {
      if (dept2.valor_vendido > 0) {
        dept2.percentual_lucro = (dept2.lucro_total / dept2.valor_vendido) * 100
      }
      if (dept2.valor_vendido_ano_anterior > 0) {
        dept2.percentual_lucro_ano_anterior = (dept2.lucro_total_ano_anterior / dept2.valor_vendido_ano_anterior) * 100
      }

      for (const dept1 of Object.values(dept2.filhos)) {
        if (dept1.valor_vendido > 0) {
          dept1.percentual_lucro = (dept1.lucro_total / dept1.valor_vendido) * 100
        }
        if (dept1.valor_vendido_ano_anterior > 0) {
          dept1.percentual_lucro_ano_anterior = (dept1.lucro_total_ano_anterior / dept1.valor_vendido_ano_anterior) * 100
        }
      }
    }
  }

  return hierarquia
}
