import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';

export async function GET(){
 const c=await createClient();
 const {data:{user},error:authError}=await c.auth.getUser();
 if(authError||!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data:role,error:roleError}=await c.from('platform_roles').select('role')
  .eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 if(roleError||!role)return NextResponse.json({error:'Super Owner access required'},{status:403});

 const pendingFeedback=['open','investigating','waiting_on_user'];
 const admin=createAdminClient();
 const today=new Date().toISOString().slice(0,10);
 const [sc,cc,fc,s,conflictsRecent,f]=await Promise.all([
  c.from('college_coach_update_suggestions').select('id',{count:'exact',head:true}).eq('status','pending'),
  c.from('college_coach_contact_reviews').select('id',{count:'exact',head:true}).eq('status','pending'),
  c.from('support_cases').select('id',{count:'exact',head:true}).not('feedback_type','is',null).in('status',pendingFeedback),
  c.from('college_coach_update_suggestions').select('id,suggestion_type,created_at,college_coaches(first_name,last_name)')
   .eq('status','pending').order('created_at',{ascending:false}).limit(5),
  c.from('college_coach_contact_reviews').select('id,field_name,created_at,college_coaches(first_name,last_name)')
   .eq('status','pending').order('created_at',{ascending:false}).limit(5),
  c.from('support_cases').select('id,feedback_type,description,created_at,status')
   .not('feedback_type','is',null).in('status',pendingFeedback)
   .order('created_at',{ascending:false}).limit(5)
 ]);
 const [demoCount,demoRecent,followCount,followRecent,orgApprovalCount,advisorApprovalCount,orgRecent,advisorRecent]=await Promise.all([
  admin.from('organization_demo_requests').select('id',{count:'exact',head:true}).eq('status','new'),
  admin.from('organization_demo_requests').select('id,organization_name,full_name,created_at,alert_acknowledged_at')
    .eq('status','new').is('alert_dismissed_at',null).order('created_at',{ascending:false}).limit(5),
  admin.from('organization_demo_requests').select('id',{count:'exact',head:true}).in('status',['contacted','demo_scheduled']).lte('follow_up_at',today),
  admin.from('organization_demo_requests').select('id,organization_name,follow_up_at,created_at,alert_acknowledged_at')
    .in('status',['contacted','demo_scheduled']).lte('follow_up_at',today).is('alert_dismissed_at',null).order('follow_up_at',{ascending:true}).limit(5),
  admin.from('organization_requests').select('id',{count:'exact',head:true}).eq('status','pending'),
  admin.from('profiles').select('id',{count:'exact',head:true}).eq('app_role','advisor').eq('advisor_account_type','independent').eq('commercial_status','pending'),
  admin.from('organization_requests').select('id,organization_name,submitted_at').eq('status','pending').order('submitted_at',{ascending:false}).limit(3),
  admin.from('profiles').select('id,full_name,created_at').eq('app_role','advisor').eq('advisor_account_type','independent').eq('commercial_status','pending').order('created_at',{ascending:false}).limit(3)
 ]);
 const errors=[sc.error,cc.error,fc.error,s.error,conflictsRecent.error,f.error,demoCount.error,demoRecent.error,followCount.error,followRecent.error,orgApprovalCount.error,advisorApprovalCount.error,orgRecent.error,advisorRecent.error].filter(Boolean);
 if(errors.length)return NextResponse.json({error:'Could not load the platform review queues.'},{status:500});
 const one=(v:any)=>Array.isArray(v)?v[0]:v;
 const coachName=(row:any)=>{
  const coach=one(row.college_coaches);
  return [coach?.first_name,coach?.last_name].filter(Boolean).join(' ')||'College coach';
 };
 const items=[
  ...(s.data||[]).map((row:any)=>({
   kind:'coach_review',id:String(row.id),title:'Coach update: '+coachName(row),
   detail:String(row.suggestion_type||'New coach update').replaceAll('_',' '),
   createdAt:row.created_at,url:'/platform-admin/coach-data-review'
  })),
  ...(conflictsRecent.data||[]).map((row:any)=>({
   kind:'contact_conflict',id:String(row.id),title:'Verify contact: '+coachName(row),
   detail:'Conflicting '+String(row.field_name||'contact').replaceAll('_',' '),
   createdAt:row.created_at,url:'/platform-admin/coach-data-review'
  })),
  ...(demoRecent.data||[]).map((row:any)=>({
   kind:'demo_request',id:String(row.id),title:'Demo request: '+row.organization_name,
   detail:row.full_name+' wants to learn about RLTNL Recruiting',
   createdAt:row.created_at,url:'/platform-admin/inquiries?inquiry='+encodeURIComponent(row.id),
   acknowledged:!!row.alert_acknowledged_at
  })),
  ...(followRecent.data||[]).map((row:any)=>({
   kind:'demo_follow_up',id:String(row.id),title:'Follow up: '+row.organization_name,
   detail:'Follow-up due '+row.follow_up_at,
   createdAt:row.created_at,url:'/platform-admin/inquiries?inquiry='+encodeURIComponent(row.id),
   acknowledged:!!row.alert_acknowledged_at
  })),
  ...(orgRecent.data||[]).map((row:any)=>({
   kind:'approval',id:String(row.id),title:'Organization approval: '+row.organization_name,
   detail:'Account access approval waiting',createdAt:row.submitted_at,url:'/platform-admin#pending-approvals'
  })),
  ...(advisorRecent.data||[]).map((row:any)=>({
   kind:'approval',id:String(row.id),title:'Advisor approval: '+(row.full_name||'Independent advisor'),
   detail:'Independent advisor account waiting',createdAt:row.created_at,url:'/platform-admin#pending-approvals'
  })),
  ...(f.data||[]).map((row:any)=>({
   kind:'feedback',id:String(row.id),
   title:'User feedback: '+({broken:'Problem',confusing:'Confusing',idea:'Idea',other:'Other'} as Record<string,string>)[row.feedback_type],
   detail:String(row.description||'').split('\n')[0].slice(0,140),
   createdAt:row.created_at,url:'/platform-admin/feedback?case='+encodeURIComponent(row.id)
  }))
 ].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,8);
 const counts={coachReviews:(sc.count||0)+(cc.count||0),feedback:fc.count||0,demoRequests:demoCount.count||0,followUps:followCount.count||0,approvals:(orgApprovalCount.count||0)+(advisorApprovalCount.count||0)};
 return NextResponse.json({counts,total:Object.values(counts).reduce((a,b)=>a+b,0),items},{
  headers:{'Cache-Control':'private, no-store'}
 });
}
