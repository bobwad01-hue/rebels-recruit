import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {decryptGoogleToken} from '@/lib/google-token-crypto';

type Service='gmail'|'calendar';

export async function POST(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});

  let payload:any;
  try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const service=payload?.service as Service;
  if(!['gmail','calendar'].includes(service))return NextResponse.json({error:'Invalid Google service.'},{status:400});

  try{
    const admin=createAdminClient();
    const {data:token,error:loadError}=await admin.from('google_workspace_tokens')
      .select('refresh_token_ciphertext,refresh_token_iv,refresh_token_tag')
      .eq('user_id',user.id)
      .eq('service',service)
      .maybeSingle();
    if(loadError)return NextResponse.json({error:'Could not load the Google connection.'},{status:500});

    if(token){
      try{
        const refreshToken=decryptGoogleToken(token.refresh_token_ciphertext,token.refresh_token_iv,token.refresh_token_tag);
        await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:refreshToken}),cache:'no-store'});
      }catch{}
    }

    const {error:deleteError}=await admin.from('google_workspace_tokens').delete().eq('user_id',user.id).eq('service',service);
    if(deleteError)return NextResponse.json({error:'Could not remove the saved Google authorization.'},{status:500});

    const update:any={updated_at:new Date().toISOString()};
    update[`${service}_connected`]=false;
    update[`${service}_scope`]=null;
    const {error:statusError}=await c.from('google_workspace_connections').update(update).eq('user_id',user.id);
    if(statusError)return NextResponse.json({error:'Google permission was revoked, but connection status could not be updated.'},{status:500});

    return NextResponse.json({ok:true,service});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not disconnect Google.'},{status:500});
  }
}
