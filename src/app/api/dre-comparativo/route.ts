import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { safeRpcError } from '@/lib/api/error-handler'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

interface ContextParam {
  id: string
  label: string
  filiais: string[]
  mes: number
  ano: number
  data_inicio?: string  // Format: yyyy-MM-dd
  data_fim?: string     // Format: yyyy-MM-dd
}

interface DREData {
  // Receita separada por origem
  receita_bruta_pdv: number
  receita_bruta_faturamento: number
  receita_bruta: number
  desconto_venda: number
  receita_liquida: number
  // CMV separado por origem
  cmv_pdv: number
  cmv_faturamento: number
  cmv: number
  lucro_bruto: number
  margem_bruta: number
  despesas_operacionais: number
  resultado_operacional: number
  margem_operacional: number
  despesas_json: {
    departamento_id: number
    departamento: string
    valor: number
    tipos?: {
      tipo_id: number
      tipo: string
      valor: number
      despesas?: {
        valor: number
        descricao: string
        serie_nota: string | null
        numero_nota: number
        data_emissao: string
      }[]
    }[]
  }[]
}

interface DRELineData {
  descricao: string
  tipo: 'header' | 'subitem' | 'total'
  nivel: number
  valores: Record<string, number>
  expandable?: boolean
  items?: DRELineData[]
  isDeduction?: boolean  // Indica se é linha de dedução (CMV, despesas)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const contextsParam = searchParams.get('contexts')

    // Validations
    if (!schema || !contextsParam) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: schema, contexts' },
        { status: 400 }
      )
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let contexts: ContextParam[]
    try {
      contexts = JSON.parse(contextsParam)
    } catch {
      return NextResponse.json(
        { error: 'Parâmetro contexts inválido' },
        { status: 400 }
      )
    }

    if (!Array.isArray(contexts) || contexts.length < 2 || contexts.length > 4) {
      return NextResponse.json(
        { error: 'São necessários entre 2 e 4 contextos de comparação' },
        { status: 400 }
      )
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Validate each context has valid branches
    for (const ctx of contexts) {
      if (!ctx.filiais || ctx.filiais.length === 0) {
        return NextResponse.json(
          { error: `${ctx.label}: ao menos uma filial é obrigatória` },
          { status: 400 }
        )
      }

      // Check authorization if user has branch restrictions
      if (authorizedBranches !== null) {
        const unauthorized = ctx.filiais.filter(f => !authorizedBranches.includes(f))
        if (unauthorized.length > 0) {
          return NextResponse.json(
            { error: `${ctx.label}: acesso negado a filiais: ${unauthorized.join(', ')}` },
            { status: 403 }
          )
        }
      }
    }

    console.log('[API DRE Comparativo] Params:', {
      schema,
      contextsCount: contexts.length,
      contexts: contexts.map(c => ({
        id: c.id,
        label: c.label,
        filiais: c.filiais,
        mes: c.mes,
        ano: c.ano,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
      })),
    })

    // Fetch DRE data for each context
    const dreDataByContext: Record<string, DREData> = {}

    for (const ctx of contexts) {
      const filiaisIds = ctx.filiais.map(f => parseInt(f, 10))

      // Use v2 function with dates if data_inicio and data_fim are provided
      // Otherwise fall back to original function with mes/ano
      let rpcData, rpcError

      if (ctx.data_inicio && ctx.data_fim) {
        // Use new v2 function with date range
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase.rpc as any)('get_dre_comparativo_data_v2', {
          p_schema: schema,
          p_filiais_ids: filiaisIds,
          p_data_inicio: ctx.data_inicio,
          p_data_fim: ctx.data_fim,
        })
        rpcData = result.data
        rpcError = result.error
      } else {
        // Fall back to original function with mes/ano
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase.rpc as any)('get_dre_comparativo_data', {
          p_schema: schema,
          p_filiais_ids: filiaisIds,
          p_mes: ctx.mes,
          p_ano: ctx.ano,
        })
        rpcData = result.data
        rpcError = result.error
      }

      if (rpcError) {
        console.error('[API DRE Comparativo] RPC Error for context:', ctx.id, rpcError)
        return safeRpcError(rpcError, 'dre-comparativo')
      }

      // RPC returns array with single row
      const result = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : rpcData
      if (result) {
        dreDataByContext[ctx.id] = {
          // Receita separada
          receita_bruta_pdv: parseFloat(result.receita_bruta_pdv) || 0,
          receita_bruta_faturamento: parseFloat(result.receita_bruta_faturamento) || 0,
          receita_bruta: parseFloat(result.receita_bruta) || 0,
          desconto_venda: parseFloat(result.desconto_venda) || 0,
          receita_liquida: parseFloat(result.receita_liquida) || 0,
          // CMV separado
          cmv_pdv: parseFloat(result.cmv_pdv) || 0,
          cmv_faturamento: parseFloat(result.cmv_faturamento) || 0,
          cmv: parseFloat(result.cmv) || 0,
          lucro_bruto: parseFloat(result.lucro_bruto) || 0,
          margem_bruta: parseFloat(result.margem_bruta) || 0,
          despesas_operacionais: parseFloat(result.despesas_operacionais) || 0,
          resultado_operacional: parseFloat(result.resultado_operacional) || 0,
          margem_operacional: parseFloat(result.margem_operacional) || 0,
          despesas_json: result.despesas_json || [],
        }
      } else {
        // No data for this context
        dreDataByContext[ctx.id] = {
          receita_bruta_pdv: 0,
          receita_bruta_faturamento: 0,
          receita_bruta: 0,
          desconto_venda: 0,
          receita_liquida: 0,
          cmv_pdv: 0,
          cmv_faturamento: 0,
          cmv: 0,
          lucro_bruto: 0,
          margem_bruta: 0,
          despesas_operacionais: 0,
          resultado_operacional: 0,
          margem_operacional: 0,
          despesas_json: [],
        }
      }
    }

    console.log('[API DRE Comparativo] Data fetched for contexts:', Object.keys(dreDataByContext))

    // Build DRE lines structure
    const linhas: DRELineData[] = buildDRELines(contexts, dreDataByContext)

    // Build response
    const response = {
      linhas,
      contextos: contexts.map(c => ({
        id: c.id,
        label: c.label,
      })),
    }

    console.log('[API DRE Comparativo] Response:', {
      linhasCount: linhas.length,
      contextosCount: response.contextos.length,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API DRE Comparativo] General error:', error)
    return safeRpcError(error, 'dre-comparativo')
  }
}

