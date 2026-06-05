import { type NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/assistant' || pathname.startsWith('/assistant/')) {
    return NextResponse.next()
  }

  if (pathname === '/demo' || pathname.startsWith('/demo/')) {
    const url = req.nextUrl.clone()
    url.pathname = '/assistant'
    return NextResponse.redirect(url)
  }

  const url = req.nextUrl.clone()
  url.pathname = '/assistant'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|images/).*)',
  ],
}
