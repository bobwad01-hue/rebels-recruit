import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

  let { data: profile } = await supabase
    .from('profiles')
    .select('app_role,profile_completed_at')
    .eq('id', user.id)
    .single()

  if (!profile?.profile_completed_at && (signupRole === 'athlete' || signupRole === 'advisor') && profile?.app_role !== signupRole) {
    await supabase.from('profiles').update({ app_role: signupRole }).eq('id', user.id)
    profile = { ...profile, app_role: signupRole }
  }

  const role = profile?.app_role || 'athlete'
  if (!profile?.profile_completed_at) {
    return NextResponse.redirect(new URL(role === 'athlete' ? '/profile' : '/advisors/profile', requestUrl.origin))
  }

  return NextResponse.redirect(new URL(role === 'athlete' ? '/dashboard' : '/advisors', requestUrl.origin))
}
