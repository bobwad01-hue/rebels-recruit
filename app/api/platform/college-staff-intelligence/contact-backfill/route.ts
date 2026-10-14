import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const RUN_KEY="imported_missing_contacts_v1";

async function owner(req:NextRequest){
  if(req.method!=="GET" && req.headers.get("origin")!==new URL(req.url).origin)return null;
  const session=await createClient();
  const {data:{user}}=await session.auth.getUser();
  if(!user)return null;
  const admin=createAdminClient();
  const {data:grant,error}=await admin.from("platform_roles").select("user_id")
    .eq("user_id",user.id).eq("role","super_owner").maybeSingle();
  if(error||!grant)return null;
  return {admin,user};
}

async function state(admin:ReturnType<typeof createAdminClient>){
  const {data:preview,error:previewError}=await admin.rpc("preview_college_coach_contact_backfill");
  if(previewError)throw previewError;
  const {data:run,error:runError}=await admin.from("college_coach_contact_backfill_runs")
    .select("id,status,queued_count,created_at,updated_at,completed_at")
    .eq("run_key",RUN_KEY).maybeSingle();
  if(runError)throw runError;
  if(!run)return {run:null,preview,progress:null};
  const {data:progress,error:progressError}=await admin.rpc("college_coach_contact_backfill_progress",{p_run_id:run.id});
  if(progressError)throw progressError;
  const stats=progress||{};
  if(run.status==="running" && Number(stats.pending||0)===0 && Number(stats.processing||0)===0){
    const now=new Date().toISOString();
    const {error:finishError}=await admin.from("college_coach_contact_backfill_runs")
      .update({status:"completed",completed_at:now,updated_at:now})
      .eq("id",run.id).eq("status","running");
    if(finishError)throw finishError;
    run.status="completed";run.completed_at=now;
  }
  return {run,preview,progress:stats};
}

export async function GET(req:NextRequest){
  const auth=await owner(req);
  if(!auth)return NextResponse.json({error:"Super Owner access required"},{status:403,headers});
  try{return NextResponse.json(await state(auth.admin),{headers});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not load backfill status"},{status:500,headers});}
}

export async function POST(req:NextRequest){
  const auth=await owner(req);
  if(!auth)return NextResponse.json({error:"Super Owner access required"},{status:403,headers});
  const body=await req.json().catch(()=>({}));
  const action=body?.action;
  if(!["start","pause","resume"].includes(action))
    return NextResponse.json({error:"Invalid backfill action"},{status:400,headers});
  try{
    if(action==="start"){
      const {error}=await auth.admin.rpc("start_college_coach_contact_backfill",{p_actor:auth.user.id});
      if(error)throw error;
    }else{
      const next=action==="pause"?"paused":"running";
      const prior=action==="pause"?"running":"paused";
      const {error}=await auth.admin.from("college_coach_contact_backfill_runs")
        .update({status:next,updated_at:new Date().toISOString()})
        .eq("run_key",RUN_KEY).eq("status",prior);
      if(error)throw error;
    }
    return NextResponse.json(await state(auth.admin),{headers});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Backfill action failed"},{status:500,headers});
  }
}
