export type InteractionLike={id?:string;athlete_user_id?:string;coach_id?:string|null;college_id?:string|null;type?:string|null;date?:string|null;created_at?:string|null;note?:string|null;initiated_by?:string|null;colleges?:any;college_coaches?:any};
export type CoachRelationshipLike={id?:string;athlete_user_id?:string;coach_id?:string|null;college_id?:string|null;last_contact_date?:string|null;next_step?:string|null;colleges?:any;college_coaches?:any};
export type ReminderLike={id?:string;athlete_user_id?:string;coach_id?:string|null;college_id?:string|null;title?:string|null;due_date?:string|null;status?:string|null};

const DAY=86400000;
const lower=(v:any)=>String(v||'').toLowerCase();
const one=(v:any)=>Array.isArray(v)?v[0]:v;
export const daysSince=(value?:string|null)=>{if(!value)return 999;const d=new Date(value.length<=10?`${value}T12:00:00`:value);return Math.max(0,Math.floor((Date.now()-d.getTime())/DAY))};
export const coachName=(r:any)=>{const c=one(r?.college_coaches);return [c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Coach'};
export const collegeName=(r:any)=>one(r?.colleges)?.name||'College';

export function interactionMeaningScore(i:InteractionLike){const t=lower(i.type);const n=lower(i.note);let score=4;
 if(/meeting|visit|camp|clinic|conversation|in person|phone call|call/.test(t))score=12;
 else if(/text|dm|direct message|social/.test(t))score=7;
 else if(/email/.test(t))score=6;
 else if(/questionnaire|form/.test(t))score=5;
 if(/respond|reply|replied|called me|texted me|emailed me|invited|interested|follow up from coach/.test(`${t} ${n}`))score+=5;
 if(/coach/.test(lower(i.initiated_by)))score+=4;
 const age=daysSince(i.date||i.created_at);if(age<=7)score+=4;else if(age<=30)score+=2;
 return Math.min(20,score);
}

export function isMeaningfulContact(i:InteractionLike){return interactionMeaningScore(i)>=9}
export function isCoachResponse(i:InteractionLike){const text=`${lower(i.type)} ${lower(i.note)} ${lower(i.initiated_by)}`;return /coach/.test(lower(i.initiated_by))||/respond|reply|replied|called me|texted me|emailed me|invited|interested/.test(text)}

export type RelationshipInsight={
 id:string;athleteUserId:string;coachId:string|null;collegeId:string|null;coach:string;college:string;score:number;meaningfulContacts:number;totalContacts:number;lastContact:string|null;daysSinceContact:number;cadenceDays:number|null;momentum:'Rising'|'Steady'|'Cooling'|'New';responseSignal:'Coach responding'|'Two-way signals'|'Outbound only'|'No signal yet';nextAction:string;nextStep:string|null;
};

export function buildRelationshipInsights(coaches:CoachRelationshipLike[],interactions:InteractionLike[]){return coaches.map((r:any)=>{const relInts=interactions.filter(i=>i.athlete_user_id===r.athlete_user_id&&((r.coach_id&&i.coach_id===r.coach_id)||(!r.coach_id&&r.college_id&&i.college_id===r.college_id))).sort((a,b)=>String(b.date||b.created_at||'').localeCompare(String(a.date||a.created_at||'')));
 const meaningful=relInts.filter(isMeaningfulContact);const responses=relInts.filter(isCoachResponse);const dates=relInts.map(i=>i.date||i.created_at).filter(Boolean) as string[];const last=dates[0]||r.last_contact_date||null;const age=daysSince(last);
 let cadence:number|null=null;if(dates.length>=2){const gaps=[] as number[];for(let x=0;x<Math.min(dates.length-1,5);x++)gaps.push(Math.max(0,Math.round((new Date(dates[x]).getTime()-new Date(dates[x+1]).getTime())/DAY)));cadence=Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length)}
 const recentPoints=relInts.filter(i=>daysSince(i.date||i.created_at)<=60).reduce((n,i)=>n+interactionMeaningScore(i),0);let score=Math.min(70,recentPoints);score+=Math.min(15,responses.length*5);if(age<=7)score+=15;else if(age<=14)score+=10;else if(age<=30)score+=4;else if(age>45)score-=10;score=Math.max(0,Math.min(100,score));
 const recent30=relInts.filter(i=>daysSince(i.date||i.created_at)<=30).length;const prior30=relInts.filter(i=>{const d=daysSince(i.date||i.created_at);return d>30&&d<=60}).length;let momentum:'Rising'|'Steady'|'Cooling'|'New'='New';if(relInts.length>=2){if(age>21||recent30<prior30)momentum='Cooling';else if(recent30>prior30||responses.some(i=>daysSince(i.date||i.created_at)<=14))momentum='Rising';else momentum='Steady'}
 const responseSignal=responses.length>=2?'Two-way signals':responses.length===1?'Coach responding':relInts.length?'Outbound only':'No signal yet';
 let nextAction=r.next_step||'';if(!nextAction){if(age===999)nextAction='Make the first meaningful contact';else if(age>=14)nextAction=`Reconnect — no contact in ${age} days`;else if(responseSignal==='Outbound only'&&relInts.length>=2)nextAction='Vary the next touchpoint and look for a response';else if(momentum==='Rising')nextAction='Build on the momentum with a specific next step';else nextAction='Keep the relationship warm with a purposeful follow-up'}
 return{id:String(r.id||`${r.athlete_user_id}-${r.coach_id||r.college_id}`),athleteUserId:String(r.athlete_user_id||''),coachId:r.coach_id||null,collegeId:r.college_id||null,coach:coachName(r),college:collegeName(r),score,meaningfulContacts:meaningful.length,totalContacts:relInts.length,lastContact:last,daysSinceContact:age,cadenceDays:cadence,momentum,responseSignal,nextAction,nextStep:r.next_step||null} as RelationshipInsight})}

export function athleteEngagementScore(athleteId:string,relationships:RelationshipInsight[],interactions:InteractionLike[],reminders:ReminderLike[]){const rs=relationships.filter(r=>r.athleteUserId===athleteId);const ints=interactions.filter(i=>i.athlete_user_id===athleteId);const recent=ints.filter(i=>daysSince(i.date||i.created_at)<=30);const meaningful=recent.filter(isMeaningfulContact);const active=rs.filter(r=>r.daysSinceContact<=14);const responses=recent.filter(isCoachResponse);const open=reminders.filter(r=>r.athlete_user_id===athleteId&&['open','overdue','snoozed'].includes(lower(r.status)));const overdue=open.filter(r=>r.due_date&&r.due_date<new Date().toISOString().slice(0,10));let score=0;score+=Math.min(30,recent.length*4);score+=Math.min(25,meaningful.length*6);score+=Math.min(20,active.length*5);score+=Math.min(15,responses.length*5);score+=rs.length?10:0;score-=Math.min(20,overdue.length*5);return Math.max(0,Math.min(100,score))}

export function cadenceLabel(days:number|null){if(days===null)return 'Not enough history';if(days<=7)return `About every ${days} day${days===1?'':'s'}`;if(days<=14)return `About every ${days} days`;return `About every ${days} days`}
export function scoreLabel(score:number){return score>=75?'Strong':score>=50?'Building':score>=25?'Early':'Needs attention'}
