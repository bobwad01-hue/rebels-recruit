import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';

const b64=(input:Buffer|string)=>Buffer.from(input).toString('base64url');

export async function GET(request:Request){
  const clientId=process.env.X_CLIENT_ID;
  const redirectUri=process.env.X_REDIRECT_URI||new URL('/api/social/x/callback',request.url).toString();
  if(!clientId)return NextResponse.redirect(new URL('/social?error=x_config',request.url));
  const state=b64(randomBytes(32));
  const verifier=b64(randomBytes(48));
  const challenge=b64(createHash('sha256').update(verifier).digest());
  const cookieStore=await cookies();
  cookieStore.set('x_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/'});
  cookieStore.set('x_oauth_verifier',verifier,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/'});
  const params=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,scope:'tweet.read users.read follows.read offline.access',state,code_challenge:challenge,code_challenge_method:'S256'});
  return NextResponse.redirect(`https://x.com/i/oauth2/authorize?${params.toString()}`);
}
