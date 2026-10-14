import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

export async function GET(req:NextRequest){
  const session=await createClient();
  const {data:{user}}=await session.auth.getUser();
  if(!user)return NextResponse.json({error:"Super Owner access required"},{status:403,headers});
  const admin=createAdminClient();
  const {data:grant,error:grantError}=await admin.from("platform_roles")
    .select("user_id").eq("user_id",user.id).eq("role","super_owner").maybeSingle();
  if(grantError||!grant)return NextResponse.json({error:"Super Owner access required"},{status:403,headers});
  try{
    const {data:rows,error}=await admin.from("college_coach_contact_recovery_queue")
      .select("coach_id,issue_kind,status,previous_error,last_error,attempts,added_email,added_phone,source_candidate_url,review_note,updated_at")
      .order("created_at",{ascending:true});
    if(error)throw error;
    const queue=rows||[];
    const ids=queue.map(x=>x.coach_id);
    const {data:coaches,error:coachError}=ids.length?await admin.from("college_coaches")
      .select("id,college_id,first_name,last_name,email,phone,official_bio_url,official_source_url")
      .in("id",ids):{data:[],error:null};
    if(coachError)throw coachError;
    const collegeIds=[...new Set((coaches||[]).map(x=>x.college_id))];
    const {data:colleges,error:collegeError}=collegeIds.length?await admin.from("colleges")
      .select("id,name").in("id",collegeIds):{data:[],error:null};
    if(collegeError)throw collegeError;
    const coachById=new Map((coaches||[]).map(c=>[c.id,c]));
    const schoolById=new Map((colleges||[]).map(c=>[c.id,c.name]));
    const cases=queue.map(q=>{
      const c=coachById.get(q.coach_id);
      return {
        coach_id:q.coach_id,
        coach:c?[c.first_name,c.last_name].join(" "):"Unknown coach",
        school:c?schoolById.get(c.college_id)||"Unknown school":"Unknown school",
        issue:q.issue_kind,status:q.status,attempts:q.attempts,
        error:q.last_error||q.previous_error||null,
        source_candidate_url:q.source_candidate_url,
        review_note:q.review_note,
        official_bio_url:c?.official_bio_url||null,
        added_email:q.added_email,added_phone:q.added_phone
      };
    });
    const count=(s:string)=>queue.filter(x=>x.status===s).length;
    return NextResponse.json({
      total:queue.length,retry_total:queue.filter(x=>x.issue_kind!=="broken_link").length,
      pending:count("pending"),processing:count("processing"),
      enriched:count("enriched"),checked:count("checked"),
      error:count("error"),blocked:count("blocked"),needs_review:count("needs_review"),
      added_emails:queue.filter(x=>x.added_email).length,
      added_phones:queue.filter(x=>x.added_phone).length,
      cases
    },{headers});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Could not load recovery status"},{status:500,headers});
  }
}
