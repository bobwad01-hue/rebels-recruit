import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {createClient as sessionClient} from "@/lib/supabase-server";
import {POST as importOne} from "@/app/api/cron/college-softball-staff/route";

export const runtime="nodejs";
export const maxDuration=60;
const allowed=["JC","NCAA D3"];
function db(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
 if(!url||!key)throw new Error("Database service unavailable");
 return createClient(url,key);
}
async function owner(){
 const client=await sessionClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return false;
 const {data}=await db().from("platform_roles").select("user_id").eq("user_id",user.id).eq("role","super_owner").maybeSingle();
 return Boolean(data);
}
export async function GET(req:NextRequest){
 try{
  if(req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`||!process.env.CRON_SECRET)
   return NextResponse.json({error:"Unauthorized"},{status:401});
  const client=db();
  const {data:runs,error}=await client.from("college_staff_division_runs").select("division,status,updated_at").eq("status","running").order("updated_at");
  if(error)throw error;
  for(const run of runs||[]){
   const division=run.division;
   // Recover abandoned claims only after the worker's stale threshold.
   const stale=new Date(Date.now()-10*60_000).toISOString();
   await client.from("college_staff_bootstrap_queue").update({status:"pending",updated_at:new Date().toISOString()})
     .eq("status","processing").lt("updated_at",stale);
   const {data:pending,error:pendingError}=await client.from("college_staff_bootstrap_queue")
     .select("college_id,colleges!inner(division)").eq("status","pending").eq("colleges.division",division).limit(1);
   if(pendingError)throw pendingError;
   if(!pending?.length){
    // Retry transient timeouts and 5xx errors once; never retry 403,
    // identity conflicts, or quality gates automatically.
    const {data:retry,error:retryError}=await client.from("college_staff_bootstrap_queue")
     .select("college_id,attempts,last_error,colleges!inner(division)")
     .eq("status","review").eq("colleges.division",division).lt("attempts",2).limit(100);
    if(retryError)throw retryError;
    const candidate=(retry||[]).find((x:any)=>/timeout|timed out|aborted|\b5\d\d\b|network|fetch failed/i.test(x.last_error||""));
    if(candidate){
     await client.from("college_staff_bootstrap_queue").update({status:"pending",updated_at:new Date().toISOString()})
      .eq("college_id",candidate.college_id).eq("status","review");
    }else{
     await client.from("college_staff_division_runs").update({status:"completed",updated_at:new Date().toISOString()}).eq("division",division);
     continue;
    }
   }
   const internal=new NextRequest(new URL("/api/cron/college-softball-staff",req.url),{
    method:"POST",headers:{authorization:`Bearer ${process.env.CRON_SECRET}`,"content-type":"application/json"},
    body:JSON.stringify({bootstrap:true,division,limit:1})
   });
   const response=await importOne(internal);
   const result=await response.json().catch(()=>({}));
   await client.from("college_staff_division_runs").update({
    updated_at:new Date().toISOString(),last_error:response.ok?null:(result.error||"Worker request failed")
   }).eq("division",division);
   return NextResponse.json({division,processed:result.processed||0,result,status:response.status});
  }
  return NextResponse.json({processed:0,message:"No active division import"});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:"Scheduled import failed"},{status:500});
 }
}
export async function POST(req:NextRequest){
 try{
  if(!await owner())return NextResponse.json({error:"Super Owner access required"},{status:403});
  const body=await req.json();
  const division=String(body.division||"");
  const action=String(body.action||"");
  if(!allowed.includes(division)||!["start","pause","resume"].includes(action))
   return NextResponse.json({error:"Invalid division or action"},{status:400});
  const client=db();
  let added=0;
  if(action==="start"||action==="resume"){
   const {data,error}=await client.rpc("queue_college_staff_division",{p_division:division});
   if(error)throw error;
   added=Number(data||0);
  }
  const {error}=await client.from("college_staff_division_runs").upsert({
   division,status:action==="pause"?"paused":"running",
   updated_at:new Date().toISOString(),
   ...(action==="start"?{started_at:new Date().toISOString(),last_error:null}:{})
  },{onConflict:"division"});
  if(error)throw error;
  return NextResponse.json({division,action,added});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not update import"},{status:500});}
}