/**
 * Build DRE lines structure from context data
 */
function buildDRELines(
  contexts: ContextParam[],
  dataByContext: Record<string, DREData>
): DRELineData[] {
  const linhas: DRELineData[] = []

  // Helper to create valores object
  const createValores = (getValue: (data: DREData) => number): Record<string, number> => {
    const valores: Record<string, number> = {}
    for (const ctx of contexts) {
      const data = dataByContext[ctx.id]
      valores[ctx.id] = data ? getValue(data) : 0
    }
    return valores
  }

  // Verificar se há dados de faturamento em algum contexto
  const hasFaturamento = Object.values(dataByContext).some(d => d.receita_bruta_faturamento > 0)

  // 1. RECEITA BRUTA - Com sublinhas de PDV e Faturamento
  const receitaSubItems: DRELineData[] = []

  // Sublinha: Vendas de PDV
  receitaSubItems.push({
    descricao: 'Vendas de PDV',
    tipo: 'subitem',
    nivel: 1,
    valores: createValores(d => d.receita_bruta_pdv),
    expandable: false,
  })

  // Sublinha: Vendas Faturamento (só mostra se houver dados)
  if (hasFaturamento) {
    receitaSubItems.push({
      descricao: 'Vendas Faturamento',
      tipo: 'subitem',
      nivel: 1,
      valores: createValores(d => d.receita_bruta_faturamento),
      expandable: false,
    })
  }

  linhas.push({
    descricao: 'RECEITA BRUTA',
    tipo: 'header',
    nivel: 0,
    valores: createValores(d => d.receita_liquida),
    expandable: receitaSubItems.length > 1, // Só expande se tiver mais de uma sublinha
    items: receitaSubItems.length > 1 ? receitaSubItems : undefined,
  })

  // 2. (-) CMV - Com sublinhas de PDV e Faturamento
  const cmvSubItems: DRELineData[] = []

  // Sublinha: CMV PDV
  cmvSubItems.push({
    descricao: 'CMV PDV',
    tipo: 'subitem',
    nivel: 2,
    valores: createValores(d => d.cmv_pdv),
    expandable: false,
    isDeduction: true,
  })

  // Sublinha: CMV Faturamento (só mostra se houver dados)
  if (hasFaturamento) {
    cmvSubItems.push({
      descricao: 'CMV Faturamento',
      tipo: 'subitem',
      nivel: 2,
      valores: createValores(d => d.cmv_faturamento),
      expandable: false,
      isDeduction: true,
    })
  }

  linhas.push({
    descricao: '(-) CMV - Custo da Mercadoria Vendida',
    tipo: 'subitem',
    nivel: 1,
    valores: createValores(d => d.cmv),
    expandable: cmvSubItems.length > 1, // Só expande se tiver mais de uma sublinha
    items: cmvSubItems.length > 1 ? cmvSubItems : undefined,
    isDeduction: true,
  })

  // 5. = LUCRO BRUTO
  linhas.push({
    descricao: '= LUCRO BRUTO',
    tipo: 'total',
    nivel: 0,
    valores: createValores(d => d.lucro_bruto),
    expandable: false,
  })

  // 5.1 Margem Bruta (%)
  linhas.push({
    descricao: 'Margem Bruta (%)',
    tipo: 'subitem',
    nivel: 1,
    valores: createValores(d => d.margem_bruta),
    expandable: false,
  })

  // 6. (-) DESPESAS OPERACIONAIS - With hierarchical expandable items (Dept > Tipo > Despesa)
  // Collect all unique departments across all contexts
  const allDepartments = new Map<number, { name: string; tipos: Map<number, { name: string; despesas: unknown[] }> }>()
  
  console.log('[DRE Comparativo] Processing despesas_json for contexts:', contexts.map(c => c.id))
  
  for (const ctx of contexts) {
    const data = dataByContext[ctx.id]
    console.log(`[DRE Comparativo] Context ${ctx.id} despesas_json:`, JSON.stringify(data?.despesas_json || [], null, 2))
    
    if (data && data.despesas_json) {
      for (const dept of data.despesas_json) {
        if (dept.departamento_id && dept.departamento) {
          if (!allDepartments.has(dept.departamento_id)) {
            allDepartments.set(dept.departamento_id, {
              name: dept.departamento,
              tipos: new Map()
            })
          }
          
          // Process tipos for this department
          if (dept.tipos && Array.isArray(dept.tipos)) {
            console.log(`[DRE Comparativo] Dept ${dept.departamento} has ${dept.tipos.length} tipos`)
            const deptData = allDepartments.get(dept.departamento_id)!
            
            for (const tipo of dept.tipos) {
              if (tipo.tipo_id && tipo.tipo) {
                if (!deptData.tipos.has(tipo.tipo_id)) {
                  deptData.tipos.set(tipo.tipo_id, {
                    name: tipo.tipo,
                    despesas: []
                  })
                }
                
                // Store despesas for this tipo
                if (tipo.despesas && Array.isArray(tipo.despesas)) {
                  const tipoData = deptData.tipos.get(tipo.tipo_id)!
                  // Merge despesas from all contexts
                  tipoData.despesas.push(...tipo.despesas)
                }
              }
            }
          }
        }
      }
    }
  }

  // Build despesas items with hierarchy
  const despesasItems: DRELineData[] = Array.from(allDepartments.entries()).map(([deptId, deptInfo]) => {
    // Calculate department valores across all contexts
    const deptValores: Record<string, number> = {}
    for (const ctx of contexts) {
      const data = dataByContext[ctx.id]
      const deptData = data?.despesas_json?.find((d) => d.departamento_id === deptId)
      deptValores[ctx.id] = deptData ? deptData.valor : 0
    }
    
    // Build tipos items for this department
    const tiposItems: DRELineData[] = Array.from(deptInfo.tipos.entries()).map(([tipoId, tipoInfo]) => {
      // Calculate tipo valores across all contexts
      const tipoValores: Record<string, number> = {}
      for (const ctx of contexts) {
        const data = dataByContext[ctx.id]
        const deptData = data?.despesas_json?.find((d) => d.departamento_id === deptId)
        const tipoData = deptData?.tipos?.find((t: { tipo_id: number }) => t.tipo_id === tipoId)
        tipoValores[ctx.id] = tipoData ? tipoData.valor : 0
      }
      
      // Build despesas items for this tipo
      const despesasItemsList: DRELineData[] = []
      
      // Group despesas by descricao+nota to avoid duplicates across contexts
      const despesasMap = new Map<string, { descricao: string; nota: unknown; serie: unknown; data: unknown; valores: Record<string, number> }>()
      
      for (const ctx of contexts) {
        const data = dataByContext[ctx.id]
        const deptData = data?.despesas_json?.find((d) => d.departamento_id === deptId)
        const tipoData = deptData?.tipos?.find((t: { tipo_id: number }) => t.tipo_id === tipoId)
        
        if (tipoData?.despesas && Array.isArray(tipoData.despesas)) {
          for (const desp of tipoData.despesas) {
            const key = `${desp.descricao || ''}-${desp.numero_nota || ''}-${desp.serie_nota || ''}`
            
            if (!despesasMap.has(key)) {
              despesasMap.set(key, {
                descricao: desp.descricao || 'Sem descrição',
                nota: desp.numero_nota,
                serie: desp.serie_nota,
                data: desp.data_emissao,
                valores: {}
              })
            }
            
            const despItem = despesasMap.get(key)!
            despItem.valores[ctx.id] = (despItem.valores[ctx.id] || 0) + (desp.valor || 0)
          }
        }
      }
      
      // Convert despesas map to array
      despesasMap.forEach((despItem) => {
        despesasItemsList.push({
          descricao: despItem.descricao,
          tipo: 'subitem' as const,
          nivel: 4,
          valores: despItem.valores,
          expandable: false,
          isDeduction: true,
        })
      })
      
      // Sort despesas by first context value
      despesasItemsList.sort((a, b) => {
        const firstCtxId = contexts[0]?.id
        const aVal = Math.abs(a.valores[firstCtxId] || 0)
        const bVal = Math.abs(b.valores[firstCtxId] || 0)
        return bVal - aVal
      })
      
      return {
        descricao: tipoInfo.name,
        tipo: 'subitem' as const,
        nivel: 3,
        valores: tipoValores,
        expandable: despesasItemsList.length > 0,
        items: despesasItemsList.length > 0 ? despesasItemsList : undefined,
        isDeduction: true,
      }
    })
    
    // Sort tipos by first context value
    tiposItems.sort((a, b) => {
      const firstCtxId = contexts[0]?.id
      const aVal = Math.abs(a.valores[firstCtxId] || 0)
      const bVal = Math.abs(b.valores[firstCtxId] || 0)
      return bVal - aVal
    })
    
    return {
      descricao: deptInfo.name,
      tipo: 'subitem' as const,
      nivel: 2,
      valores: deptValores,
      expandable: tiposItems.length > 0,
      items: tiposItems.length > 0 ? tiposItems : undefined,
      isDeduction: true,
    }
  }).sort((a, b) => {
    // Sort by first context value (absolute)
    const firstCtxId = contexts[0]?.id
    const aVal = Math.abs(a.valores[firstCtxId] || 0)
    const bVal = Math.abs(b.valores[firstCtxId] || 0)
    return bVal - aVal
  })

  console.log(`[DRE Comparativo] Built ${despesasItems.length} department items`)
  console.log('[DRE Comparativo] First dept item:', JSON.stringify(despesasItems[0], null, 2))

  linhas.push({
    descricao: '(-) DESPESAS OPERACIONAIS',
    tipo: 'header',
    nivel: 0,
    valores: createValores(d => d.despesas_operacionais),
    expandable: despesasItems.length > 0,
    items: despesasItems,
    isDeduction: true,
  })

  // 7. = LUCRO LÍQUIDO
  linhas.push({
    descricao: '= LUCRO LÍQUIDO',
    tipo: 'total',
    nivel: 0,
    valores: createValores(d => d.resultado_operacional),
    expandable: false,
  })

  // 7.1 Margem Líquida (%)
  linhas.push({
    descricao: 'Margem Líquida (%)',
    tipo: 'subitem',
    nivel: 1,
    valores: createValores(d => d.margem_operacional),
    expandable: false,
  })

  return linhas
}
