import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase-admin';
import {syncCalendarSubscription} from '@/lib/calendar-subscriptions';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const db=createAdminClient(),{data,error}=await db.from('calendar_subscriptions').select('*').eq('enabled',true).order('last_synced_at',{ascending:true,nullsFirst:true}).limit(25);
 if(error)return NextResponse.json({error:'Could not load subscriptions.'},{status:500});
 const results=[];for(const sub of data||[]){const r=await syncCalendarSubscription(sub);results.push({id:sub.id,...r});}
 return NextResponse.json({checked:results.length,successful:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results});
}
