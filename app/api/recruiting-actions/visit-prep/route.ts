import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

function inferVisitDate(text:string,base:string){
 const raw=String(text||''); const explicit=raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
 if(explicit){const baseYear=new Date(base).getUTCFullYear();let y=explicit[3]?Number(explicit[3]):baseYear;if(y<100)y+=2000;return `${y}-${String(Number(explicit[1])).padStart(2,'0')}-${String(Number(explicit[2])).padStart(2,'0')}`;}
 const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];const lower=raw.toLowerCase();const hit=names.findIndex(n=>new RegExp('\\b'+n+'\\b').test(lower));if(hit<0)return null;
 const d=new Date(base);const current=d.getUTCDay();let add=(hit-current+7)%7;if(add===0)add=7;d.setUTCDate(d.getUTCDate()+add);return d.toISOString().slice(0,10);
}
export async function POST(req:NextRequest){
 const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 let p:any;try{p=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 const interactionId=String(p?.interactionId||'');if(!interactionId)return NextResponse.json({error:'Visit context is missing.'},{status:400});
 const admin=createAdminClient();
 const {data:msg}=await admin.from('gmail_recruiting_messages').select('interaction_id,recruiting_intent,college_id,received_at').eq('athlete_user_id',user.id).eq('interaction_id',interactionId).maybeSingle();
 if(!msg||msg.recruiting_intent!=='visit_confirmation'||!msg.college_id)return NextResponse.json({error:'This visit could not be matched to a school.'},{status:404});
 const today=new Date().toISOString().slice(0,10);
 const {data:existing}=await admin.from('events').select('id').eq('college_id',msg.college_id).eq('type','Campus Visit').gte('date',today).order('date').limit(1).maybeSingle();
 if(existing?.id){await admin.from('athlete_events').upsert({athlete_user_id:user.id,event_id:existing.id,status:'going'},{onConflict:'athlete_user_id,event_id'});return NextResponse.json({ok:true,url:`/events/${existing.id}/prep`});}
 const [{data:interaction},{data:college}]=await Promise.all([
  admin.from('interactions').select('date,email_content,note').eq('id',interactionId).eq('athlete_user_id',user.id).maybeSingle(),
  admin.from('colleges').select('name').eq('id',msg.college_id).maybeSingle()
 ]);
 const base=interaction?.date||String(msg.received_at||'').slice(0,10)||today;const visitDate=inferVisitDate(`${interaction?.email_content||''} ${interaction?.note||''}`,base);
 if(!visitDate)return NextResponse.json({error:'We know this is a confirmed visit, but the visit date was not clear enough to create Visit Prep automatically. Please add the visit date first.'},{status:409});
 const {data:event,error}=await admin.from('events').insert({name:`${college?.name||'College'} Campus Visit`,type:'Campus Visit',date:visitDate,college_id:msg.college_id}).select('id').single();
 if(error||!event)return NextResponse.json({error:'The visit could not be created. Please try again.'},{status:500});
 const {error:attendanceError}=await admin.from('athlete_events').upsert({athlete_user_id:user.id,event_id:event.id,status:'going'},{onConflict:'athlete_user_id,event_id'});
 if(attendanceError){await admin.from('events').delete().eq('id',event.id);return NextResponse.json({error:'The visit could not be added to your recruiting plan. Please try again.'},{status:500});}
 return NextResponse.json({ok:true,url:`/events/${event.id}/prep`});
}