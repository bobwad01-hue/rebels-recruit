import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

type ProfileState = {
  app_role: string | null
  profile_completed_at: string | null
}

function profilePath(role:string){return role==='athlete'?'/profile':role==='parent'?'/parent/profile':'/advisors/profile'}
function homePath(role:string){return role==='athlete'?'/dashboard':role==='parent'?'/parent':'/advisors'}
function clientIp(request:Request){return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||null}

async function recordSignupAcceptance(request:Request,userId:string){
  const admin=createAdminClient()
  const{data:docs,error:docsError}=await admin.from('legal_document_versions').select('id,document_type').eq('is_current',true).in('document_type',['terms_of_service','privacy_policy'])
  if(docsError)return false
  const terms=(docs||[]).find((d:any)=>d.document_type==='terms_of_service'),privacy=(docs||[]).find((d:any)=>d.document_type==='privacy_policy')
  if(!terms||!privacy)return false
  const{data:existing}=await admin.from('user_legal_acceptances').select('id').eq('user_id',userId).eq('terms_version_id',terms.id).eq('privacy_version_id',privacy.id).limit(1).maybeSingle()
  if(existing)return true
  const{error}=await admin.from('user_legal_acceptances').insert({user_id:userId,terms_version_id:terms.id,privacy_version_id:privacy.id,acceptance_context:'signup',acceptance_method:'clickwrap',user_agent:request.headers.get('user-agent'),ip_address:clientIp(request)})
  return !error
}
async function recordAgeAttestation(request:Request,userId:string){const admin=createAdminClient();const{data:existing}=await admin.from('user_age_attestations').select('id').eq('user_id',userId).eq('attestation','age_13_or_older').limit(1).maybeSingle();if(existing)return true;const{error}=await admin.from('user_age_attestations').insert({user_id:userId,attestation:'age_13_or_older',context:'signup',user_agent:request.headers.get('user-agent'),ip_address:clientIp(request)});return !error}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const signupRole = requestUrl.searchParams.get('signup_role')
  const legalSignup = requestUrl.searchParams.get('legal_signup') === '1'
  const age13Plus = requestUrl.searchParams.get('age_13_plus') === '1'
  const advisorAccountType=requestUrl.searchParams.get('advisor_account_type')
  const supabase = await createClient()

  if (code) await supabase.auth.exchangeCodeForSession(code)

  if (next === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', requestUrl.origin))
  const passwordAthleteSignup=legalSignup&&user.user_metadata?.app_role==='athlete'&&user.user_metadata?.age_13_plus===true

  if(legalSignup&&signupRole==='athlete'&&!age13Plus){
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/signup?error=age_requirement',requestUrl.origin))
  }
  if(legalSignup&&(age13Plus||passwordAthleteSignup)){
    const ageRecorded=await recordAgeAttestation(request,user.id)
    if(!ageRecorded)return NextResponse.redirect(new URL('/signup?error=age_recording',requestUrl.origin))
  }

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

  if((signupRole==='advisor'||user.user_metadata?.app_role==='advisor')&&!profile?.profile_completed_at){
    const accountType=advisorAccountType||user.user_metadata?.advisor_account_type||'independent'
    await createAdminClient().from('profiles').update({advisor_account_type:accountType,commercial_status:accountType==='independent'?'pending':'not_required'}).eq('id',user.id)
  }

  const {data:accepted,error:acceptError}=await supabase.rpc('has_current_legal_acceptance')
  if(acceptError)return NextResponse.redirect(new URL('/legal/accept?context=existing_account',requestUrl.origin))
  if(!accepted){
    if(legalSignup){
      const recorded=await recordSignupAcceptance(request,user.id)
      if(!recorded)return NextResponse.redirect(new URL('/legal/accept?context=signup',requestUrl.origin))
    }else return NextResponse.redirect(new URL('/legal/accept?context=existing_account',requestUrl.origin))
  }

  // Materialize any verified organization staff invitation for this email.
  // Access is granted only after Supabase has authenticated the exact invited email.
  if(user.email){
    const admin=createAdminClient();
    const email=user.email.trim().toLowerCase();
    const{data:invites}=await admin.from('organization_staff_invites').select('id,organization_id,role,organization_view_access').ilike('email',email).eq('status','pending');
    for(const invite of invites||[]){
      const role=invite.role==='admin'?'admin':'advisor';
      const{error:memberError}=await admin.from('organization_members').upsert({
        organization_id:invite.organization_id,user_id:user.id,role,status:'active',joined_at:new Date().toISOString(),
        organization_view_access:role==='admin'?true:Boolean(invite.organization_view_access),
        organization_view_granted_by:role==='admin'||invite.organization_view_access?user.id:null,
        organization_view_granted_at:role==='admin'||invite.organization_view_access?new Date().toISOString():null
      },{onConflict:'organization_id,user_id'});
      if(!memberError){
        await admin.from('user_roles').upsert({user_id:user.id,role},{onConflict:'user_id,role'});
        await admin.from('organization_staff_invites').update({status:'accepted'}).eq('id',invite.id);
        if(!profile?.profile_completed_at&&profile?.app_role!=='advisor'){
          await admin.from('profiles').update({app_role:'advisor',advisor_account_type:'organization',commercial_status:'not_required'}).eq('id',user.id);
          profile={app_role:'advisor',profile_completed_at:profile?.profile_completed_at??null};
        }
      }
    }
  }

  const {data:platformRole}=await supabase.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle()
  if(platformRole?.role==='super_owner'&&profile?.profile_completed_at)return NextResponse.redirect(new URL('/platform-admin',requestUrl.origin))

  const cookieView=request.headers.get('cookie')?.match(/(?:^|;\\s*)rr-active-view=([^;]+)/)?.[1];const savedView=cookieView?decodeURIComponent(cookieView):null;const{data:roleRows}=await supabase.from('user_roles').select('role').eq('user_id',user.id);const role=savedView&&(roleRows||[]).some((x:any)=>x.role===savedView)?savedView:(profile?.app_role||'athlete')
  if (!profile?.profile_completed_at) {
    return NextResponse.redirect(new URL(profilePath(role), requestUrl.origin))
  }

  return NextResponse.redirect(new URL(homePath(role), requestUrl.origin))
}
