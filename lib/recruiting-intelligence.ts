export type RecruitingStage='early'|'building'|'active'|'decision';
export type HealthCategory={id:string;label:string;score:number;max:number;status:'strong'|'building'|'attention';detail:string;href:string};
export type HealthProfile={classYear?:number|null;profileComplete?:boolean;fitComplete?:boolean};
export type IntelligenceInput={colleges?:any[];coaches?:any[];interactions?:any[];reminders?:any[];tasks?:any[];events?:any[];healthProfile?:HealthProfile};
export type RecruitingSignal={id:string;kind:'urgent'|'opportunity'|'momentum'|'foundation';title:string;detail:string;priority:number;href?:string};
export type RecruitingHealthFactor={id:string;label:string;impact:number;status:'strong'|'building'|'attention';detail:string;href:string};
export type HealthOpportunity={id:string;title:string;detail:string;points:number;href:string};
const one=(v:any)=>Array.isArray(v)?v[0]:v;
const day=(v?:string|null)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).getTime():null;
const age=(v?:string|null)=>{const d=day(v);return d===null?null:Math.max(0,Math.floor((Date.now()-d)/86400000))};
const exact=(x:any)=>!x.date_precision||x.date_precision==='exact';
const meaningful=(x:any)=>{const t=String(x.type||'').toLowerCase();return !t.includes('video added')&&!t.includes('note')};
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const points=(max:number,ratio:number)=>Math.round(max*clamp(ratio));
const status=(score:number,max:number):HealthCategory['status']=>score/max>=.8?'strong':score/max>=.5?'building':'attention';
export function recruitingStage(classYear?:number|null):RecruitingStage{
 if(!classYear)return 'building'; const now=new Date(),schoolGradYear=now.getMonth()>=6?now.getFullYear()+1:now.getFullYear(),years=classYear-schoolGradYear;
 return years>=3?'early':years===2?'building':years===1?'active':'decision';
}
const stageLabel=(s:RecruitingStage)=>s==='early'?'Foundation':s==='building'?'Building':s==='active'?'Active Recruiting':'Decision';
const weights:Record<RecruitingStage,Record<string,number>>={
 early:{foundation:30,schools:30,relationships:10,follow:10,activity:20},
 building:{foundation:20,schools:25,relationships:20,follow:15,activity:20},
 active:{foundation:10,schools:15,relationships:30,follow:20,activity:25},
 decision:{foundation:5,schools:10,relationships:30,follow:25,activity:30},
};
const thresholds:Record<RecruitingStage,{schools:number;coaches:number;fresh:number;grace:number}> = {
 early:{schools:5,coaches:1,fresh:45,grace:30},building:{schools:7,coaches:3,fresh:30,grace:21},active:{schools:8,coaches:6,fresh:21,grace:14},decision:{schools:6,coaches:6,fresh:14,grace:10},
};
export function buildRecruitingIntelligence(input:IntelligenceInput){
 const colleges=input.colleges||[],coaches=input.coaches||[],interactions=input.interactions||[],reminders=input.reminders||[],tasks=input.tasks||[],events=input.events||[],hp=input.healthProfile||{};
 const stage=recruitingStage(hp.classYear),w=weights[stage],t=thresholds[stage];
 const active=colleges.filter(x=>!x.archived_at&&!String(x.status||'').toLowerCase().includes('stop'));
 const target=active.filter(x=>['Target School','Contacted','Engaged','Interested','Visit/Camp','Offer','Committed'].includes(String(x.status||'')));
 const exactActivity=interactions.filter(x=>exact(x)&&x.date&&meaningful(x));
 const lastExact=exactActivity.map(x=>age(x.date)).filter((x):x is number=>x!==null).sort((a,b)=>a-b)[0]??null;
 const recent30=exactActivity.filter(x=>{const a=age(x.date);return a!==null&&a<=30}).length;
 const openMoves=tasks.filter(x=>String(x.status)!=='completed'),completedMoves=tasks.filter(x=>String(x.status)==='completed');
 const todayValue=day(new Date().toISOString().slice(0,10))!,overdueMoves=openMoves.filter((x:any)=>x.due_date&&day(x.due_date)!<todayValue).length;
 const upcoming=events.filter(x=>x.date&&day(x.date)!==null&&day(x.date)!>=todayValue).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const signals:RecruitingSignal[]=[];
 openMoves.forEach((x:any)=>{const due=day(x.due_date),overdue=due!==null&&due<todayValue,daysUntil=due===null?null:Math.max(0,Math.ceil((due-todayValue)/86400000));if(overdue){signals.push({id:`overdue-${x.id}`,kind:'urgent',title:x.title||'Overdue Next Step',detail:'This Next Step is late. Finish it or choose a new due date so it does not get lost.',priority:115,href:'/game-plan#next-moves'});return}const timing=daysUntil===0?'due today':daysUntil===1?'due tomorrow':daysUntil!==null?`due in ${daysUntil} days`:'ready when you are';signals.push({id:`next-${x.id}`,kind:'opportunity',title:x.title||'Complete your next recruiting step',detail:`This is one of your current Next Steps and is ${timing}.`,priority:daysUntil===0?112:daysUntil===1?110:daysUntil!==null&&daysUntil<=3?108:daysUntil!==null&&daysUntil<=7?104:96,href:'/game-plan#next-moves'})});
 coaches.forEach((r:any)=>{const c=one(r.college_coaches),school=one(r.colleges),days=age(r.last_contact_date),coachName=[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'this coach';if(days!==null&&days>=30)signals.push({id:`cool-${r.id}`,kind:'urgent',title:`Follow up with ${coachName}`,detail:`${school?.name||'School'} · ${days} days since your last recorded contact.`,priority:95,href:c?.id?`/coaches/${c.id}`:'/connections'});else if(days!==null&&days<=14)signals.push({id:`warm-${r.id}`,kind:'momentum',title:`Keep building with ${coachName}`,detail:`${school?.name||'School'} · You have had recent contact.`,priority:72,href:c?.id?`/coaches/${c.id}`:'/connections'})});
 upcoming.slice(0,3).forEach((e:any)=>{const days=Math.ceil((day(e.date)!-Date.now())/86400000);if(days<=14)signals.push({id:`event-${e.id}`,kind:'opportunity',title:`Get ready for ${e.name}`,detail:days<=0?'This event is today.':`This event is in ${days} day${days===1?'':'s'}.`,priority:days<=3?100:80,href:'/events'})});
 if(active.length&&!coaches.length&&stage!=='early')signals.push({id:'coach-foundation',kind:'foundation',title:'Add coaches at your schools',detail:'Add the coaches you may want to contact so you can keep outreach and follow-up organized.',priority:88,href:'/connections'});
 if(!active.length)signals.push({id:'school-foundation',kind:'foundation',title:'Build your school list',detail:'Start with a focused group of schools that fit what matters to you.',priority:90,href:'/discover'});
 const foundationRatio=(hp.profileComplete?0.5:0)+(hp.fitComplete?0.5:0);
 const schoolRatio=clamp((active.length/t.schools)*.45+(target.length/Math.max(2,Math.ceil(t.schools*.6)))*.55);
 const freshCoaches=coaches.filter((x:any)=>{const a=age(x.last_contact_date);return a!==null&&a<=t.fresh}).length;
 const relationshipRatio=stage==='early'?clamp(coaches.length/t.coaches):clamp((coaches.length/t.coaches)*.45+(freshCoaches/Math.max(1,Math.ceil(t.coaches*.6)))*.55);
 const taskTotal=openMoves.length+completedMoves.length; const completionRatio=taskTotal?completedMoves.length/taskTotal:(stage==='early'?1:.5); const followRatio=clamp(completionRatio-(overdueMoves*.15));
 const activityRatio=lastExact===null?0:lastExact<=t.grace?1:lastExact<=t.grace*2?.65:lastExact<=t.grace*3?.3:0;
 const raw=[['foundation','Foundation',foundationRatio,'/profile'],['schools','School Discovery & Fit',schoolRatio,'/connections'],['relationships','Coach Relationships',relationshipRatio,'/connections'],['follow','Follow-Through',followRatio,'/game-plan#next-moves'],['activity','Recent Activity',activityRatio,'/journey']] as const;
 const categories:HealthCategory[]=raw.map(([id,label,ratio,href])=>{const max=w[id],score=points(max,ratio);return{id,label,score,max,status:status(score,max),href,detail:id==='foundation'?`${hp.profileComplete?'Profile complete':'Profile still needs work'} · ${hp.fitComplete?'College Fit Survey complete':'College Fit Survey not complete'}`:id==='schools'?`${active.length} active school${active.length===1?'':'s'} · ${target.length} beyond Researching`:id==='relationships'?`${coaches.length} coach relationship${coaches.length===1?'':'s'} · ${freshCoaches} active within this stage’s window`:id==='follow'?`${completedMoves.length} completed Next Step${completedMoves.length===1?'':'s'} · ${overdueMoves} overdue`:lastExact===null?'No meaningful recruiting activity with a known date yet.':`Last meaningful recruiting activity was ${lastExact} day${lastExact===1?'':'s'} ago.`}});
 const score=categories.reduce((sum,c)=>sum+c.score,0),health=score>=85?'Excellent':score>=70?'Strong':score>=50?'On Track':score>=25?'Building':'Getting Started';
 const ready=true;
 const factors:RecruitingHealthFactor[]=categories.map(c=>({id:c.id,label:c.label,impact:c.score,status:c.status,detail:c.detail,href:c.href}));
 const opportunities:HealthOpportunity[]=[];
 const foundationMax=w.foundation,foundationHalf=Math.round(foundationMax/2);
 if(!hp.profileComplete)opportunities.push({id:'complete-profile',title:'Complete your athlete profile',detail:'Finish the core information coaches and your recruiting team need.',points:foundationHalf,href:'/profile'});
 if(!hp.fitComplete)opportunities.push({id:'complete-fit',title:'Complete your College Fit Survey',detail:'Tell Rebels Recruit what matters to you so school discovery can better reflect your fit.',points:foundationMax-foundationHalf,href:'/fit-profile'});
 const schoolCat=categories.find(c=>c.id==='schools');if(schoolCat&&schoolCat.score<schoolCat.max)opportunities.push({id:'school-fit',title:active.length<t.schools?'Build your focused school list':'Move researched schools forward',detail:active.length<t.schools?'Research and add schools that genuinely fit what you want.':'Use what you learn to identify the schools you want to actively pursue.',points:schoolCat.max-schoolCat.score,href:'/connections'});
 const relationshipCat=categories.find(c=>c.id==='relationships');if(relationshipCat&&relationshipCat.score<relationshipCat.max)opportunities.push({id:'relationships',title:coaches.length<t.coaches?'Build coach relationships':'Reconnect with coaches who need follow-up',detail:coaches.length<t.coaches?'Add the right coaches at priority schools and begin appropriate outreach.':'Keep active relationships current with meaningful, timely follow-up.',points:relationshipCat.max-relationshipCat.score,href:'/connections'});
 const followCat=categories.find(c=>c.id==='follow');if(followCat&&followCat.score<followCat.max)opportunities.push({id:'follow-through',title:overdueMoves?'Close overdue Next Steps':'Complete your current Next Steps',detail:overdueMoves?'Finish or reschedule overdue recruiting work so important follow-through does not stall.':'Follow through on the recruiting actions already in your plan.',points:followCat.max-followCat.score,href:'/game-plan#next-moves'});
 const activityCat=categories.find(c=>c.id==='activity');if(activityCat&&activityCat.score<activityCat.max)opportunities.push({id:'recent-activity',title:'Get your recruiting moving again',detail:'Complete a meaningful recruiting action such as coach outreach, follow-up, event preparation or school research.',points:activityCat.max-activityCat.score,href:'/game-plan'});
 opportunities.sort((a,b)=>b.points-a.points);
 const top=signals.sort((a,b)=>b.priority-a.priority).slice(0,6);
 return {score,health,scoreReady:ready,stage,stageLabel:stageLabel(stage),categories,activeSchools:active.length,targetSchools:target.length,coachRelationships:coaches.length,lastMeaningfulActivityDays:lastExact,openNextMoves:openMoves.length,overdueNextMoves:overdueMoves,upcomingEvents:upcoming.length,signals:top,topPriority:top[0]||null,healthFactors:factors,opportunities:opportunities.slice(0,3),scoreFormula:`Your score is earned from Foundation, School Discovery & Fit, Coach Relationships, Follow-Through and Recent Activity. Expectations adjust for your ${stageLabel(stage).toLowerCase()} stage, and activity points can fade when recruiting activity slows.`};
}
