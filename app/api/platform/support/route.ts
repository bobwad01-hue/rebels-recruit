import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export async function GET(req:NextRequest){
 const c=await createClient();const{data:{user}}=await c.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login',req.url));
 const organizationId=String(req.nextUrl.searchParams.get('organizationId')||'');
 const admin=createAdminClient();
 const[{data:platform},{data:org}]=await Promise.all([
  admin.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle(),
  organizationId?admin.from('organizations').select('id,name').eq('id',organizationId).maybeSingle():Promise.resolve({data:null})
 ]);
 if(!platform||!org)return NextResponse.redirect(new URL('/platform-admin',req.url));
 await admin.from('audit_log').insert({organization_id:organizationId,actor_user_id:user.id,action:'platform_support_view_started',entity_type:'organization',entity_id:organizationId,metadata:{organization_name:org.name,mode:'support'}});
 const res=NextResponse.redirect(new URL('/organization/recruiting-board?supportOrg='+encodeURIComponent(organizationId),req.url));
 res.cookies.set('rr-support-org',organizationId,{httpOnly:false,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*4});
 return res;
}