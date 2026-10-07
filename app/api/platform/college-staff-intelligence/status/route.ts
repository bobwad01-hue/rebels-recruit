import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const dynamic='force-dynamic';
const DIVISIONS=['NCAA D1','NCAA D2','NCAA D3','NAIA','JC'];
export async function GET(req:NextRequest){
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const requested=new URL(req.url).searchParams.get('division')||'all';
 const divisions=requested==='all'?DIVISIONS:DIVISIONS.includes(requested)?[requested]:DIVISIONS;
 const {data:schools}=await s.from('colleges').select('id,division').in('division',divisions);
 const ids=(schools||[]).map((x:any)=>x.id),divisionById=new Map((schools||[]).map((x:any)=>[x.id,x.division]));
 const {data:q}=ids.length?await s.from('college_staff_bootstrap_queue').select('college_id,status,updated_at').in('college_id',ids):{data:[]};
 const {data:sources}=ids.length?await s.from('college_softball_sources').select('college_id,status,last_success_at,updated_at').in('college_id',ids):{data:[]};
 const {data:coaches}=ids.length?await s.from('college_coaches').select('college_id,email,phone,x_url,official_source_url,lifecycle_status').in('college_id',ids).eq('lifecycle_status','active'):{data:[]};
 const build=(division:string)=>{
  const schoolIds=new Set((schools||[]).filter((x:any)=>division==='all'||x.division===division).map((x:any)=>x.id));
  const queue=(q||[]).filter((x:any)=>schoolIds.has(x.college_id)),src=(sources||[]).filter((x:any)=>schoolIds.has(x.college_id)),cs=(coaches||[]).filter((x:any)=>schoolIds.has(x.college_id));
  const counts:any={pending:0,processing:0,imported:0,review:0,blocked:0};let lastActivity:string|null=null;
  for(const x of queue){counts[x.status]=(counts[x.status]||0)+1;if(!lastActivity||x.updated_at>lastActivity)lastActivity=x.updated_at}
  // D1 was completed before expansion queue reuse; source success is authoritative for programs not currently represented in queue.
  const queuedIds=new Set(queue.map((x:any)=>x.college_id));for(const x of src){if(!queuedIds.has(x.college_id)&&x.last_success_at)counts.imported++}
  const total=schoolIds.size,complete=counts.imported+counts.review+counts.blocked;
  const stalled=counts.pending>0&&counts.processing===0&&lastActivity&&Date.now()-new Date(lastActivity).getTime()>10*60_000;
  return {division,total,complete,percent:total?Math.round(complete/total*100):0,coaches:cs.length,email:cs.filter((x:any)=>x.email).length,phone:cs.filter((x:any)=>x.phone).length,twitter:cs.filter((x:any)=>x.x_url).length,lastActivity,state:counts.pending===0&&counts.processing===0?(counts.review>0||counts.blocked>0?'cleanup':complete>=total?'complete':'not started'):stalled?'stalled':'running',...counts};
 };
 const current=build(requested==='all'?'all':requested);return NextResponse.json({...current,divisions:DIVISIONS.map(build)});
}