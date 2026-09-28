import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";
async function user(){const s=await createClient();const{data:{user}}=await s.auth.getUser();return user}
export async function GET(req:NextRequest){
 const u=await user();if(!u)return NextResponse.json({error:"Please sign in."},{status:401});const teamId=req.nextUrl.searchParams.get("team")||"";const admin=createAdminClient();
 const{data:parentRole}=await admin.from("team_user_roles").select("team_id").eq("team_id",teamId).eq("user_id",u.id).eq("role","parent").eq("status","active").maybeSingle();if(!parentRole)return NextResponse.json({error:"Parent access to this team is required."},{status:403});
 const{data:team}=await admin.from("teams").select("id,name,age_group,organization_id").eq("id",teamId).single();
 const{data:athleteRoles}=await admin.from("team_user_roles").select("user_id").eq("team_id",teamId).eq("role","athlete").eq("status","active");const ids=(athleteRoles||[]).map((x:any)=>x.user_id);
 const{data:profiles}=ids.length?await admin.from("profiles").select("id,full_name").in("id",ids):{data:[]};
 const{data:connections}=await admin.from("parent_guardian_access").select("athlete_user_id,status").eq("parent_user_id",u.id).in("athlete_user_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);
 return NextResponse.json({team,athletes:(profiles||[]).map((p:any)=>({...p,connection:(connections||[]).find((c:any)=>c.athlete_user_id===p.id)?.status||null}))});
}
export async function POST(req:NextRequest){
 const u=await user();if(!u)return NextResponse.json({error:"Please sign in."},{status:401});const{teamId,athleteId}=await req.json();const admin=createAdminClient();
 const{data:parentRole}=await admin.from("team_user_roles").select("team_id").eq("team_id",String(teamId)).eq("user_id",u.id).eq("role","parent").eq("status","active").maybeSingle();
 const{data:athleteRole}=await admin.from("team_user_roles").select("team_id").eq("team_id",String(teamId)).eq("user_id",String(athleteId)).eq("role","athlete").eq("status","active").maybeSingle();
 if(!parentRole||!athleteRole)return NextResponse.json({error:"That athlete is not available for this Parent connection."},{status:403});
 const{data:existing}=await admin.from("parent_guardian_access").select("id,status").eq("parent_user_id",u.id).eq("athlete_user_id",String(athleteId)).maybeSingle();
 if(existing)return NextResponse.json({ok:true,status:existing.status});
 const{error}=await admin.from("parent_guardian_access").insert({parent_user_id:u.id,athlete_user_id:String(athleteId),status:"pending"});if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,status:"pending"});
}