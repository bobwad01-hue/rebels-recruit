import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

const SCOPES={gmail:['https://www.googleapis.com/auth/gmail.compose'],calendar:['https://www.googleapis.com/auth/calendar.events.owned']};
const STATE_COOKIE='rr_google_oauth_state';

export async function GET(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.redirect(new URL('/login',req.url));

  const service=req.nextUrl.searchParams.get('service') as keyof typeof SCOPES;
  if(!service||!SCOPES[service])return NextResponse.redirect(new URL('/settings?google=invalid',req.url));

  const clientId=process.env.GOOGLE_WORKSPACE_CLIENT_ID||process.env.GOOGLE_CLIENT_ID;
  if(!clientId)return NextResponse.redirect(new URL('/settings?google=not-configured',req.url));

  const state=crypto.randomUUID();
  const statePayload=Buffer.from(JSON.stringify({state,service,userId:user.id})).toString('base64url');
  const callback=new URL('/api/google/callback',req.nextUrl.origin).toString();
  const p=new URLSearchParams({
    client_id:clientId,
    redirect_uri:callback,
    response_type:'code',
    access_type:'offline',
    prompt:'consent',
    include_granted_scopes:'false',
    scope:SCOPES[service].join(' '),
    state
  });

  const res=NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
  res.cookies.set(STATE_COOKIE,statePayload,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
  return res;
}
