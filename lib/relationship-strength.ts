export type RelationshipInteraction={type?:string|null;initiated_by?:string|null;date?:string|null;created_at?:string|null};

export type RelationshipStrength={score:number;label:string;points:number;coachInitiated:number;athleteInitiated:number;meaningful:number;total:number;reasons:string[]};

const meaningfulTypes=new Set(['Email Received','Text','Phone Call','Video Call','X/Twitter DM','Instagram DM','Questionnaire','College Camp','Campus Visit','Tournament Interaction','Coach Watched Game','Coach Contacted Me']);

function weight(type:string,initiated:string){
 const coach=initiated==='Coach';
 switch(type){
  case 'Campus Visit':return 5;
  case 'Coach Contacted Me':return 5;
  case 'Phone Call':return coach?4.5:3;
  case 'Video Call':return coach?4.5:3;
  case 'College Camp':return 3.5;
  case 'Coach Watched Game':return 3.5;
  case 'Email Received':return 3;
  case 'Text':return coach?3.5:2;
  case 'Questionnaire':return 2.5;
  case 'Tournament Interaction':return 2.5;
  case 'X/Twitter DM':
  case 'Instagram DM':return coach?2.5:1.5;
  case 'Coach Followed Me':return 1.5;
  case 'Coach Commented':return 1.25;
  case 'Coach Liked Post':return .5;
  case 'Email Sent':return .75;
  case 'Thank You Message':return .5;
  default:return .5;
 }
}

export function calculateRelationshipStrength(interactions:RelationshipInteraction[],lastContact?:string|null):RelationshipStrength{
 const rows=interactions||[];
 if(!rows.length)return {score:1,label:'Early',points:0,coachInitiated:0,athleteInitiated:0,meaningful:0,total:0,reasons:['No interactions logged yet']};
 let points=0,coachInitiated=0,athleteInitiated=0,meaningful=0,outboundPoints=0;
 for(const i of rows){const type=String(i.type||'');const initiated=String(i.initiated_by||'');const w=weight(type,initiated);if(initiated==='Coach'){coachInitiated++;points+=w+1}else if(initiated==='Athlete'){athleteInitiated++;outboundPoints+=w}else points+=w*.75;if(meaningfulTypes.has(type))meaningful++}
 points+=Math.min(outboundPoints,4);
 if(coachInitiated>0&&athleteInitiated>0)points+=4;
 if(rows.length>=10)points+=3;else if(rows.length>=6)points+=2;else if(rows.length>=3)points+=1;
 if(meaningful>=5)points+=3;else if(meaningful>=3)points+=2;else if(meaningful>=1)points+=1;
 if(lastContact){const days=Math.max(0,Math.floor((Date.now()-new Date(`${lastContact}T12:00:00`).getTime())/86400000));if(days<=14)points+=2;else if(days<=30)points+=1;else if(days>60)points-=2}
 const score=points>=24?5:points>=15?4:points>=8?3:points>=3?2:1;
 const label=['','Early','Developing','Engaged','Strong','Very Strong'][score];
 const reasons:string[]=[];
 reasons.push(`${rows.length} interaction${rows.length===1?'':'s'}`);
 if(coachInitiated)reasons.push(`${coachInitiated} coach-initiated`);
 if(meaningful)reasons.push(`${meaningful} meaningful contact${meaningful===1?'':'s'}`);
 if(coachInitiated>0&&athleteInitiated>0)reasons.push('two-way communication');
 const premium=rows.filter(i=>['Phone Call','Video Call','College Camp','Campus Visit','Coach Watched Game','Coach Contacted Me'].includes(String(i.type||''))).length;
 if(premium)reasons.push(`${premium} high-value recruiting signal${premium===1?'':'s'}`);
 return {score,label,points:Math.max(0,Math.round(points*10)/10),coachInitiated,athleteInitiated,meaningful,total:rows.length,reasons};
}
