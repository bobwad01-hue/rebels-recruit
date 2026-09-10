export type WorkflowRole='athlete'|'parent'|'staff';
export type EventWorkflowStep={id:string;title:string;detail:string;status:'done'|'now'|'upcoming';href?:string};

const dayMs=86400000;
const dateOnly=(value?:string|null)=>value?new Date(`${String(value).slice(0,10)}T12:00:00`):null;
export const daysUntilEvent=(date?:string|null)=>{const d=dateOnly(date);if(!d)return null;const today=new Date();today.setHours(12,0,0,0);return Math.ceil((d.getTime()-today.getTime())/dayMs)};
export const recruitingEvent=(event:any)=>/camp|visit|showcase|prospect|recruit/i.test(`${event?.type||''} ${event?.name||''}`);

export function eventWorkflow({event,role='athlete',emailReminder,debrief,athleteId}:{event:any;role?:WorkflowRole;emailReminder?:any;debrief?:any;athleteId?:string}){
 const days=daysUntilEvent(event?.date),past=days!==null&&days<0,today=days===0;
 const contextual=(athletePath:string,parentPath:string,staffPath:string)=>role==='parent'?parentPath:role==='staff'?staffPath:athletePath;
 const prepHref=contextual(`/events/${event.id}/prep`,'/parent/events',athleteId?`/players/${athleteId}`:'/events');
 const relationshipHref=event?.college_id?contextual(`/colleges/${event.college_id}`,`/colleges/${event.college_id}${athleteId?`?athlete=${athleteId}`:''}`,athleteId?`/colleges/${event.college_id}?athlete=${athleteId}`:`/colleges/${event.college_id}`):contextual('/connections','/parent/connections',athleteId?`/players/${athleteId}`:'/advisors/connections');
 const steps:EventWorkflowStep[]=[];
 const beforeDone=Boolean(emailReminder&&String(emailReminder.status||'').toLowerCase()==='completed');
 if(!past){
  steps.push({id:'context',title:role==='parent'?'Help review the school and coach context':'Review the school and coach context',detail:role==='parent'?'Make sure the athlete knows who matters at this event without taking over the outreach.':'Review recent conversations, relationship stage and the coaches you want to prioritize.',status:days!==null&&days<=7?'now':'upcoming',href:relationshipHref});
  steps.push({id:'email',title:role==='parent'?'Check that pre-event coach outreach is covered':'Email coaches before the event',detail:beforeDone?'The pre-event outreach Next Move is complete.':role==='parent'?'Ask whether the athlete has handled the pre-event email. The athlete remains the sender.':'For most camps and visits, 2–5 days beforehand is a strong outreach window.',status:beforeDone?'done':days!==null&&days<=5?'now':'upcoming',href:prepHref});
  steps.push({id:'ready',title:role==='parent'?'Help with logistics and readiness':'Arrive with a simple plan',detail:role==='parent'?'Travel, timing, video/profile readiness and practical details are good parent-support opportunities.':'Know the coaches you want to meet, prepare a few questions and have your recruiting video/profile ready.',status:today?'now':'upcoming',href:prepHref});
 }
 steps.push({id:'debrief',title:role==='parent'?'Encourage a quick debrief':'Capture what happened',detail:debrief?'A post-event debrief has been recorded.':role==='parent'?'Afterward, ask what stood out and encourage the athlete to record meaningful coach interactions.':'Record who you spoke with, what happened and any recruiting signal while it is fresh.',status:debrief?'done':past||today?'now':'upcoming',href:prepHref});
 steps.push({id:'followup',title:role==='parent'?'Support the follow-up plan':'Follow up after the event',detail:role==='parent'?'Help the athlete protect time for thank-you/follow-up communication without writing it for them.':'Use the debrief and relationship context to decide the right thank-you or follow-up.',status:past||today?'now':'upcoming',href:prepHref});
 return {days,past,today,steps,current:steps.find(s=>s.status==='now')||steps.find(s=>s.status==='upcoming')||steps[steps.length-1]};
}
