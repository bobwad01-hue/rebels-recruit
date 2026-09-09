import {normalizeJourneyStage} from '@/lib/recruiting-journey';
import type {EmailStarterId} from '@/lib/recruiting-email-playbook';
import {daysSince,isCoachResponse} from '@/lib/communication-intelligence';
import {exactInteractionDate} from '@/lib/interaction-dates';

export type ContextualMove={title:string;reason:string;starter:EmailStarterId|null;priority:number};
const lower=(v:any)=>String(v||'').toLowerCase();
const interactionText=(i:any)=>`${lower(i?.type)} ${lower(i?.note)} ${lower(i?.initiated_by)}`;
const dateOnly=(v:any)=>String(v||'').slice(0,10);
const daysUntil=(v:any)=>{if(!v)return 999;const d=new Date(`${dateOnly(v)}T12:00:00`);const now=new Date();now.setHours(12,0,0,0);return Math.ceil((d.getTime()-now.getTime())/86400000)};

export function contextualNextMove(args:{stage?:string|null;interactions?:any[];events?:any[];lastContact?:string|null}) : ContextualMove {
 const stage=normalizeJourneyStage(args.stage),ints=[...(args.interactions||[])].filter(Boolean),exactInts=ints.filter(i=>exactInteractionDate(i)).sort((a,b)=>String(exactInteractionDate(b)||'').localeCompare(String(exactInteractionDate(a)||''))),latest=exactInts[0]||null,text=interactionText(latest),latestDate=exactInteractionDate(latest),age=daysSince(latestDate||args.lastContact||null),events=[...(args.events||[])].filter(Boolean).sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||''))),upcoming=events.find(e=>{const n=daysUntil(e?.date);return n>=0&&n<=10}),recent=events.find(e=>{const n=daysUntil(e?.date);return n<0&&n>=-7});
 if(stage==='Committed')return{title:'Keep your commitment details current',reason:'You are committed, so routine recruiting outreach is no longer the priority.',starter:null,priority:0};
 if(stage==='Offer')return{title:'Follow up on the offer',reason:'An offer is an important milestone. Thank the staff and make sure you understand the next steps.',starter:'offer_followup',priority:100};
 if(recent&&/camp|clinic|visit/.test(lower(recent?.type||recent?.name)))return{title:'Send a post-event thank-you',reason:`You recently attended ${recent?.name||'a recruiting event'}. Follow up while the interaction is fresh.`,starter:/visit/.test(lower(recent?.type||recent?.name))?'visit_followup':'post_camp',priority:96};
 if(latest&&/watched|came to watch|saw me play|in person/.test(text))return{title:'Thank the coach for watching',reason:'Your latest exact-date interaction says the coach watched you. A short thank-you with relevant highlights is a strong next move.',starter:'coach_watched',priority:94};
 if(latest&&isCoachResponse(latest))return{title:'Respond to the coach personally',reason:'Your latest exact-date interaction shows a coach response. Continue the actual conversation instead of sending a generic update.',starter:'coach_response',priority:92};
 if(upcoming&&/camp|clinic|visit/.test(lower(upcoming?.type||upcoming?.name)))return{title:`Email before ${upcoming?.name||'your upcoming event'}`,reason:`This event is coming up in ${daysUntil(upcoming?.date)} day${daysUntil(upcoming?.date)===1?'':'s'}. Let the staff know you will be there.`,starter:/visit/.test(lower(upcoming?.type||upcoming?.name))?'visit_followup':'pre_camp',priority:90};
 if(latest&&/video|skills|hitting|pitching/.test(text))return{title:'Share a focused video update',reason:'Your recent exact-date activity includes a training or video update. Show the staff something specific you are working on.',starter:'new_video',priority:82};
 if(age===999&&ints.length)return{title:'Historical contact is on file',reason:'This relationship has imported or partial-date history, but no exact interaction date is available for recency-based follow-up. Add an exact date only when you actually know it.',starter:null,priority:40};
 if(age===999)return{title:stage==='Researching'?'Decide whether to make first contact':'Make the first meaningful contact',reason:stage==='Researching'?'This school is still in Researching. If it becomes a real target, personalize an introduction before reaching out.':'No recruiting contact is logged yet for this relationship.',starter:stage==='Researching'?null:'introduction',priority:75};
 if(age>=28)return{title:'Send a purposeful monthly update',reason:`It has been ${age} days since the last exact-date contact. Share something meaningful rather than a generic check-in.`,starter:'monthly_update',priority:72};
 if(stage==='Target School'&&age>=14)return{title:'Introduce yourself or send a meaningful update',reason:'This is a Target School and the relationship has been quiet long enough to justify a purposeful touchpoint.',starter:ints.length?'monthly_update':'introduction',priority:68};
 if(stage==='Contacted'&&age>=14)return{title:'Follow up with a useful reason',reason:'You have made contact, but the relationship has been quiet. Use a schedule, video, camp or recruiting-needs update when possible.',starter:'monthly_update',priority:66};
 if(stage==='Visit/Camp')return{title:'Keep the event conversation moving',reason:'This school is in Visit/Camp. Make sure pre-event or post-event communication is logged and current.',starter:upcoming?'pre_camp':'post_camp',priority:64};
 return{title:'Keep the relationship warm with a purposeful touchpoint',reason:'There is recent exact-date activity, so avoid emailing just to email. Wait for a useful update, event, video or question.',starter:null,priority:30};
}
