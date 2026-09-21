import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase-admin';
import {startGmailWatch} from '@/lib/gmail-inbound';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(secret&&req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!process.env.GOOGLE_GMAIL_PUBSUB_TOPIC)return NextResponse.json({error:'Gmail push topic is not configured.'},{status:503});
 const admin=createAdminClient(),cutoff=new Date(Date.now()+48*60*60*1000).toISOString();
 const {data,error}=await admin.from('google_workspace_connections').select('user_id,gmail_watch_expiration').eq('gmail_connected',true).or(`gmail_watch_expiration.is.null,gmail_watch_expiration.lt.${cutoff}`).limit(500);
 if(error)return NextResponse.json({error:'Could not load Gmail connections.'},{status:500});
 let renewed=0;const failures:any[]=[];
 for(const row of data||[]){try{await startGmailWatch(row.user_id);renewed++}catch(e){failures.push({userId:row.user_id,error:e instanceof Error?e.message:'Watch renewal failed'})}}
 return NextResponse.json({ok:failures.length===0,checked:(data||[]).length,renewed,failed:failures.length,failures:failures.slice(0,10)});
}