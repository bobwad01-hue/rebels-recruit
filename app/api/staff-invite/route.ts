import { NextRequest,NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(req:NextRequest){
  const token=req.nextUrl.searchParams.get("token");
  if(!token)return NextResponse.json({error:"Invitation link is invalid."},{status:400});
  const admin=createAdminClient();
  const{data,error}=await admin.from("organization_staff_invites")
    .select("id,email,role,status,organization_view_access,organization:organizations(name,branch_name)")
    .eq("invite_token",token).maybeSingle();
  if(error||!data||data.status!=="pending")return NextResponse.json({error:"This invitation is invalid, cancelled, or has already been used."},{status:404});
  return NextResponse.json({email:data.email,role:data.role,organizationViewAccess:data.organization_view_access,organization:data.organization});
}
