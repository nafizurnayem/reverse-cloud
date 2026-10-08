import { type NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

// 1. Initialize next-intl middleware for language routing
const handleIntl = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip static files and API routes from localization/auth middleware processing
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 2. Handle Supabase session refresh
  let supabaseResponse = handleIntl(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = handleIntl(request)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh auth session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 3. Route Guards
  const isPortalRoute = pathname.includes('/portal')
  const isAdminRoute = pathname.includes('/admin')

  // If trying to access admin or portal without being signed in, redirect to login
  if ((isAdminRoute || isPortalRoute) && !user) {
    const url = request.nextUrl.clone()
    // Extract current locale from path (e.g., /en/admin -> en)
    const locale = pathname.split('/')[1] || 'en'
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}