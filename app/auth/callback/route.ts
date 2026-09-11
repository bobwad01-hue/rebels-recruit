import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type ProfileState = {
  app_role: string | null
  profile_completed_at: string | null
}

function profilePath(role:string){return role==='athlete'?'/profile':role==='parent'?'/parent/profile':'/advisors/profile'}
function homePath(role:string){return role==='athlete'?'/dashboard':role==='parent'?'/parent':'/advisors'}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const signupRole = requestUrl.searchParams.get('signup_role')
  const legalSignup = requestUrl.searchParams.get('legal_signup') === '1'
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

  if (!profile?.profile_completed_at && (signupRole === 'athlete' || signupRole === 'advisor' || signupRole === 'parent') && profile?.app_role !== signupRole) {
    await supabase.from('profiles').update({ app_role: signupRole }).eq('id', user.id)
    profile = { app_role: signupRole, profile_completed_at: profile?.profile_completed_at ?? null }
  }

  const {data:accepted,error:acceptError}=await supabase.rpc('has_current_legal_acceptance')
  if(acceptError)return NextResponse.redirect(new URL('/legal/accept?context=existing_account',requestUrl.origin))
  if(!accepted){
    if(legalSignup){
      const ua=request.headers.get('user-agent')||null
      const {error}=await supabase.rpc('accept_current_legal_documents',{acceptance_context:'signup',acceptance_method:'clickwrap',client_user_agent:ua})
      if(error)return NextResponse.redirect(new URL('/legal/accept?context=signup',requestUrl.origin))
    }else return NextResponse.redirect(new URL('/legal/accept?context=existing_account',requestUrl.origin))
  }

  const role = profile?.app_role || 'athlete'
  if (!profile?.profile_completed_at) {
    return NextResponse.redirect(new URL(profilePath(role), requestUrl.origin))
  }

  return NextResponse.redirect(new URL(homePath(role), requestUrl.origin))
}
