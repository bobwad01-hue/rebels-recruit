import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {startGmailWatch} from '@/lib/gmail-inbound';

export const dynamic='force-dynamic';

// An athlete can repair their own expired Gmail watch without reconnecting
// Google or waiting for the daily cron. No other user's watch can be changed.
export async function POST(){
 return NextResponse.json({error:'Gmail inbox monitoring is temporarily disabled.',sendOnly:true},{status:410});
 /*
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 const admin=createAdminClient();
 const {data:connection}=await admin.from('google_workspace_connections')
  .select('gmail_connected').eq('user_id',user.id).maybeSingle();
 if(!connection?.gmail_connected)return NextResponse.json({error:'Connect Gmail first.'},{status:409});
 const {data:token}=await admin.from('google_workspace_tokens')
  .select('scope').eq('user_id',user.id).eq('service','gmail').maybeSingle();
 if(!token?.scope?.includes('gmail.readonly'))return NextResponse.json({
  error:'Reconnect Gmail to enable incoming coach email monitoring.',reconnectRequired:true
 },{status:409});
 try{
  const result=await startGmailWatch(user.id);
  return NextResponse.json({ok:true,watchExpiration:result.expiration?new Date(Number(result.expiration)).toISOString():null});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'Could not restart Gmail monitoring.'},{status:502});
 }
 */
}
