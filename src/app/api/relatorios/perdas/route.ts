import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// Types
interface Produto {
  codigo: number
  nome: string
  filial_id: number
  quantidade: number
  valor_perda: number
}

interface DepartamentoNivel1 {
  nome: string
  nivel: number
  total_qtde: number
  total_valor: number
  produtos: Produto[]
}

interface DepartamentoNivel2 {
  nome: string
  nivel: number
  total_qtde: number
  total_valor: number
  filhos: Record<string, DepartamentoNivel1>
}

interface DepartamentoNivel3 {
  nome: string
  nivel: number
  total_qtde: number
  total_valor: number
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
  valor_perda: string | number
}

interface VendasDeptRow {
  dept_nivel3: string
  dept_nivel2: string
  dept_nivel1: string
  valor_vendas: string | number
}

// Estrutura para armazenar vendas por departamento
interface VendasPorDept {
  // Chave: "dept3|dept2|dept1" -> valor de vendas
  nivel1: Record<string, number>
  // Chave: "dept3|dept2" -> valor de vendas
  nivel2: Record<string, number>
  // Chave: "dept3" -> valor de vendas
  nivel3: Record<string, number>
}

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

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get parameters
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))
    const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
    const requestedFilialId = searchParams.get('filial_id') || null
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '50')

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filials to use based on authorization
    let finalFilialIds: number[] = []

    if (!requestedFilialId) {
      // No filial specified - use all authorized or all available
      if (authorizedBranches === null) {
        // User has no restrictions - get tenant_id from schema
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('id')
          .eq('supabase_schema', schema)
          .single() as { data: { id: string } | null }

        if (!tenantData) {
          return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
        }

        // Get all branches for this tenant
        const { data: allBranches, error: branchesError } = await supabase
          .from('branches')
          .select('branch_code')
          .eq('tenant_id', tenantData.id)
          .order('branch_code')

        if (branchesError) {
          console.error('[Perdas] Error fetching all branches:', branchesError)
          return NextResponse.json({ error: 'Erro ao buscar filiais' }, { status: 500 })
        }

        finalFilialIds = (allBranches || [])
          .map((b: { branch_code: string }) => parseInt(b.branch_code, 10))
          .filter((id) => !isNaN(id))
      } else {
        // User has restrictions - use all authorized branches
        finalFilialIds = authorizedBranches.map(id => parseInt(id, 10))
      }
    } else if (authorizedBranches === null) {
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

    if (finalFilialIds.length === 0) {
      return NextResponse.json({ error: 'Nenhuma filial disponível' }, { status: 400 })
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

    console.log('[Perdas] Calling RPC with params:', {
      p_schema: schema,
      p_mes: mes,
      p_ano: ano,
      p_filial_ids: finalFilialIds,
      p_page: page,
      p_page_size: pageSize,
    })

    // Calcular mês anterior
    let mesAnterior = mes - 1
    let anoAnterior = ano
    if (mesAnterior === 0) {
      mesAnterior = 12
      anoAnterior = ano - 1
    }

    // Call RPC functions for each filial in parallel (perdas + vendas)
    const perdasPromises = finalFilialIds.map(async (filialId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_perdas_report', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano,
        p_filial_id: filialId,
        p_page: page,
        p_page_size: pageSize,
      })

      if (error) {
        console.error('[Perdas] Error fetching report for filial', filialId, ':', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        throw new Error(`Erro ao buscar dados da filial ${filialId}: ${error.message}`)
      }

      return (data || []) as RowData[]
    })

    // Buscar total de vendas para cada filial no mesmo período
    const vendasTotalPromises = finalFilialIds.map(async (filialId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_perdas_total_vendas_periodo', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano,
        p_filial_id: filialId,
      })

      if (error) {
        console.error('[Perdas] Error fetching vendas for filial', filialId, ':', error.message)
        return 0 // Se falhar, retorna 0 para não quebrar o relatório
      }

      return typeof data === 'number' ? data : parseFloat(data || '0')
    })

    // Buscar vendas por departamento para cada filial
    const vendasDeptPromises = finalFilialIds.map(async (filialId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_perdas_vendas_por_departamento', {
        p_schema: schema,
        p_mes: mes,
        p_ano: ano,
        p_filial_id: filialId,
      })

      if (error) {
        console.error('[Perdas] Error fetching vendas por dept for filial', filialId, ':', error.message)
        return [] as VendasDeptRow[]
      }

      return (data || []) as VendasDeptRow[]
    })

    // Buscar perdas do mês anterior para cada filial (para comparativo)
    const perdasMesAnteriorPromises = finalFilialIds.map(async (filialId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_perdas_report', {
        p_schema: schema,
        p_mes: mesAnterior,
        p_ano: anoAnterior,
        p_filial_id: filialId,
        p_page: 1,
        p_page_size: 10000,
      })

      if (error) {
        console.error('[Perdas] Error fetching previous month for filial', filialId, ':', error.message)
        return { filialId, rows: [] as RowData[] }
      }

      return { filialId, rows: (data || []) as RowData[] }
    })

    const [perdasResults, vendasTotalResults, vendasDeptResults, perdasMesAnteriorResults] = await Promise.all([
      Promise.all(perdasPromises),
      Promise.all(vendasTotalPromises),
      Promise.all(vendasDeptPromises),
      Promise.all(perdasMesAnteriorPromises)
    ])

    const dataArray = perdasResults.flat()
    const totalVendasPeriodo = vendasTotalResults.reduce((acc, val) => acc + val, 0)

    // Agregar vendas por departamento de todas as filiais
    const vendasPorDept = aggregateVendasPorDept(vendasDeptResults.flat())

    // Calcular total de perdas por filial (para gráfico de pizza)
    const perdasPorFilial: Record<number, number> = {}
    for (let i = 0; i < finalFilialIds.length; i++) {
      const filialId = finalFilialIds[i]
      const filialData = perdasResults[i] || []
      const totalFilial = filialData.reduce((acc, row) => {
        const valorPerda = typeof row.valor_perda === 'string' ? parseFloat(row.valor_perda || '0') : (row.valor_perda || 0)
        return acc + valorPerda
      }, 0)
      perdasPorFilial[filialId] = totalFilial
    }

    // Calcular total de perdas do mês anterior
    let totalPerdasMesAnterior = 0
    for (const result of perdasMesAnteriorResults) {
      const total = result.rows.reduce((acc, row) => {
        const valorPerda = typeof row.valor_perda === 'string' ? parseFloat(row.valor_perda || '0') : (row.valor_perda || 0)
        return acc + valorPerda
      }, 0)
      totalPerdasMesAnterior += total
    }

    if (dataArray.length === 0) {
      console.log('[Perdas] No data received')
      return NextResponse.json({
        total_records: 0,
        page: 1,
        page_size: pageSize,
        total_pages: 0,
        hierarquia: [],
        total_vendas_periodo: totalVendasPeriodo,
        perdas_por_filial: perdasPorFilial,
        total_perdas_mes_anterior: totalPerdasMesAnterior,
        mes_anterior: mesAnterior,
        ano_anterior: anoAnterior
      })
    }

    console.log('[Perdas] Received', dataArray.length, 'rows total from', finalFilialIds.length, 'filiais')

    // Organize data hierarchically
    const hierarquiaObj = organizeHierarchyFlat(dataArray)

    // Convert hierarchy object to array format expected by frontend
    // Sort nivel3 by total_valor DESC
    const hierarquiaArray = Object.values(hierarquiaObj)
      .map((dept3) => {
        const keyNivel3 = dept3.nome
        const vendaSetor3 = vendasPorDept.nivel3[keyNivel3] || 0

        return {
          dept3_id: hashCode(dept3.nome),
          dept_nivel3: dept3.nome,
          total_qtde: dept3.total_qtde,
          total_valor: dept3.total_valor,
          venda_setor: vendaSetor3,
          // Sort nivel2 by total_valor DESC
          nivel2: Object.values(dept3.filhos)
            .map((dept2) => {
              const keyNivel2 = `${dept3.nome}|${dept2.nome}`
              const vendaSetor2 = vendasPorDept.nivel2[keyNivel2] || 0

              return {
                dept2_id: hashCode(dept2.nome),
                dept_nivel2: dept2.nome,
                total_qtde: dept2.total_qtde,
                total_valor: dept2.total_valor,
                venda_setor: vendaSetor2,
                // Sort nivel1 by total_valor DESC
                nivel1: Object.values(dept2.filhos)
                  .map((dept1) => {
                    const keyNivel1 = `${dept3.nome}|${dept2.nome}|${dept1.nome}`
                    const vendaSetor1 = vendasPorDept.nivel1[keyNivel1] || 0

                    return {
                      dept1_id: hashCode(dept1.nome),
                      dept_nivel1: dept1.nome,
                      total_qtde: dept1.total_qtde,
                      total_valor: dept1.total_valor,
                      venda_setor: vendaSetor1,
                      produtos: dept1.produtos.map((p) => ({
                        codigo: p.codigo,
                        descricao: p.nome,
                        filial_id: p.filial_id,
                        qtde: p.quantidade,
                        valor_perda: p.valor_perda
                      }))
                    }
                  })
                  .sort((a, b) => b.total_valor - a.total_valor) // Sort nivel1
              }
            })
            .sort((a, b) => b.total_valor - a.total_valor) // Sort nivel2
        }
      })
      .sort((a, b) => b.total_valor - a.total_valor) // Sort nivel3

    console.log('[Perdas] Hierarchy array length:', hierarquiaArray.length)

    console.log('[Perdas] Total vendas periodo:', totalVendasPeriodo)

    // Calcular total geral de perdas do mês atual
    const totalPerdasAtual = Object.values(perdasPorFilial).reduce((acc, val) => acc + val, 0)

    return NextResponse.json({
      total_records: hierarquiaArray.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(hierarquiaArray.length / pageSize),
      hierarquia: hierarquiaArray,
      total_vendas_periodo: totalVendasPeriodo,
      perdas_por_filial: perdasPorFilial,
      total_perdas_atual: totalPerdasAtual,
      total_perdas_mes_anterior: totalPerdasMesAnterior,
      mes_anterior: mesAnterior,
      ano_anterior: anoAnterior
    })
  } catch (error) {
    console.error('[Perdas] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao buscar relatório' },
      { status: 500 }
    )
  }
}

