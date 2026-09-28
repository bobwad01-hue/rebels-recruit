import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";

export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get("token");if(!token)return NextResponse.json({error:"Invalid link."},{status:400});
 const admin=createAdminClient();const{data}=await admin.from("organization_join_links").select("id,organization_id,team_id,role,requires_approval,active,organization:organizations(name,branch_name),team:teams(name,age_group)").eq("token",token).eq("active",true).maybeSingle();
 if(!data)return NextResponse.json({error:"This join link is no longer active."},{status:404});return NextResponse.json(data);
}
export async function POST(req:NextRequest){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sign in or create an account first."},{status:401});
 const{token}=await req.json();const admin=createAdminClient();const{data:link}=await admin.from("organization_join_links").select("id,organization_id,team_id,role,requires_approval").eq("token",String(token||"")).eq("active",true).maybeSingle();if(!link)return NextResponse.json({error:"This join link is no longer active."},{status:404});
 if(link.requires_approval){await admin.from("organization_join_requests").upsert({link_id:link.id,organization_id:link.organization_id,team_id:link.team_id,user_id:user.id,role:link.role,status:"pending",requested_at:new Date().toISOString()},{onConflict:"link_id,user_id"});return NextResponse.json({ok:true,pending:true});}
 await admin.from("organization_user_roles").upsert({organization_id:link.organization_id,user_id:user.id,role:link.role,status:"active",granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"organization_id,user_id,role"});
 if(link.team_id)await admin.from("team_user_roles").upsert({team_id:link.team_id,user_id:user.id,role:link.role,status:"active",granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"team_id,user_id,role"});
 await admin.from("user_roles").upsert({user_id:user.id,role:link.role},{onConflict:"user_id,role"});
 return NextResponse.json({ok:true,pending:false,role:link.role});
}