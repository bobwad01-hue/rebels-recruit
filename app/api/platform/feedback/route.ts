import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export const dynamic='force-dynamic';

async function owner(){
 const c=await createClient();
 const {data:{user},error}=await c.auth.getUser();
 if(error||!user)return {c,user:null};
 const {data:role}=await c.from('platform_roles').select('role')
  .eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 return {c,user:role?user:null};
}

export async function GET(){
 const {c,user}=await owner();
 if(!user)return NextResponse.json({error:'Super Owner access required'},{status:403});
 const {data,error}=await c.from('support_cases')
  .select('id,reporter_user_id,feedback_type,description,diagnostic_snapshot,status,created_at,updated_at,resolved_at,resolution_note,resolved_by_user_id')
  .not('feedback_type','is',null).order('created_at',{ascending:false}).limit(200);
 if(error)return NextResponse.json({error:'Feedback could not be loaded.'},{status:500});

 const caseIds=(data||[]).map((row:any)=>row.id);
 const historyResult=caseIds.length
  ?await c.from('feedback_case_events')
    .select('id,case_id,actor_user_id,event_type,previous_status,new_status,note,occurred_at')
    .in('case_id',caseIds).order('occurred_at',{ascending:false}).limit(5000)
  :{data:[],error:null};
 if(historyResult.error)return NextResponse.json({error:'Feedback history could not be loaded.'},{status:500});

 const history=new Map<string,any[]>();
 for(const event of historyResult.data||[]){
  const events=history.get(event.case_id)||[];
  events.push(event);history.set(event.case_id,events);
 }
 const ids=[...new Set([
  ...(data||[]).flatMap((row:any)=>[row.reporter_user_id,row.resolved_by_user_id]),
  ...(historyResult.data||[]).map((event:any)=>event.actor_user_id)
 ].filter(Boolean))] as string[];
 let names=new Map<string,{full_name:string|null,email:string|null}>();
 if(ids.length){
  const {data:people,error:peopleError}=await c.from('profiles').select('id,full_name,email').in('id',ids);
  if(peopleError)return NextResponse.json({error:'Feedback participant details could not be loaded.'},{status:500});
  names=new Map((people||[]).map((person:any)=>[person.id,{full_name:person.full_name,email:person.email}]));
 }
 const feedback=(data||[]).map((row:any)=>({
  ...row,
  reporter:names.get(row.reporter_user_id)||null,
  resolved_by:row.resolved_by_user_id?names.get(row.resolved_by_user_id)||null:null,
  history:(history.get(row.id)||[]).map((event:any)=>({
   ...event,actor:event.actor_user_id?names.get(event.actor_user_id)||null:null
  }))
 }));
 return NextResponse.json({feedback},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(req:Request){
 const {c,user}=await owner();
 if(!user)return NextResponse.json({error:'Super Owner access required'},{status:403});
 let input:any;
 try{input=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 const id=String(input.id||'');
 const status=String(input.status||'');
 const note=String(input.note||'').trim();
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||!['open','investigating','resolved'].includes(status)){
  return NextResponse.json({error:'Invalid feedback item or status'},{status:400});
 }
 if(note.length>4000)return NextResponse.json({error:'Notes cannot exceed 4000 characters'},{status:400});
 if(status==='resolved'&&note.length<5){
  return NextResponse.json({error:'Add a brief resolution note before resolving feedback.'},{status:400});
 }
 const now=new Date().toISOString();
 const patch:any={
  status,updated_at:now,
  resolved_at:status==='resolved'?now:null,
  resolved_by_user_id:status==='resolved'?user.id:null
 };
 if(status==='open')patch.resolution_note=null;
 else if(note)patch.resolution_note=note;
 const {data,error}=await c.from('support_cases').update(patch).eq('id',id)
  .not('feedback_type','is',null).select('id,status').maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 if(!data)return NextResponse.json({error:'Feedback item not found or access denied'},{status:404});
 return NextResponse.json({ok:true,status:data.status});
}
