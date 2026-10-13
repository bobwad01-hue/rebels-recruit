import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export const dynamic='force-dynamic';

export async function GET(){
 const c=await createClient();
 const {data:{user},error:authError}=await c.auth.getUser();
 if(authError||!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data:role,error:roleError}=await c.from('platform_roles').select('role')
  .eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 if(roleError||!role)return NextResponse.json({error:'Super Owner access required'},{status:403});

 const pendingFeedback=['open','investigating','waiting_on_user'];
 const [sc,cc,fc,s,c,f]=await Promise.all([
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
 const errors=[sc.error,cc.error,fc.error,s.error,c.error,f.error].filter(Boolean);
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
  ...(c.data||[]).map((row:any)=>({
   kind:'contact_conflict',id:String(row.id),title:'Verify contact: '+coachName(row),
   detail:'Conflicting '+String(row.field_name||'contact').replaceAll('_',' '),
   createdAt:row.created_at,url:'/platform-admin/coach-data-review'
  })),
  ...(f.data||[]).map((row:any)=>({
   kind:'feedback',id:String(row.id),
   title:'User feedback: '+({broken:'Problem',confusing:'Confusing',idea:'Idea',other:'Other'} as Record<string,string>)[row.feedback_type],
   detail:String(row.description||'').split('\n')[0].slice(0,140),
   createdAt:row.created_at,url:'/platform-admin/feedback?case='+encodeURIComponent(row.id)
  }))
 ].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,8);
 const counts={coachReviews:(sc.count||0)+(cc.count||0),feedback:fc.count||0};
 return NextResponse.json({counts,total:counts.coachReviews+counts.feedback,items},{
  headers:{'Cache-Control':'private, no-store'}
 });
}
