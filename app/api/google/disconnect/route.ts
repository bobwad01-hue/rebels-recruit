import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {getGoogleAccessToken} from '@/lib/google-workspace';

type Service='gmail'|'calendar';

export async function POST(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});

  let payload:{service?:string};
  try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  if(payload.service!=='gmail'&&payload.service!=='calendar')return NextResponse.json({error:'Invalid Google service.'},{status:400});
  const service:Service=payload.service;

  try{
    try{
      const {accessToken}=await getGoogleAccessToken(user.id,service);
      await fetch('https://oauth2.googleapis.com/revoke',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({token:accessToken}),
        cache:'no-store'
      });
    }catch{}

    const admin=createAdminClient();
    const {error:deleteError}=await admin.from('google_workspace_tokens').delete().eq('user_id',user.id).eq('service',service);
    if(deleteError)return NextResponse.json({error:'Could not remove the saved Google authorization.'},{status:500});

    const statusUpdate=service==='gmail'
      ?{gmail_connected:false,gmail_scope:null,updated_at:new Date().toISOString()}
      :{calendar_connected:false,calendar_scope:null,updated_at:new Date().toISOString()};
    const {error:statusError}=await c.from('google_workspace_connections').update(statusUpdate).eq('user_id',user.id);
    if(statusError)return NextResponse.json({error:'Google permission was revoked, but connection status could not be updated.'},{status:500});

    return NextResponse.json({ok:true,service});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not disconnect Google.'},{status:500});
  }
}
