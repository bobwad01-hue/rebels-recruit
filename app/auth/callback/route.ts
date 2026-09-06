import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type ProfileState = {
  app_role: string | null
  profile_completed_at: string | null
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const signupRole = requestUrl.searchParams.get('signup_role')
  const supabase = await createClient()

  if (code) await supabase.auth.exchangeCodeForSession(code)

  if (next === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', requestUrl.origin))

  const { data } = await supabase
    .from('profiles')
    .select('app_role,profile_completed_at')
    .eq('id', user.id)
    .single()

  let profile: ProfileState | null = data
    ? { app_role: data.app_role ?? null, profile_completed_at: data.profile_completed_at ?? null }
    : null

  if (!profile?.profile_completed_at && (signupRole === 'athlete' || signupRole === 'advisor') && profile?.app_role !== signupRole) {
    await supabase.from('profiles').update({ app_role: signupRole }).eq('id', user.id)
    profile = { app_role: signupRole, profile_completed_at: profile?.profile_completed_at ?? null }
  }

  const role = profile?.app_role || 'athlete'
  if (!profile?.profile_completed_at) {
    return NextResponse.redirect(new URL(role === 'athlete' ? '/profile' : '/advisors/profile', requestUrl.origin))
  }

  return NextResponse.redirect(new URL(role === 'athlete' ? '/dashboard' : '/advisors', requestUrl.origin))
}
