import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {encryptGoogleToken} from '@/lib/google-token-crypto';

const STATE_COOKIE='rr_google_oauth_state';
const SCOPES={
  gmail:'https://www.googleapis.com/auth/gmail.send',
  calendar:[
    'https://www.googleapis.com/auth/calendar.events.owned',
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
  ].join(' ')
} as const;
type Service=keyof typeof SCOPES;

type StatePayload={state:string;service:Service;userId:string};
type GoogleTokenResponse={access_token?:string;expires_in?:number;refresh_token?:string;scope?:string;token_type?:string;error?:string;error_description?:string};

function redirect(req:NextRequest,code:string){
  const res=NextResponse.redirect(new URL(`/settings?google=${encodeURIComponent(code)}`,req.url));
  res.cookies.set(STATE_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  return res;
}

export async function GET(req:NextRequest){
  try{
    const oauthError=req.nextUrl.searchParams.get('error');
    if(oauthError)return redirect(req,oauthError==='access_denied'?'cancelled':'oauth-error');

    const code=req.nextUrl.searchParams.get('code');
    const returnedState=req.nextUrl.searchParams.get('state');
    const rawState=req.cookies.get(STATE_COOKIE)?.value;
    if(!code||!returnedState||!rawState)return redirect(req,'invalid-state');

    let saved:StatePayload;
    try{saved=JSON.parse(Buffer.from(rawState,'base64url').toString('utf8')) as StatePayload}catch{return redirect(req,'invalid-state')}
    if(saved.state!==returnedState||!SCOPES[saved.service])return redirect(req,'invalid-state');

    const c=await createClient();
    const {data:{user}}=await c.auth.getUser();
    if(!user)return NextResponse.redirect(new URL('/login',req.url));
    if(user.id!==saved.userId)return redirect(req,'invalid-state');

    const clientId=process.env.GOOGLE_WORKSPACE_CLIENT_ID||process.env.GOOGLE_CLIENT_ID;
    const clientSecret=process.env.GOOGLE_WORKSPACE_CLIENT_SECRET||process.env.GOOGLE_CLIENT_SECRET;
    if(!clientId||!clientSecret||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)return redirect(req,'not-configured');

    const callback=new URL('/api/google/callback',req.nextUrl.origin).toString();
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:callback,grant_type:'authorization_code'}),
      cache:'no-store'
    });
    const tokens=await tokenRes.json() as GoogleTokenResponse;
    if(!tokenRes.ok||tokens.error)return redirect(req,'token-exchange-failed');
    if(!tokens.refresh_token)return redirect(req,'refresh-token-missing');

    const encrypted=encryptGoogleToken(tokens.refresh_token);
    const admin=createAdminClient();
    const {error:tokenError}=await admin.from('google_workspace_tokens').upsert({
      user_id:user.id,
      service:saved.service,
      refresh_token_ciphertext:encrypted.ciphertext,
      refresh_token_iv:encrypted.iv,
      refresh_token_tag:encrypted.tag,
      scope:tokens.scope||SCOPES[saved.service],
      updated_at:new Date().toISOString()
    },{onConflict:'user_id,service'});
    if(tokenError)return redirect(req,'token-storage-failed');

    const now=new Date().toISOString();
    const statusUpdate:any={user_id:user.id,connected_at:now,updated_at:now};
    statusUpdate[`${saved.service}_connected`]=true;
    statusUpdate[`${saved.service}_scope`]=tokens.scope||SCOPES[saved.service];
    const {error:statusError}=await c.from('google_workspace_connections').upsert(statusUpdate,{onConflict:'user_id'});
    if(statusError)return redirect(req,'status-update-failed');

    return redirect(req,`${saved.service}-connected`);
  }catch{
    return redirect(req,'connection-failed');
  }
}
