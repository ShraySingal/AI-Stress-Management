import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

// Payload's default /admin/logout lands on /admin/login, which the Make
// preview iframe auto-login re-authenticates. Route through our logout
// endpoint (clears the session) and land on the site index instead.
export function GET(request: NextRequest) {
  // Next standalone constructs nextUrl from its internal listener. Gatekeeper
  // rewrites Host to the viewer hostname before invoking the Lambda.
  const host = request.headers.get('host')
  const viewerOrigin = host ? `${request.nextUrl.protocol}//${host}` : undefined
  const origin = process.env.FIGMA_PUBLIC_URL || viewerOrigin
  const logoutRedirect = new URL('/', origin).toString()

  // Logout is a collection endpoint, so its path uses the Admins collection slug.
  redirect(`/api/admins/sso/logout?redirect=${encodeURIComponent(logoutRedirect)}`)
}
