import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { safeRpcError } from '@/lib/api/error-handler'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Obter parâmetros da query
    const searchParams = request.nextUrl.searchParams
    const schema = searchParams.get('schema')
    const requestedFilialId = searchParams.get('filial_id')
    const dataInicial = searchParams.get('data_inicial')
    const dataFinal = searchParams.get('data_final')

    // Validações
    if (!schema || !dataInicial || !dataFinal) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: schema, data_inicial, data_final' },
        { status: 400 }
      )
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's authorized branches
    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Determine which filial to use
    let finalFilialId: number | null = null

    if (authorizedBranches === null) {
      // User has no restrictions - use requested value
      if (!requestedFilialId) {
        return NextResponse.json(
          { error: 'filial_id é obrigatório' },
          { status: 400 }
        )
      }

      if (requestedFilialId !== 'all') {
        const parsed = parseInt(requestedFilialId, 10)
        if (!isNaN(parsed)) {
          finalFilialId = parsed
        } else {
          return NextResponse.json(
            { error: 'filial_id inválido' },
            { status: 400 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'filial_id específico é obrigatório para esta API' },
          { status: 400 }
        )
      }
    } else {
      // User has restrictions
      if (authorizedBranches.length === 0) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso a nenhuma filial' },
          { status: 403 }
        )
      }

      if (!requestedFilialId || requestedFilialId === 'all') {
        return NextResponse.json(
          { error: 'filial_id específico é obrigatório para esta API' },
          { status: 400 }
        )
      }

      // Specific filial requested - check if authorized
      const parsed = parseInt(requestedFilialId, 10)
      if (isNaN(parsed)) {
        return NextResponse.json(
          { error: 'filial_id inválido' },
          { status: 400 }
        )
      }

      if (!authorizedBranches.includes(requestedFilialId)) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso à filial solicitada' },
          { status: 403 }
        )
      }

      finalFilialId = parsed
    }

    console.log('[API Despesas] Params:', {
      schema,
      requestedFilialId,
      finalFilialId,
      dataInicial,
      dataFinal,
      authorizedBranches
    })

    // Usar RPC para executar query com schema dinâmico
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: resultData, error: rpcError } = await (supabase.rpc as any)('get_despesas_hierarquia', {
      p_schema: schema,
      p_filial_id: finalFilialId,
      p_data_inicial: dataInicial,
      p_data_final: dataFinal,
      p_tipo_data: 'data_emissao'
    })

    if (rpcError) {
      console.error('[API] Erro RPC:', rpcError)
      return safeRpcError(rpcError, 'dre-hierarquia')
    }

    console.log('[API] Dados RPC recebidos:', resultData?.length || 0, 'registros')

    // Processar dados para estrutura hierárquica
    const departamentosMap = new Map()
    const tiposMap = new Map()
    const graficoMap = new Map<string, number>()

    /* eslint-disable @typescript-eslint/no-explicit-any */
    resultData?.forEach((desp: any) => {
      // Processar gráfico
      if (desp.data_emissao) {
        const mes = desp.data_emissao.substring(0, 7) // YYYY-MM
        const valorAtual = graficoMap.get(mes) || 0
        graficoMap.set(mes, valorAtual + (parseFloat(desp.valor) || 0))
      }

      const deptId = desp.dept_id
      const tipoId = desp.tipo_id

      if (!deptId || !tipoId) return

      // Agrupar departamento
      if (!departamentosMap.has(deptId)) {
        departamentosMap.set(deptId, {
          dept_id: deptId,
          dept_descricao: desp.dept_descricao,
          valor_total: 0,
          qtd_tipos: 0,
          qtd_despesas: 0,
          tipos: [],
        })
      }

      // Agrupar tipo
      const tipoKey = `${deptId}-${tipoId}`
      if (!tiposMap.has(tipoKey)) {
        tiposMap.set(tipoKey, {
          tipo_id: tipoId,
          tipo_descricao: desp.tipo_descricao,
          valor_total: 0,
          qtd_despesas: 0,
          dept_id: deptId,
          despesas: [],
        })
      }

      // Adicionar despesa
      const tipo = tiposMap.get(tipoKey)
      tipo.despesas.push({
        data_despesa: desp.data_emissao,
        descricao_despesa: desp.descricao_despesa,
        fornecedor_id: desp.id_fornecedor,
        numero_nota: desp.numero_nota,
        serie_nota: desp.serie_nota,
        valor: parseFloat(desp.valor || 0),
        usuario: desp.usuario,
        observacao: desp.observacao,
        data_emissao: desp.data_emissao,
      })
      tipo.valor_total += parseFloat(desp.valor || 0)
      tipo.qtd_despesas += 1

      // Atualizar departamento
      const departamento = departamentosMap.get(deptId)
      departamento.valor_total += parseFloat(desp.valor || 0)
      departamento.qtd_despesas += 1
    })
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Adicionar tipos aos departamentos
    tiposMap.forEach((tipo) => {
      const dept = departamentosMap.get(tipo.dept_id)
      if (dept) {
        const tipoJaExiste = dept.tipos.some((t: { tipo_id: number }) => t.tipo_id === tipo.tipo_id)
        if (!tipoJaExiste) {
          dept.tipos.push(tipo)
          dept.qtd_tipos += 1
        }
      }
    })

    // Converter para array e ordenar
    const departamentos = Array.from(departamentosMap.values())
      .sort((a, b) => b.valor_total - a.valor_total)

    // Ordenar tipos dentro de cada departamento
    departamentos.forEach(dept => {
      dept.tipos.sort((a: { valor_total: number }, b: { valor_total: number }) => b.valor_total - a.valor_total)
    })

    // Processar gráfico
    const grafico = Array.from(graficoMap.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => a.mes.localeCompare(b.mes))

    // Calcular totalizadores
    const valorTotal = departamentos.reduce((sum, d) => sum + d.valor_total, 0)
    const qtdRegistros = departamentos.reduce((sum, d) => sum + d.qtd_despesas, 0)
    const qtdDepartamentos = departamentos.length
    const qtdTipos = departamentos.reduce((sum, d) => sum + d.qtd_tipos, 0)
    const mediaDepartamento = qtdDepartamentos > 0 ? valorTotal / qtdDepartamentos : 0

    const response = {
      totalizador: {
        valorTotal,
        qtdRegistros,
        qtdDepartamentos,
        qtdTipos,
        mediaDepartamento,
      },
      grafico,
      departamentos,
    }

    console.log('[API] Resposta:', {
      totalizador: response.totalizador,
      graficoItems: grafico.length,
      departamentosItems: departamentos.length,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Erro geral:', error)
    return safeRpcError(error, 'dre-hierarquia')
  }
}