// Organize data hierarchically from flat data
function organizeHierarchyFlat(data: RowData[]): Hierarquia {
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
        total_qtde: 0,
        total_valor: 0,
        filhos: {}
      }
    }

    // Initialize nivel 2
    if (!hierarquia[dept3].filhos[dept2]) {
      hierarquia[dept3].filhos[dept2] = {
        nome: dept2,
        nivel: 2,
        total_qtde: 0,
        total_valor: 0,
        filhos: {}
      }
    }

    // Initialize nivel 1
    if (!hierarquia[dept3].filhos[dept2].filhos[dept1]) {
      hierarquia[dept3].filhos[dept2].filhos[dept1] = {
        nome: dept1,
        nivel: 1,
        total_qtde: 0,
        total_valor: 0,
        produtos: []
      }
    }

    // Add product
    const produto = {
      codigo: row.produto_codigo,
      nome: row.produto_descricao,
      filial_id: row.filial_id,
      quantidade: typeof row.qtde === 'string' ? parseFloat(row.qtde || '0') : (row.qtde || 0),
      valor_perda: typeof row.valor_perda === 'string' ? parseFloat(row.valor_perda || '0') : (row.valor_perda || 0),
    }
    hierarquia[dept3].filhos[dept2].filhos[dept1].produtos.push(produto)

    // Accumulate values for nivel 1
    hierarquia[dept3].filhos[dept2].filhos[dept1].total_qtde += produto.quantidade
    hierarquia[dept3].filhos[dept2].filhos[dept1].total_valor += produto.valor_perda

    // Accumulate values for nivel 2
    hierarquia[dept3].filhos[dept2].total_qtde += produto.quantidade
    hierarquia[dept3].filhos[dept2].total_valor += produto.valor_perda

    // Accumulate values for nivel 3
    hierarquia[dept3].total_qtde += produto.quantidade
    hierarquia[dept3].total_valor += produto.valor_perda
  }

  return hierarquia
}

// Aggregate vendas por departamento de múltiplas filiais
function aggregateVendasPorDept(data: VendasDeptRow[]): VendasPorDept {
  const result: VendasPorDept = {
    nivel1: {},
    nivel2: {},
    nivel3: {}
  }

  for (const row of data) {
    const dept3 = row.dept_nivel3
    const dept2 = row.dept_nivel2
    const dept1 = row.dept_nivel1
    const valorVendas = typeof row.valor_vendas === 'string'
      ? parseFloat(row.valor_vendas || '0')
      : (row.valor_vendas || 0)

    // Agregar para nivel 1 (subgrupo)
    const keyNivel1 = `${dept3}|${dept2}|${dept1}`
    result.nivel1[keyNivel1] = (result.nivel1[keyNivel1] || 0) + valorVendas

    // Agregar para nivel 2 (grupo)
    const keyNivel2 = `${dept3}|${dept2}`
    result.nivel2[keyNivel2] = (result.nivel2[keyNivel2] || 0) + valorVendas

    // Agregar para nivel 3 (departamento)
    result.nivel3[dept3] = (result.nivel3[dept3] || 0) + valorVendas
  }

  return result
}
