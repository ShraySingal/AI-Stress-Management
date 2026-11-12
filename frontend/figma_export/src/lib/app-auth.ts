import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'
import { cookies } from 'next/headers'

const APP_SESSION = 'app-session'
const THIRTY_DAYS = 60 * 60 * 24 * 30

export async function currentAppUser() {
  const token = (await cookies()).get(APP_SESSION)?.value
  if (!token) return null

  const payload = await getPayload({ config })
  const authHeaders = new Headers({ Authorization: `JWT ${token}` })
  const { user } = await payload.auth({ headers: authHeaders })
  if (!user || user.collection !== 'users') return null
  return user
}

export async function loginAppUser(email: string, password: string) {
  const payload = await getPayload({ config })
  const result = await payload.login({
    collection: 'users',
    data: { email, password },
  })
  if (!result.token) throw new Error('Unable to create a secure session.')

  const store = await cookies()
  store.set(APP_SESSION, result.token, {
    httpOnly: true,
    maxAge: THIRTY_DAYS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
  return result.user
}

export async function logoutAppUser() {
  const store = await cookies()
  store.delete(APP_SESSION)
}
