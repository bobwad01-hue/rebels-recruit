export type RelationshipInteraction={type?:string|null;initiated_by?:string|null;date?:string|null;created_at?:string|null};

export type RelationshipMomentum='New'|'Growing'|'Steady'|'Cooling'|'Stalled';
export type RelationshipStrength={
 score:number;label:string;points:number;coachInitiated:number;athleteInitiated:number;meaningful:number;total:number;
 reasons:string[];momentum:RelationshipMomentum;confidence:'Low'|'Medium'|'High';lastActivityDays:number|null;
 recent30:number;previous30:number;twoWay:boolean;
};

const meaningfulTypes=new Set(['Email Received','Text','Phone Call','Video Call','X/Twitter DM','Instagram DM','Questionnaire','College Camp','Campus Visit','Tournament Interaction','Coach Watched Game','Coach Contacted Me']);
const highValueTypes=new Set(['Phone Call','Video Call','College Camp','Campus Visit','Coach Watched Game','Coach Contacted Me']);

function weight(type:string,initiated:string){
 const coach=initiated==='Coach';
 switch(type){
  case 'Campus Visit':return 6;
  case 'Coach Contacted Me':return 5.5;
  case 'Phone Call':return coach?5:3.5;
  case 'Video Call':return coach?5:3.5;
  case 'College Camp':return 4;
  case 'Coach Watched Game':return 4;
  case 'Email Received':return 3.25;
  case 'Text':return coach?3.75:2.25;
  case 'Questionnaire':return 2.75;
  case 'Tournament Interaction':return 3;
  case 'X/Twitter DM':
  case 'Instagram DM':return coach?2.75:1.5;
  case 'Coach Followed Me':return 1.5;
  case 'Coach Commented':return 1.25;
  case 'Coach Liked Post':return .5;
  case 'Email Sent':return 1;
  case 'Thank You Message':return .75;
  default:return .5;
 }
}
const dateMs=(v?:string|null)=>{if(!v)return null;const d=new Date(String(v).length<=10?`${v}T12:00:00`:v);const n=d.getTime();return Number.isFinite(n)?n:null};
const daysAgo=(v?:string|null)=>{const n=dateMs(v);return n===null?null:Math.max(0,Math.floor((Date.now()-n)/86400000))};

export function calculateRelationshipStrength(interactions:RelationshipInteraction[],lastContact?:string|null):RelationshipStrength{
 const rows=interactions||[];
 const dated=rows.map(i=>({i,days:daysAgo(i.date||i.created_at)})).filter(x=>x.days!==null) as {i:RelationshipInteraction;days:number}[];
 const lastInteraction=dated.length?Math.min(...dated.map(x=>x.days)):null;
 const lastContactDays=daysAgo(lastContact);
 const lastActivityDays=[lastInteraction,lastContactDays].filter((x):x is number=>x!==null).sort((a,b)=>a-b)[0]??null;
 if(!rows.length&&!lastContact)return {score:1,label:'Early',points:0,coachInitiated:0,athleteInitiated:0,meaningful:0,total:0,reasons:['No interactions logged yet'],momentum:'New',confidence:'Low',lastActivityDays:null,recent30:0,previous30:0,twoWay:false};

 let points=0,coachInitiated=0,athleteInitiated=0,meaningful=0,outboundPoints=0;
 for(const i of rows){const type=String(i.type||''),initiated=String(i.initiated_by||''),w=weight(type,initiated);if(initiated==='Coach'){coachInitiated++;points+=w+1.25}else if(initiated==='Athlete'){athleteInitiated++;outboundPoints+=w}else points+=w*.75;if(meaningfulTypes.has(type))meaningful++}
 points+=Math.min(outboundPoints,5);
 const twoWay=coachInitiated>0&&athleteInitiated>0;
 if(twoWay)points+=5;
 if(rows.length>=10)points+=3;else if(rows.length>=6)points+=2;else if(rows.length>=3)points+=1;
 if(meaningful>=5)points+=3;else if(meaningful>=3)points+=2;else if(meaningful>=1)points+=1;
 const recent30=dated.filter(x=>x.days<=30).length,previous30=dated.filter(x=>x.days>30&&x.days<=60).length;
 if(lastActivityDays!==null){if(lastActivityDays<=7)points+=3;else if(lastActivityDays<=14)points+=2;else if(lastActivityDays<=30)points+=1;else if(lastActivityDays>60)points-=4;else if(lastActivityDays>45)points-=2}
 const momentum:RelationshipMomentum=lastActivityDays===null?'New':lastActivityDays>60?'Stalled':lastActivityDays>30?'Cooling':recent30>=2&&recent30>previous30?'Growing':recent30>0?'Steady':'Cooling';
 if(momentum==='Growing')points+=2;
 const score=points>=28?5:points>=18?4:points>=10?3:points>=4?2:1;
 const label=['','Early','Developing','Engaged','Strong','Very Strong'][score];
 const confidence:RelationshipStrength['confidence']=rows.length>=6&&meaningful>=2?'High':rows.length>=3||meaningful>=1?'Medium':'Low';
 const reasons:string[]=[];
 if(lastActivityDays!==null)reasons.push(lastActivityDays===0?'Activity today':`${lastActivityDays}d since last activity`);
 if(coachInitiated)reasons.push(`${coachInitiated} coach-initiated`);
 if(twoWay)reasons.push('Two-way communication');
 const premium=rows.filter(i=>highValueTypes.has(String(i.type||''))).length;
 if(premium)reasons.push(`${premium} high-value signal${premium===1?'':'s'}`);
 if(!reasons.length)reasons.push(`${rows.length} interaction${rows.length===1?'':'s'}`);
 return {score,label,points:Math.max(0,Math.round(points*10)/10),coachInitiated,athleteInitiated,meaningful,total:rows.length,reasons,momentum,confidence,lastActivityDays,recent30,previous30,twoWay};
}
