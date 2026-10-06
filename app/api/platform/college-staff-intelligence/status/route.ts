import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const dynamic='force-dynamic';
export async function GET(){
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const {data:q}=await s.from('college_staff_bootstrap_queue').select('status,updated_at');
 const counts:any={pending:0,processing:0,imported:0,review:0,blocked:0};
 let lastActivity:string|null=null;
 for(const x of q||[]){counts[x.status]=(counts[x.status]||0)+1;if(!lastActivity||x.updated_at>lastActivity)lastActivity=x.updated_at}
 const total=(q||[]).length,complete=(counts.imported||0)+(counts.review||0)+(counts.blocked||0);
 const stalled=counts.pending>0&&counts.processing===0&&lastActivity&&Date.now()-new Date(lastActivity).getTime()>10*60_000;
 const {count:coaches}=await s.from('college_coaches').select('*',{count:'exact',head:true}).not('official_source_url','is',null);
 return NextResponse.json({total,complete,percent:total?Math.round(complete/total*100):0,coaches:coaches||0,lastActivity,state:counts.pending===0&&counts.processing===0?'complete':stalled?'stalled':'running',...counts});
}