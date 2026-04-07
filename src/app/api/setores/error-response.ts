import { NextResponse } from 'next/server'
import type { PostgrestError } from '@supabase/supabase-js'

export function createSetorErrorResponse(
  error: PostgrestError,
  fallbackMessage: string
) {
  if (error.code === '23505') {
    return NextResponse.json(
      {
        error: 'Setor já existente',
        message: 'Já existe um setor com este nome neste schema.',
        code: error.code,
      },
      { status: 409 }
    )
  }

  if (error.code === '23514') {
    return NextResponse.json(
      {
        error: 'Conflito de setor',
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      error: fallbackMessage,
      message: error.message || fallbackMessage,
      details: error.details,
      hint: error.hint,
      code: error.code,
    },
    { status: 500 }
  )
}
