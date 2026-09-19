import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

const NEXT:Record<string,Record<string,{state:string;next:string;decision:string}>>={
 camp_invitation:{
  interested:{state:'reply',next:'Reply to coach about the camp',decision:'interested'},
  cannot_attend:{state:'reply',next:'Thank coach and let them know you cannot attend',decision:'cannot_attend'},
  decide_later:{state:'deferred',next:'Revisit camp invitation',decision:'decide_later'}
 }
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
 if(choice==='decide_later'){const d=new Date();d.setDate(d.getDate()+7);due=d.toISOString().slice(0,10);
  await admin.from('reminders').delete().eq('athlete_user_id',user.id).eq('interaction_id',interactionId).eq('reminder_kind','recruiting_action');
  await admin.from('reminders').insert({owner_user_id:user.id,athlete_user_id:user.id,college_id:msg.college_id,coach_id:msg.coach_id,title:'Revisit camp invitation',due_date:due,interaction_id:interactionId,reminder_kind:'recruiting_action'});
 }
 const {error}=await admin.from('gmail_recruiting_messages').update({action_state:rule.state,action_decision:rule.decision,action_updated_at:new Date().toISOString(),next_action:rule.next,action_due_date:due,action_required:true}).eq('id',msg.id);
 if(error)return NextResponse.json({error:'Could not update the recruiting action.'},{status:500});
 await admin.from('athlete_coaches').update({next_step:rule.next}).eq('athlete_user_id',user.id).eq('coach_id',msg.coach_id);
 return NextResponse.json({ok:true,state:rule.state,nextAction:rule.next,dueDate:due});
}