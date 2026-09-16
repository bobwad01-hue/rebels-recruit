import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase-admin';

const clean=(value:unknown,max:number)=>String(value||'').replace(/[\r\n\t]+/g,' ').slice(0,max);
const ALERT_TIMEOUT_MS=3500;

async function deliverAlert(webhook:string,summary:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ALERT_TIMEOUT_MS);
  try{
    const payload=/discord(?:app)?\.com\/api\/webhooks/i.test(webhook)?{content:summary}:{text:summary};
    const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});
    if(!response.ok)console.error('production error alert webhook failed',{status:response.status});
  }catch(error){console.error('production error alert webhook unavailable',error)}finally{clearTimeout(timer)}
}

export async function POST(req:NextRequest){
  let body:any;
  try{body=await req.json()}catch{return NextResponse.json({ok:false},{status:400})}
  const event={
    environment:clean(process.env.VERCEL_ENV||process.env.NODE_ENV||'unknown',40),
    source:clean(body?.source||'client',40),
    path:clean(body?.path||'unknown',500),
    error_name:clean(body?.name||'Error',120),
    error_message:clean(body?.message||'Unknown application error',1000),
    error_digest:clean(body?.digest||'',160)||null,
    user_agent:clean(req.headers.get('user-agent')||'',500)||null,
    release:clean(process.env.VERCEL_GIT_COMMIT_SHA||'',80)||null,
    metadata:{online:body?.online!==false},
  };
  try{
    const admin=createAdminClient();
    const {error}=await admin.from('production_error_events').insert(event);
    if(error)throw error;
    const webhook=process.env.PRODUCTION_ERROR_ALERT_WEBHOOK_URL;
    if(webhook&&event.environment==='production'){
      const summary=`Rebels Recruit production error\n${event.error_name}: ${event.error_message}\nPath: ${event.path}\nDigest: ${event.error_digest||'none'}\nRelease: ${event.release||'unknown'}`;
      await deliverAlert(webhook,summary);
    }
    return NextResponse.json({ok:true});
  }catch(error){
    console.error('production error telemetry failed',error,event);
    return NextResponse.json({ok:false},{status:500});
  }
}
