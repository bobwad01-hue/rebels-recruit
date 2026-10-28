import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase-admin';
import {startGmailWatch} from '@/lib/gmail-inbound';

export const dynamic='force-dynamic';
export const maxDuration=60;

const MAX_WATCH_RENEWALS=25;
const MAX_CATCHUP_SYNCS=6;
const CATCHUP_INTERVAL_MS=20*60*60*1000;

export async function GET(req:NextRequest){
 return NextResponse.json({ok:true,skipped:'gmail-send-only'});
 /*
 const secret=process.env.CRON_SECRET;
 if(!secret)return NextResponse.json({error:'Cron secret is not configured.'},{status:503});
 if(req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!process.env.GOOGLE_GMAIL_PUBSUB_TOPIC)return NextResponse.json({error:'Gmail push topic is not configured.'},{status:503});
 if(!process.env.GMAIL_PUSH_SECRET)return NextResponse.json({error:'Gmail sync secret is not configured.'},{status:503});

 const admin=createAdminClient();
 const {data:connections,error}=await admin.from('google_workspace_connections')
  .select('user_id,gmail_watch_expiration,gmail_last_synced_at')
  .eq('gmail_connected',true)
  .order('gmail_last_synced_at',{ascending:true,nullsFirst:true})
  .limit(500);
 if(error)return NextResponse.json({error:'Could not load Gmail connections.'},{status:500});
 const rows=connections||[];
 if(!rows.length)return NextResponse.json({ok:true,checked:0,readEnabled:0,skippedWithoutReadScope:0,renewed:0,synced:0,failed:0});

 const {data:tokens,error:tokenError}=await admin.from('google_workspace_tokens')
  .select('user_id,scope').eq('service','gmail').in('user_id',rows.map(row=>row.user_id));
 if(tokenError)return NextResponse.json({error:'Could not load Gmail permissions.'},{status:500});
 const readableIds=new Set((tokens||[]).filter(t=>t.scope?.includes('gmail.readonly')).map(t=>t.user_id));
 const readable=rows.filter(row=>readableIds.has(row.user_id));
 const now=Date.now();
 const cutoff=now+48*60*60*1000;
 const expiring=readable.filter(row=>!row.gmail_watch_expiration||new Date(row.gmail_watch_expiration).getTime()<cutoff)
  .sort((a,b)=>(a.gmail_watch_expiration||'').localeCompare(b.gmail_watch_expiration||''))
  .slice(0,MAX_WATCH_RENEWALS);
 const failures:{userId:string;step:string;error:string}[]=[];
 let renewed=0;
 await Promise.all(expiring.map(async row=>{
  try{await startGmailWatch(row.user_id);renewed++}
  catch(e){failures.push({userId:row.user_id,step:'watch',error:e instanceof Error?e.message:'Watch renewal failed'})}
 }));

 const stale=readable.filter(row=>!row.gmail_last_synced_at||now-new Date(row.gmail_last_synced_at).getTime()>CATCHUP_INTERVAL_MS)
  .slice(0,MAX_CATCHUP_SYNCS);
 // Custom production domains bypass Vercel deployment SSO; the deployment URL does not.
 // Keep the sync route's existing shared-secret authentication intact.
 const syncUrl=new URL('/api/google/gmail/sync','https://www.rltnl.com');
 let synced=0,imported=0;
 await Promise.all(stale.map(async row=>{
  try{
   const response=await fetch(syncUrl,{method:'POST',headers:{
    'Content-Type':'application/json',
    'x-gmail-push-user':row.user_id,
    'x-gmail-push-secret':process.env.GMAIL_PUSH_SECRET!
   },cache:'no-store',redirect:'manual'});
   const result=await response.json().catch(()=>({})) as {logged?:number;error?:string};
   if(!response.ok)throw new Error(typeof result.error==='string'?result.error:`Gmail catch-up returned ${response.status}`);
   synced++;imported+=result.logged||0;
  }catch(e){failures.push({userId:row.user_id,step:'catchup',error:e instanceof Error?e.message:'Catch-up sync failed'})}
 }));
 if(failures.length)console.error('Gmail watch/catch-up cron failures',failures);
 const summary={checked:rows.length,readEnabled:readable.length,
  skippedWithoutReadScope:rows.length-readable.length,watchRenewalsAttempted:expiring.length,renewed,
  catchupsAttempted:stale.length,synced,imported,failed:failures.length};
 console.info('Gmail watch cron completed',JSON.stringify(summary));
 return NextResponse.json({ok:failures.length===0,...summary,failures:failures.slice(0,10)});
 */
}
