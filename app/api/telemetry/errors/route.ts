import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase-admin';
import {createClient} from '@/lib/supabase-server';

const clean=(value:unknown,max:number)=>String(value||'').replace(/[\r\n\t]+/g,' ').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted]').replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,'[redacted]').replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\b/g,'[redacted]').slice(0,max);
const ALERT_TIMEOUT_MS=3500;

async function deliverWebhook(webhook:string,summary:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ALERT_TIMEOUT_MS);
  try{
    const payload=/discord(?:app)?\.com\/api\/webhooks/i.test(webhook)?{content:summary}:{text:summary};
    const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});
    if(!response.ok)console.error('production error alert webhook failed',{status:response.status});
  }catch(error){console.error('production error alert webhook unavailable',error)}finally{clearTimeout(timer)}
}

async function deliverEmail(summary:string,event:{error_name:string;path:string;error_digest:string|null;release:string|null}){
  const apiKey=process.env.RESEND_API_KEY;
  const to=process.env.PRODUCTION_ERROR_ALERT_EMAIL;
  const from=process.env.PRODUCTION_ERROR_ALERT_FROM;
  if(!apiKey||!to||!from)return false;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ALERT_TIMEOUT_MS);
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:`[Rebels Recruit] ${event.error_name} on ${event.path}`,text:summary,tags:[{name:'source',value:'production-error'}]}),signal:controller.signal,cache:'no-store'});
    if(!response.ok){console.error('production error Resend alert failed',{status:response.status,body:clean(await response.text(),500)});return false}
    return true;
  }catch(error){console.error('production error Resend alert unavailable',error);return false}finally{clearTimeout(timer)}
}

export async function POST(req:NextRequest){
  const c=await createClient();const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({ok:false},{status:401});
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
    if(event.environment==='production'){
      const summary=`Rebels Recruit production error\n${event.error_name}: ${event.error_message}\nPath: ${event.path}\nDigest: ${event.error_digest||'none'}\nRelease: ${event.release||'unknown'}`;
      const emailed=await deliverEmail(summary,event);
      const webhook=process.env.PRODUCTION_ERROR_ALERT_WEBHOOK_URL;
      if(!emailed&&webhook)await deliverWebhook(webhook,summary);
    }
    return NextResponse.json({ok:true});
  }catch(error){
    console.error('production error telemetry failed',error,event);
    return NextResponse.json({ok:false},{status:500});
  }
}
