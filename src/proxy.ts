import { updateSession } from '@/lib/supabase/middleware'
import { NextRequest, NextResponse } from 'next/server'
import {
  rateLimiters,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/security/rate-limit'

/**
 * CSRF Protection: Validate Origin header for mutating requests
 * Returns error response if Origin doesn't match Host
 */
function validateCsrf(request: NextRequest): NextResponse | null {
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH']

  if (!mutatingMethods.includes(request.method)) {
    return null // Not a mutating request, skip check
  }

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // If no Origin header (same-origin requests may not include it), allow
  if (!origin) {
    return null
  }

  // Extract hostname from origin (removes protocol and port)
  const originHost = new URL(origin).host

  // Check if origin matches host
  if (originHost !== host) {
    console.warn('[CSRF] Blocked request from mismatched origin:', {
      origin,
      host,
      path: request.nextUrl.pathname,
      method: request.method,
    })

    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Rate Limiting: Check if request should be blocked
 * Applies different limits based on the endpoint
 */
function checkApiRateLimit(request: NextRequest): NextResponse | null {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return null
  }

  const clientIp = getClientIp(request.headers)
  const path = request.nextUrl.pathname

  // Determine which rate limiter to use based on path
  let result

  // Auth-related endpoints: Very strict limits
  if (
    path.includes('/auth/') ||
    path.includes('/users/create') ||
    path.includes('/update-email')
  ) {
    result = rateLimiters.auth(`auth:${clientIp}`)
  }
  // Report endpoints: Moderate limits (heavy operations)
  else if (path.includes('/relatorios/') || path.includes('/dre-')) {
    result = rateLimiters.reports(`reports:${clientIp}`)
  }
  // All other API endpoints: Standard limits
  else {
    result = rateLimiters.standard(`api:${clientIp}`)
  }

  // If rate limit exceeded, return 429 response
  if (!result.success) {
    console.warn('[RateLimit] Blocked request:', {
      ip: clientIp,
      path,
      resetIn: result.resetIn,
    })

    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(result),
          'Retry-After': String(result.resetIn),
        },
      }
    )
  }

  return null
}

export async function proxy(request: NextRequest) {
  // 1. Check CSRF protection for mutating requests
  const csrfError = validateCsrf(request)
  if (csrfError) return csrfError

  // 2. Check rate limiting for API requests
  const rateLimitError = checkApiRateLimit(request)
  if (rateLimitError) return rateLimitError

  // 3. Continue with session management
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
