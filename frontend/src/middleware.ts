import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/saved']
const ADMIN_ROUTES = ['/1235']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  const isAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route))

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdmin && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/saved/:path*', '/1235/:path*'],
}
