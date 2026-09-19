import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

const NEXT:Record<string,Record<string,{state:string;next:string;decision:string;remindDays?:number}>>={
 camp_invitation:{interested:{state:'reply',next:'Reply to coach about the camp',decision:'interested'},cannot_attend:{state:'reply',next:'Thank coach and let them know you cannot attend',decision:'cannot_attend'},decide_later:{state:'deferred',next:'Revisit camp invitation',decision:'decide_later',remindDays:7},registered:{state:'prepare',next:'Prepare for the camp and plan a post-camp follow-up',decision:'registered'},not_registering:{state:'closed',next:'Continue building the relationship',decision:'not_registering'}},
 call_request:{accept:{state:'reply',next:'Reply to coach and confirm the call',decision:'accept'},need_time:{state:'reply',next:'Reply with alternate times for the call',decision:'need_time'},decline:{state:'reply',next:'Thank coach and decline the call',decision:'decline'},scheduled:{state:'prepare',next:'Prepare for the coach call',decision:'scheduled'},completed:{state:'follow_up',next:'Send a thank-you and log key takeaways from the call',decision:'completed'}},
 visit_invitation:{interested:{state:'reply',next:'Reply to coach about the visit',decision:'interested'},cannot_attend:{state:'reply',next:'Thank coach and let them know you cannot attend',decision:'cannot_attend'},decide_later:{state:'deferred',next:'Revisit visit invitation',decision:'decide_later',remindDays:7},scheduled:{state:'prepare',next:'Prepare for the campus visit',decision:'scheduled'},completed:{state:'follow_up',next:'Thank the coach and record visit takeaways',decision:'completed'}},
 schedule_request:{send:{state:'reply',next:'Send your game schedule to the coach',decision:'send'},later:{state:'deferred',next:'Send game schedule',decision:'later',remindDays:3},sent:{state:'waiting',next:'Watch for coach attendance or follow-up',decision:'sent'}},
 event_attendance:{confirm:{state:'reply',next:'Confirm game details with the coach',decision:'confirm'},details_ok:{state:'prepare',next:'Prepare for the coach to attend your game',decision:'details_ok'},completed:{state:'follow_up',next:'Follow up with the coach after the game',decision:'completed'}},
 information_request:{send:{state:'reply',next:'Send the requested information',decision:'send'},later:{state:'deferred',next:'Send requested information',decision:'later',remindDays:3},sent:{state:'waiting',next:'Continue building the relationship',decision:'sent'}},
 questionnaire:{complete:{state:'external',next:'Complete the recruiting questionnaire',decision:'complete'},later:{state:'deferred',next:'Complete recruiting questionnaire',decision:'later',remindDays:3},submitted:{state:'follow_up',next:'Let the coach know the questionnaire is complete',decision:'submitted'}},
 offer_related:{review:{state:'decision',next:'Review the offer with your family and advisor',decision:'review'},discuss:{state:'reply',next:'Ask the coach for a time to discuss the offer',decision:'discuss'},later:{state:'deferred',next:'Revisit the offer conversation',decision:'later',remindDays:2},discussed:{state:'decision',next:'Record the offer details and decide your next step',decision:'discussed'}},
 follow_up:{send:{state:'reply',next:'Send a follow-up to the coach',decision:'send'},later:{state:'deferred',next:'Follow up with the coach',decision:'later',remindDays:3},sent:{state:'closed',next:'Continue building the relationship',decision:'sent'}}
};
export async function POST(req:NextRequest){
 const c=await createClient();const {data:{user}}=await c.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 let p:any;try{p=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 const interactionId=String(p?.interactionId||''),choice=String(p?.choice||'');
 const admin=createAdminClient();
 const {data:msg}=await admin.from('gmail_recruiting_messages').select('id,interaction_id,recruiting_intent,coach_id,college_id').eq('athlete_user_id',user.id).eq('interaction_id',interactionId).maybeSingle();
 if(!msg)return NextResponse.json({error:'Recruiting action not found.'},{status:404});
 const rule=NEXT[msg.recruiting_intent]?.[choice];if(!rule)return NextResponse.json({error:'That action is not available.'},{status:400});
 let due:string|null=null;
 if(rule.remindDays){const d=new Date();d.setDate(d.getDate()+rule.remindDays);due=d.toISOString().slice(0,10);
  await admin.from('reminders').delete().eq('athlete_user_id',user.id).eq('interaction_id',interactionId).eq('reminder_kind','recruiting_action');
  await admin.from('reminders').insert({owner_user_id:user.id,athlete_user_id:user.id,college_id:msg.college_id,coach_id:msg.coach_id,title:rule.next,due_date:due,interaction_id:interactionId,reminder_kind:'recruiting_action'});
 }
 const {error}=await admin.from('gmail_recruiting_messages').update({action_state:rule.state,action_decision:rule.decision,action_updated_at:new Date().toISOString(),next_action:rule.next,action_due_date:due,action_required:true}).eq('id',msg.id);
 if(error)return NextResponse.json({error:'Could not update the recruiting action.'},{status:500});
 await admin.from('athlete_coaches').update({next_step:rule.next}).eq('athlete_user_id',user.id).eq('coach_id',msg.coach_id);
 return NextResponse.json({ok:true,state:rule.state,nextAction:rule.next,dueDate:due});
}