import {createAdminClient} from '@/lib/supabase-admin';
import {decryptGoogleToken} from '@/lib/google-token-crypto';

type Service='gmail'|'calendar';
type GoogleTokenResponse={access_token?:string;expires_in?:number;scope?:string;token_type?:string;error?:string;error_description?:string};

export async function getGoogleAccessToken(userId:string,service:Service){
  const clientId=process.env.GOOGLE_WORKSPACE_CLIENT_ID||process.env.GOOGLE_CLIENT_ID;
  const clientSecret=process.env.GOOGLE_WORKSPACE_CLIENT_SECRET||process.env.GOOGLE_CLIENT_SECRET;
  if(!clientId||!clientSecret)throw new Error('Google Workspace OAuth is not configured.');

  const admin=createAdminClient();
  const {data,error}=await admin.from('google_workspace_tokens')
    .select('refresh_token_ciphertext,refresh_token_iv,refresh_token_tag,scope')
    .eq('user_id',userId)
    .eq('service',service)
    .maybeSingle();
  if(error)throw new Error('Could not load the Google connection.');
  if(!data)throw new Error(`${service==='gmail'?'Gmail':'Google Calendar'} is not connected.`);

  const refreshToken=decryptGoogleToken(data.refresh_token_ciphertext,data.refresh_token_iv,data.refresh_token_tag);
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:clientId,
      client_secret:clientSecret,
      refresh_token:refreshToken,
      grant_type:'refresh_token'
    }),
    cache:'no-store'
  });
  const tokens=await tokenRes.json() as GoogleTokenResponse;
  if(!tokenRes.ok||!tokens.access_token){
    throw new Error(tokens.error_description||'Google authorization needs to be refreshed.');
  }
  return {accessToken:tokens.access_token,grantedScopes:data.scope||tokens.scope||''};
}
