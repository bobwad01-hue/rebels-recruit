export type IntelligenceInput={
  colleges?:any[]; coaches?:any[]; interactions?:any[]; reminders?:any[]; tasks?:any[]; events?:any[];
};
export type RecruitingSignal={id:string;kind:'urgent'|'opportunity'|'momentum'|'foundation';title:string;detail:string;priority:number;href?:string};
export type RecruitingHealthFactor={id:string;label:string;impact:number;status:'strong'|'building'|'attention';detail:string;href:string};
const one=(v:any)=>Array.isArray(v)?v[0]:v;
const day=(v?:string|null)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).getTime():null;
const age=(v?:string|null)=>{const d=day(v);return d===null?null:Math.max(0,Math.floor((Date.now()-d)/86400000))};
const exact=(x:any)=>!x.date_precision||x.date_precision==='exact';
const meaningful=(x:any)=>{const t=String(x.type||'').toLowerCase();return !t.includes('video added')&&!t.includes('note')};
export function buildRecruitingIntelligence(input:IntelligenceInput){
 const colleges=input.colleges||[],coaches=input.coaches||[],interactions=input.interactions||[],reminders=input.reminders||[],tasks=input.tasks||[],events=input.events||[];
 const active=colleges.filter(x=>!x.archived_at&&!String(x.status||'').toLowerCase().includes('stop'));
 const target=active.filter(x=>['Target School','Contacted','Engaged','Interested','Visit/Camp','Offer','Committed'].includes(String(x.status||'')));
 const exactActivity=interactions.filter(x=>exact(x)&&x.date&&meaningful(x));
 const lastExact=exactActivity.map(x=>age(x.date)).filter((x):x is number=>x!==null).sort((a,b)=>a-b)[0]??null;
 const recent30=exactActivity.filter(x=>{const a=age(x.date);return a!==null&&a<=30}).length;
 const openMoves=[...reminders.filter(x=>['open','overdue','snoozed'].includes(String(x.status))),...tasks.filter(x=>String(x.status)!=='completed')];
 const overdueMoves=openMoves.filter((x:any)=>x.due_date&&day(x.due_date)!<day(new Date().toISOString().slice(0,10))!).length;
 const upcoming=events.filter(x=>x.date&&day(x.date)!==null&&day(x.date)!>=day(new Date().toISOString().slice(0,10))!).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const signals:RecruitingSignal[]=[];
 openMoves.forEach((x:any)=>{const a=age(x.due_date);if(x.due_date&&a!==null&&day(x.due_date)!<day(new Date().toISOString().slice(0,10))!)signals.push({id:`overdue-${x.id}`,kind:'urgent',title:x.title||'Overdue Next Move',detail:'This Next Move is overdue and should be completed or rescheduled.',priority:115,href:'/game-plan#next-moves'})});
 coaches.forEach((r:any)=>{const c=one(r.college_coaches),school=one(r.colleges),days=age(r.last_contact_date);if(days!==null&&days>=30)signals.push({id:`cool-${r.id}`,kind:'urgent',title:`Reconnect with ${[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'this coach'}`,detail:`${school?.name||'School'} · ${days} days since the last exact-date contact.`,priority:95,href:c?.id?`/coaches/${c.id}`:'/connections'});else if(days!==null&&days<=14)signals.push({id:`warm-${r.id}`,kind:'momentum',title:`Keep momentum with ${[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'this coach'}`,detail:`${school?.name||'School'} · meaningful contact within the last ${days||1} day${days===1?'':'s'}.`,priority:72,href:c?.id?`/coaches/${c.id}`:'/connections'})});
 upcoming.slice(0,3).forEach((e:any)=>{const days=Math.ceil((day(e.date)!-Date.now())/86400000);if(days<=14)signals.push({id:`event-${e.id}`,kind:'opportunity',title:`Prepare for ${e.name}`,detail:`${days<=0?'Today':`In ${days} day${days===1?'':'s'}`} · use the event to strengthen priority relationships.`,priority:days<=3?100:80,href:'/events'})});
 if(active.length&&!coaches.length)signals.push({id:'coach-foundation',kind:'foundation',title:'Build coach relationships',detail:`You have ${active.length} active school relationship${active.length===1?'':'s'} but no coach relationships yet.`,priority:88,href:'/connections'});
 if(!active.length)signals.push({id:'school-foundation',kind:'foundation',title:'Build your school list',detail:'Start with a focused group of schools that fit your academic, athletic and personal preferences.',priority:90,href:'/discover'});
 const schoolImpact=Math.min(20,target.length*2);
 const relationshipImpact=Math.min(15,coaches.length*2);
 const activityImpact=lastExact===null?-10:lastExact<=7?15:lastExact<=14?10:lastExact<=30?3:-10;
 const urgentCount=signals.filter(s=>s.kind==='urgent').length;
 const urgentImpact=-Math.min(20,urgentCount*5);
 const score=Math.max(0,Math.min(100,50+schoolImpact+relationshipImpact+activityImpact+urgentImpact));
 const health=score>=80?'Strong':score>=60?'Building':score>=40?'Needs attention':'Getting started';
 const factors:RecruitingHealthFactor[]=[
  {id:'schools',label:'School strategy',impact:schoolImpact,status:target.length>=8?'strong':target.length>=3?'building':'attention',detail:target.length?`${target.length} school${target.length===1?'':'s'} are beyond Researching in your current pipeline.`:'Move well-fit schools beyond Researching when they become real targets.',href:'/connections'},
  {id:'relationships',label:'Coach relationships',impact:relationshipImpact,status:coaches.length>=6?'strong':coaches.length>=2?'building':'attention',detail:coaches.length?`${coaches.length} active coach relationship${coaches.length===1?'':'s'} are connected to your recruiting.`:'Add coaches at the schools you are seriously pursuing.',href:'/connections'},
  {id:'activity',label:'Recent recruiting activity',impact:activityImpact,status:lastExact!==null&&lastExact<=14?'strong':lastExact!==null&&lastExact<=30?'building':'attention',detail:lastExact===null?'No exact-date meaningful recruiting activity is recorded yet.':`Last exact-date meaningful activity was ${lastExact} day${lastExact===1?'':'s'} ago; ${recent30} recorded in the last 30 days.`,href:'/journey'},
  {id:'next-moves',label:'Open priorities',impact:urgentImpact,status:overdueMoves===0?'strong':overdueMoves<=2?'building':'attention',detail:overdueMoves?`${overdueMoves} overdue Next Move${overdueMoves===1?' needs':'s need'} attention.`:'No overdue Next Moves are reducing your recruiting health.',href:'/game-plan#next-moves'}
 ];
 const top=signals.sort((a,b)=>b.priority-a.priority).slice(0,6);
 return {score,health,activeSchools:active.length,targetSchools:target.length,coachRelationships:coaches.length,lastMeaningfulActivityDays:lastExact,openNextMoves:openMoves.length,overdueNextMoves:overdueMoves,upcomingEvents:upcoming.length,signals:top,topPriority:top[0]||null,healthFactors:factors,scoreFormula:'50 base + school progress (up to 20) + coach relationships (up to 15) + recent exact-date activity (-10 to +15) - urgent issues (up to 20).'};
}
