import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function authorize(req:NextRequest){
 if(req.headers.get('origin')!==new URL(req.url).origin)throw new Error('Same-origin request required');
 const session=await createClient();const {data:{user}}=await session.auth.getUser();
 if(!user)throw new Error('Sign in required');
 const admin=createAdminClient();
 const {data:role,error}=await admin.from('platform_roles').select('user_id').eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 if(error||!role)throw new Error('Super Owner access required');
 return {admin,user};
}
export async function POST(req:NextRequest){
 try{
  const {admin,user}=await authorize(req);
  const body=await req.json();const id=body.college_id,action=body.action;
  if(typeof id!=='string'||!uuid.test(id)||!['inactive_program','excluded','restore'].includes(action))
   return NextResponse.json({error:'Invalid school or action'},{status:400,headers});
  const {data:school,error:schoolError}=await admin.from('colleges').select('id,name').eq('id',id).maybeSingle();
  if(schoolError)throw schoolError;
  if(!school)return NextResponse.json({error:'School not found'},{status:404,headers});
  if(action==='restore'){
   const {error}=await admin.from('college_recruiting_exclusions').delete().eq('college_id',id);
   if(error)throw error;
   const {error:qError}=await admin.from('college_staff_bootstrap_queue').update({status:'review',last_error:'School restored by Super Owner; verify official staff before importing',updated_at:new Date().toISOString()}).eq('college_id',id).eq('status','blocked');
   if(qError)throw qError;
  }else{
   const {error:qError}=await admin.from('college_staff_bootstrap_queue').update({status:'blocked',last_error:action==='inactive_program'?'Program marked inactive by Super Owner':'School excluded from recruiting by Super Owner',updated_at:new Date().toISOString()}).eq('college_id',id).neq('status','processing');
   if(qError)throw qError;
   const {error}=await admin.from('college_recruiting_exclusions').upsert({college_id:id,reason:action,changed_by:user.id,changed_at:new Date().toISOString()},{onConflict:'college_id'});
   if(error)throw error;
  }
  return NextResponse.json({ok:true,name:school.name,action},{headers});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'Could not update school'},{status:403,headers});
 }
}
export async function GET(req:NextRequest){
 try{
  const {admin}=await authorize(req);
  const {data,error}=await admin.from('college_recruiting_exclusions').select('college_id,reason,changed_at,colleges(name,division)').order('changed_at',{ascending:false});
  if(error)throw error;
  return NextResponse.json({schools:data||[]},{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load exclusions'},{status:403,headers});}
}