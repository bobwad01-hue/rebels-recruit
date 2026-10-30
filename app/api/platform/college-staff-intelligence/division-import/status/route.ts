import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {createClient as sessionClient} from "@/lib/supabase-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const session=await sessionClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
 if(!url||!key)return NextResponse.json({error:"Database unavailable"},{status:500});
 const db=createClient(url,key);
 const {data:grant}=await db.from("platform_roles").select("user_id").eq("user_id",user.id).eq("role","super_owner").maybeSingle();
 if(!grant)return NextResponse.json({error:"Forbidden"},{status:403});
 const division=new URL(req.url).searchParams.get("division");
 if(!["JC","NCAA D3"].includes(division||""))return NextResponse.json({error:"Invalid division"},{status:400});
 const {data,error}=await db.from("college_staff_division_runs").select("*").eq("division",division!).maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json(data||{division,status:"paused"});
}
