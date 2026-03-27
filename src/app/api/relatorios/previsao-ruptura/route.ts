import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { validateSchemaAccess } from '@/lib/security/validate-schema'

// Interfaces
interface Produto {
  id: number
  descricao: string
  filial_id: number
  filial_nome: string
  departamento_id: number
  departamento_nome: string
  curva_abcd: string
  estoque_atual: number
  venda_media_diaria_60d: number
  dias_de_estoque: number
  previsao_ruptura: string
}

interface Departamento {
  departamento_id: number
  departamento_nome: string
  produtos: Produto[]
}

const querySchema = z.object({
  schema: z.string().min(1, 'Schema é obrigatório'),
  filial_ids: z.string().optional(),
  dias_min: z.string().optional().default('1'),
  dias_max: z.string().optional().default('7'),
  curvas: z.string().optional().default('A,B,C'),
  apenas_ativos: z.string().optional().default('true'),
  busca: z.string().optional(),
  tipo_busca: z.enum(['produto', 'departamento']).optional().default('produto'),
  departamento_ids: z.string().optional(),
  setor_ids: z.string().optional(),
  page: z.string().optional().default('1'),
  page_size: z.string().optional().default('50'),
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Parse e validação dos parâmetros
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = querySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const {
      schema,
      filial_ids,
      dias_min,
      dias_max,
      curvas,
      apenas_ativos,
      busca,
      tipo_busca,
      departamento_ids,
      setor_ids,
      page,
      page_size,
    } = validation.data

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)

    // Converter parâmetros
    let filialIdsArray = filial_ids
      ? filial_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
      : null

    if (authorizedBranches !== null) {
      const allowedIds = new Set(authorizedBranches.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id)))

      if (filialIdsArray === null) {
        filialIdsArray = Array.from(allowedIds)
      } else {
        filialIdsArray = filialIdsArray.filter((id) => allowedIds.has(id))
      }

      if (filialIdsArray.length === 0) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso às filiais solicitadas' },
          { status: 403 }
        )
      }
    }

    const departamentoIdsArray = departamento_ids
      ? departamento_ids.split(',').map((id) => parseInt(id.trim(), 10))
      : null

    const setorIdsArray = setor_ids
      ? setor_ids.split(',').map((id) => parseInt(id.trim(), 10))
      : null

    const curvasArray = curvas.split(',').map((c) => c.trim().toUpperCase())

    const diasMinNum = parseInt(dias_min, 10)
    const diasMaxNum = parseInt(dias_max, 10)
    const apenasAtivosBoolean = apenas_ativos === 'true'
    const buscaText = busca?.trim() || null
    const pageNum = parseInt(page, 10)
    const pageSizeNum = Math.min(parseInt(page_size, 10), 10000) // Limite máximo

    console.log('[API/PREVISAO-RUPTURA] Params:', {
      schema,
      filialIdsArray,
      departamentoIdsArray,
      setorIdsArray,
      diasMinNum,
      diasMaxNum,
      curvasArray,
      apenasAtivosBoolean,
      buscaText,
      tipo_busca,
      pageNum,
      pageSizeNum,
    })

    // Chamar RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      'get_previsao_ruptura_report',
      {
        p_schema: schema,
        p_filial_ids: filialIdsArray,
        p_dias_min: diasMinNum,
        p_dias_max: diasMaxNum,
        p_curvas: curvasArray,
        p_apenas_ativos: apenasAtivosBoolean,
        p_busca: buscaText,
        p_tipo_busca: tipo_busca,
        p_departamento_ids: departamentoIdsArray,
        p_setor_ids: setorIdsArray,
        p_page: pageNum,
        p_page_size: pageSizeNum,
      }
    )

    if (error) {
      console.error('[API/PREVISAO-RUPTURA] RPC Error:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar dados' },
        { status: 500 }
      )
    }

    console.log('[API/PREVISAO-RUPTURA] Success:', {
      total_records: data?.total_records,
      page: data?.page,
    })

    // Agrupar produtos por departamento
    const groupedData: Record<string, Departamento> = {}

    if (data?.produtos && Array.isArray(data.produtos)) {
      data.produtos.forEach((produto: Produto) => {
        const deptKey = `${produto.departamento_id || 0}`
        if (!groupedData[deptKey]) {
          groupedData[deptKey] = {
            departamento_id: produto.departamento_id || 0,
            departamento_nome: produto.departamento_nome || 'SEM DEPARTAMENTO',
            produtos: [],
          }
        }
        groupedData[deptKey].produtos.push(produto)
      })
    }

    // Ordenar departamentos alfabeticamente (SEM DEPARTAMENTO no final)
    const sortedDepartamentos = Object.values(groupedData).sort((a, b) => {
      const nameA = a.departamento_nome.toUpperCase()
      const nameB = b.departamento_nome.toUpperCase()
      if (nameA.includes('SEM DEPARTAMENTO')) return 1
      if (nameB.includes('SEM DEPARTAMENTO')) return -1
      return nameA.localeCompare(nameB, 'pt-BR')
    })

    console.log('[API/PREVISAO-RUPTURA] Departamentos:', sortedDepartamentos.length)

    return NextResponse.json({
      total_records: data?.total_records || 0,
      page: data?.page || 1,
      page_size: data?.page_size || pageSizeNum,
      total_pages: data?.total_pages || 1,
      departamentos: sortedDepartamentos,
    })
  } catch (e) {
    const error = e as Error
    console.error('[API/PREVISAO-RUPTURA] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro inesperado' },
      { status: 500 }
    )
  }
}
