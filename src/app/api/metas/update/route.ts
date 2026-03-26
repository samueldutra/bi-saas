import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeErrorResponse } from '@/lib/api/error-handler'
import { getUserAuthorizedBranchCodes } from '@/lib/authorized-branches'
import { isValidSchema, validateSchemaAccess } from '@/lib/security/validate-schema'
import { isFaturamentoMetasEnabled } from '@/lib/tenant-parameters-server'
import { z } from 'zod'

const updateMetaIndividualSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  metaId: z.union([z.string(), z.number()])
    .transform(val => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      if (isNaN(num) || num <= 0) {
        throw new Error('ID da meta deve ser um número positivo válido')
      }
      return num
    }),
  valorMeta: z.number(),
  metaPercentual: z.number().min(-100).max(1000, 'Meta percentual deve estar entre -100 e 1000'),
})

const updateMetaLoteSchema = z.object({
  schema: z.string().min(1).refine(isValidSchema, 'Schema inválido'),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2100),
  filial_id: z.number().int().positive().optional().nullable(),
})

interface MetaAuthorizationRecord {
  id: number
  filial_id: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { createDirectClient } = await import('@/lib/supabase/admin')
    const directSupabase = createDirectClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const schema =
      typeof body?.schema === 'string'
        ? body.schema
        : null

    if (!schema || !isValidSchema(schema)) {
      return NextResponse.json(
        { error: 'Schema inválido' },
        { status: 400 }
      )
    }

    const hasAccess = await validateSchemaAccess(supabase, user, schema)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authorizedBranchCodes = await getUserAuthorizedBranchCodes(supabase, user.id)

    console.log('[API/METAS/UPDATE] 📥 Request received:', {
      body,
      hasMetaId: body.metaId !== undefined,
      metaIdType: typeof body.metaId,
      metaIdValue: body.metaId
    })

    // Se tem metaId, é atualização individual de meta
    if (body.metaId !== undefined) {
      const validation = updateMetaIndividualSchema.safeParse(body)
      
      console.log('[API/METAS/UPDATE] Validation result:', {
        success: validation.success,
        error: validation.success ? null : validation.error.flatten(),
        data: validation.success ? validation.data : null
      })
      
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Dados inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      const { schema, metaId, valorMeta, metaPercentual } = validation.data

      const { data: metaRecord, error: metaLookupError } = await directSupabase
        .schema(schema as 'public')
        .from('metas_mensais')
        .select('id, filial_id')
        .eq('id', metaId)
        .maybeSingle()

      const typedMetaRecord = metaRecord as MetaAuthorizationRecord | null

      if (metaLookupError) {
        console.error('[API/METAS/UPDATE] Meta lookup error:', metaLookupError)
        return NextResponse.json(
          { error: 'Erro ao validar autorização da meta' },
          { status: 500 }
        )
      }

      if (!typedMetaRecord) {
        return NextResponse.json(
          { error: 'Meta não encontrada' },
          { status: 404 }
        )
      }

      if (
        authorizedBranchCodes !== null &&
        !authorizedBranchCodes.includes(String(typedMetaRecord.filial_id))
      ) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso à meta solicitada' },
          { status: 403 }
        )
      }

      console.log('[API/METAS/UPDATE] Updating individual meta:', { 
        schema, 
        metaId, 
        valorMeta, 
        metaPercentual 
      })

      // Atualizar meta específica usando RPC
      const { data, error } = await directSupabase.rpc('update_meta_mensal', {
        p_schema: schema,
        p_meta_id: metaId,
        p_valor_meta: valorMeta,
        p_meta_percentual: metaPercentual
      })

      console.log('[API/METAS/UPDATE] RPC Response:', { data, error })

      if (error) {
        console.error('[API/METAS/UPDATE] RPC Error:', error)
        return NextResponse.json(
          { error: `Erro ao chamar função: ${error.message}` },
          { status: 500 }
        )
      }

      // A função retorna um JSON com { success, message, data, calculated }
      // Type guard para verificar se é o formato esperado
      if (data && typeof data === 'object' && 'success' in data) {
        const result = data as { success: boolean; message?: string; data?: unknown; calculated?: unknown; error?: string }
        
        if (!result.success) {
          console.error('[API/METAS/UPDATE] Function returned error:', result)
          return NextResponse.json(
            { error: result.error || 'Erro ao atualizar meta' },
            { status: 400 }
          )
        }

        console.log('[API/METAS/UPDATE] Meta updated successfully:', result)

        return NextResponse.json({ 
          message: result.message || 'Meta atualizada com sucesso',
          success: true,
          data: result.data,
          calculated: result.calculated
        })
      }

      // Fallback se o formato for diferente (não deveria acontecer)
      console.log('[API/METAS/UPDATE] Meta updated successfully (fallback):', data)
      return NextResponse.json({ 
        message: 'Meta atualizada com sucesso',
        success: true,
        data
      })
    }

    // Senão, é atualização em lote dos valores realizados
    const validation = updateMetaLoteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const {
      schema: validatedSchema,
      mes,
      ano,
      filial_id
    } = validation.data

    if (authorizedBranchCodes !== null && filial_id) {
      if (!authorizedBranchCodes.includes(String(filial_id))) {
        return NextResponse.json(
          { error: 'Usuário não possui acesso à filial solicitada' },
          { status: 403 }
        )
      }
    }

    const useFaturamentoMetas = await isFaturamentoMetasEnabled(validatedSchema)
    const rpcName = useFaturamentoMetas
      ? 'atualizar_valores_realizados_metas_com_faturamento'
      : 'atualizar_valores_realizados_metas'

    const targetBranchCodes = filial_id
      ? [String(filial_id)]
      : (authorizedBranchCodes ?? [null])

    const normalizedTargets = targetBranchCodes.length > 0
      ? targetBranchCodes
      : [null]

    const rpcResults: unknown[] = []

    for (const branchCode of normalizedTargets) {
      const params: Record<string, number | string> = {
        p_schema: validatedSchema,
        p_mes: mes,
        p_ano: ano
      }

      if (branchCode !== null) {
        params.p_filial_id = Number(branchCode)
      }

      console.log('[API/METAS/UPDATE] Calling RPC with params:', params)

      // @ts-expect-error - Function will exist after migration is applied
      let { data, error } = await supabase.rpc(rpcName, params)

      if (error && useFaturamentoMetas) {
        console.warn('[API/METAS/UPDATE] RPC com faturamento falhou, fallback legado:', error)
        // @ts-expect-error - Function exists in legacy
        const fallback = await supabase.rpc('atualizar_valores_realizados_metas', params)
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('[API/METAS/UPDATE] Error:', error)
        
        // Se a tabela não existe, retornar sucesso silencioso (primeira vez)
        if (error.message && error.message.includes('does not exist')) {
          console.log('[API/METAS/UPDATE] ⚠️ Tabela não existe ainda, ignorando atualização')
          return NextResponse.json({
            message: 'Nenhuma meta para atualizar',
            success: true,
            registros_atualizados: 0
          })
        }

        return safeErrorResponse(error, 'metas-update')
      }

      rpcResults.push(data)
    }

    console.log('[API/METAS/UPDATE] Success:', rpcResults)

    return NextResponse.json(
      rpcResults.length === 1 ? rpcResults[0] : {
        success: true,
        results: rpcResults
      }
    )
  } catch (error) {
    console.error('[API/METAS/UPDATE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
