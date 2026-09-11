export type WorkflowRole='athlete'|'parent'|'staff';
export type EventWorkflowStep={id:string;title:string;detail:string;why?:string;status:'done'|'now'|'upcoming';href?:string;action?:string};

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
  steps.push({id:'context',title:role==='parent'?'Help them know who matters':'Know who you want to connect with',detail:role==='parent'?'Help the athlete review the school and coaches without taking over the outreach.':'Look at recent conversations, your Journey stage and the coaches you want to prioritize.',why:role==='athlete'?'Going in with a plan makes it easier to recognize the right opportunities when the event gets busy.':undefined,status:days!==null&&days<=7?'now':'upcoming',href:relationshipHref,action:role==='parent'?'Review Relationship':'Open School Relationship'});
  steps.push({id:'email',title:role==='parent'?'Make sure pre-event outreach is covered':'Email coaches before the event',detail:beforeDone?'Your pre-event outreach is complete.':role==='parent'?'Ask whether the athlete has handled the pre-event email. The athlete should remain the sender.':'A short email before a camp or visit lets coaches know you will be there and gives them a reason to look for you.',status:beforeDone?'done':days!==null&&days<=5?'now':'upcoming',href:prepHref,action:beforeDone?'Review Event Prep':role==='parent'?'See How You Can Help':'Email Coach'});
  steps.push({id:'ready',title:role==='parent'?'Help with the practical details':'Get ready to show up prepared',detail:role==='parent'?'Travel, timing, video/profile readiness and other practical details are good ways to help.':'Know which coaches you want to meet, have a few questions ready and make sure your recruiting profile or video is easy to share.',status:today?'now':'upcoming',href:prepHref,action:role==='parent'?'Review Event Plan':'Get Ready'});
 }
 steps.push({id:'debrief',title:role==='parent'?'Encourage a quick debrief':'Write down what happened',detail:debrief?'Your event debrief is complete.':role==='parent'?'Afterward, ask what stood out and encourage the athlete to record meaningful coach interactions.':'Record who you spoke with, what stood out and anything a coach said or did that could matter later.',why:role==='athlete'&&!debrief?'Details are easiest to remember right after the event, and they make your next follow-up more personal.':undefined,status:debrief?'done':past||today?'now':'upcoming',href:prepHref,action:debrief?'Review Debrief':role==='parent'?'Review Support Plan':'Add Debrief'});
 steps.push({id:'followup',title:role==='parent'?'Support the follow-up plan':'Follow up after the event',detail:role==='parent'?'Help the athlete make time for a thank-you or follow-up without writing it for them.':'Use what happened at the event to send the right thank-you, follow-up or next message.',why:role==='athlete'?'A thoughtful follow-up helps turn one event into an ongoing coach relationship.':undefined,status:past||today?'now':'upcoming',href:prepHref,action:role==='parent'?'See How You Can Help':'Plan Follow-Up'});
 return {days,past,today,steps,current:steps.find(s=>s.status==='now')||steps.find(s=>s.status==='upcoming')||steps[steps.length-1]};
}
