import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const DIVISIONS=["NCAA D1","NCAA D2","NCAA D3","NAIA","JC"];
const MAX_RETRY_BATCH=10;
const reason=(s:string|null)=>{
  const x=(s||"").toLowerCase();
  if(x.includes("institution closed")||x.includes("program discontinued")||x.includes("softball program reported inactive")) return "inactive_program";
  if(x.includes("manual verification:")) return "manual_verification";
  if(x.includes("official source access needs manual verification")) return "source_access";
  if(x.includes("conflicting official coaching sources")||x.includes("staff verification required")) return "staff_conflict";
  if(x.includes("quality gate")) return "quality";
  if(x.includes("timeout")||x.includes("aborted")) return "timeout";
  if(x.includes("staff page not discovered")) return "staff_discovery";
  if(x.includes("softball page not discovered")) return "softball_discovery";
  if(x.includes("404")) return "not_found";
  if(x.includes("403")||x.includes("robots")) return "blocked";
  return "other";
};

async function authorized(req:NextRequest){
  if(req.method==="POST"&&req.headers.get("origin")!==new URL(req.url).origin) return null;
  const session=await createClient();
  const {data:{user}}=await session.auth.getUser();
  if(!user) return null;
  const admin=createAdminClient();
  const {data,error}=await admin.from("platform_roles").select("user_id")
    .eq("user_id",user.id).eq("role","super_owner").maybeSingle();
  return error||!data?null:admin;
}

async function load(admin:ReturnType<typeof createAdminClient>,division:string){
  const {data:schools,error:schoolError}=await admin.from("colleges")
    .select("id,name,division").eq("division",division).order("name");
  if(schoolError) throw schoolError;
  const ids=(schools||[]).map(s=>s.id);
  if(!ids.length) return [];
  const [{data:queue,error:qError},{data:sources,error:sError},{data:verifications,error:vError}]=await Promise.all([
    admin.from("college_staff_bootstrap_queue")
      .select("college_id,status,last_error,attempts,updated_at").in("college_id",ids),
    admin.from("college_softball_sources")
      .select("college_id,staff_url,staff_navigation_url,softball_url").in("college_id",ids),
    admin.from("college_staff_source_verifications")
      .select("college_id,outcome,source_url,head_coach_name,notes,verified_by_user_id,verified_at,recheck_status,recheck_message,rechecked_at")
      .in("college_id",ids)
  ]);
  if(qError||sError||vError) throw qError||sError||vError;
  const bySchool=new Map((schools||[]).map(x=>[x.id,x]));
  const bySource=new Map((sources||[]).map(x=>[x.college_id,x]));
  const byVerification=new Map((verifications||[]).map(x=>[x.college_id,x]));
  return (queue||[]).map(q=>{
    const school=bySchool.get(q.college_id);
    const source=bySource.get(q.college_id);
    return {college_id:q.college_id,name:school?.name||"Unknown college",status:q.status,
      reason:reason(q.last_error),last_error:q.last_error,attempts:q.attempts,
      updated_at:q.updated_at,staff_url:source?.staff_url||null,
      staff_navigation_url:source?.staff_navigation_url||null,
      softball_url:source?.softball_url||null,
      verification:byVerification.get(q.college_id)||null};
  }).sort((a,b)=>a.name.localeCompare(b.name));
}

export async function GET(req:NextRequest){
  const admin=await authorized(req);
  if(!admin) return NextResponse.json({error:"Super Owner access required"},{status:403,headers});
  const division=new URL(req.url).searchParams.get("division")||"NCAA D2";
  if(!DIVISIONS.includes(division)) return NextResponse.json({error:"Invalid division"},{status:400,headers});
  try{
    const rows=await load(admin,division);
    return NextResponse.json({division,exceptions:rows.filter(r=>r.status!=="imported"),
      summary:rows.reduce((a:any,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{})},{headers});
  }catch(e){console.error("College cleanup read failed",e);
    return NextResponse.json({error:"Could not load cleanup queue"},{status:500,headers});
  }
}

export async function POST(req:NextRequest){
  const admin=await authorized(req);
  if(!admin) return NextResponse.json({error:"Super Owner access required"},{status:403,headers});
  const body=await req.json().catch(()=>({}));
  const division=body.division||"NCAA D2";
  if(!DIVISIONS.includes(division)) return NextResponse.json({error:"Invalid division"},{status:400,headers});
  if(body.action!=="requeue_reviews") return NextResponse.json({error:"Unsupported action"},{status:400,headers});
  const group=typeof body.group==="string"?body.group:"all";
  const groups=["all","quality","timeout","staff_discovery","softball_discovery","not_found","other"];
  if(!groups.includes(group)) return NextResponse.json({error:"Invalid error group"},{status:400,headers});
  try{
    const rows=await load(admin,division);
    // Bounded batches protect the live app and prevent a single click from
    // dispatching dozens of costly external fetches.
    // Prefer least-attempted schools so persistent failures do not starve the queue.
    const candidates=rows.filter(r=>r.status==="review"&&r.reason!=="inactive_program"&&r.reason!=="staff_conflict"&&r.reason!=="source_access"&&r.reason!=="manual_verification"&&(group==="all"||r.reason===group))
      .sort((a,b)=>(a.attempts||0)-(b.attempts||0)||a.updated_at.localeCompare(b.updated_at));
    const ids=candidates.slice(0,MAX_RETRY_BATCH).map(r=>r.college_id);
    if(!ids.length) return NextResponse.json({requeued:0,division,group},{headers});
    const {data,error}=await admin.from("college_staff_bootstrap_queue")
      .update({status:"pending",updated_at:new Date().toISOString()})
      .in("college_id",ids).eq("status","review").select("college_id");
    if(error) throw error;
    return NextResponse.json({requeued:data?.length||0,division,group},{headers});
  }catch(e){console.error("College cleanup requeue failed",e);
    return NextResponse.json({error:"Could not requeue review schools"},{status:500,headers});
  }
}
