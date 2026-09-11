import {performance} from 'node:perf_hooks';

const ATHLETES=100,INTERACTIONS_PER_ATHLETE=500,COACHES_PER_ATHLETE=12,SCHOOLS_PER_ATHLETE=20;
const athletes=Array.from({length:ATHLETES},(_,i)=>({id:`athlete-${i}`,name:`Player ${i}`}));
const schools=athletes.flatMap((a)=>Array.from({length:SCHOOLS_PER_ATHLETE},(_,i)=>({athlete_user_id:a.id,college_id:`school-${i}`,status:i%8===0?'Engaged':'Target'})));
const coaches=athletes.flatMap((a)=>Array.from({length:COACHES_PER_ATHLETE},(_,i)=>({athlete_user_id:a.id,coach_id:`coach-${i}`,college_id:`school-${i%SCHOOLS_PER_ATHLETE}`,last_contact_date:'2026-09-01'})));
const interactions=athletes.flatMap((a)=>Array.from({length:INTERACTIONS_PER_ATHLETE},(_,i)=>({id:`${a.id}-interaction-${i}`,athlete_user_id:a.id,college_id:`school-${i%SCHOOLS_PER_ATHLETE}`,coach_id:`coach-${i%COACHES_PER_ATHLETE}`,type:i%3===0?'Email':'Camp',date:'2026-09-01',date_precision:i%10===0?'month':'exact',note:'Synthetic release scale record'})));

const start=performance.now();
const byAthlete=new Map();for(const row of interactions){const list=byAthlete.get(row.athlete_user_id)||[];list.push(row);byAthlete.set(row.athlete_user_id,list)}
const summary=athletes.map(a=>({id:a.id,interactions:(byAthlete.get(a.id)||[]).length,schools:schools.filter(x=>x.athlete_user_id===a.id).length,coaches:coaches.filter(x=>x.athlete_user_id===a.id).length}));
const aggregateMs=performance.now()-start;
const csvStart=performance.now();
const header='Player,Interactions,Schools,Coaches\n';const csv=header+summary.map(r=>`${r.id},${r.interactions},${r.schools},${r.coaches}`).join('\n');
const csvMs=performance.now()-csvStart;
const memory=Math.round(process.memoryUsage().heapUsed/1024/1024);
console.log(JSON.stringify({athletes:ATHLETES,interactions:interactions.length,coaches:coaches.length,schools:schools.length,aggregateMs:Math.round(aggregateMs),csvMs:Math.round(csvMs),heapMB:memory,csvBytes:Buffer.byteLength(csv)},null,2));
if(summary.some(r=>r.interactions!==INTERACTIONS_PER_ATHLETE))throw new Error('Synthetic interaction count mismatch');
if(aggregateMs>5000)throw new Error(`Synthetic aggregation exceeded 5s budget: ${aggregateMs}ms`);
if(memory>512)throw new Error(`Synthetic smoke test exceeded 512MB heap budget: ${memory}MB`);
