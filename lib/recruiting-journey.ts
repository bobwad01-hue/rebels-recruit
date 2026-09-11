export const RECRUITING_JOURNEY = ['Researching','Target School','Contacted','Engaged','Interested','Visit/Camp','Offer','Committed'] as const;
export type RecruitingJourneyStage = typeof RECRUITING_JOURNEY[number];
export const JOURNEY_ORDER:Record<string,number>=Object.fromEntries(RECRUITING_JOURNEY.map((s,i)=>[s,i]));

/**
 * The live database still uses the original pipeline_stage enum labels.
 * Keep that storage contract stable while presenting the friendlier
 * Recruiting Journey language everywhere in the application.
 */
export function normalizeJourneyStage(value?:string|null):RecruitingJourneyStage{
 const v=String(value||'').trim();
 if(v==='Target'||v==='High Interest')return 'Target School';
 if(v==='Recruiting Interest')return 'Interested';
 if(v==='Decision')return 'Offer';
 return (RECRUITING_JOURNEY.includes(v as RecruitingJourneyStage)?v:'Researching') as RecruitingJourneyStage;
}

export function toPipelineStorageStage(value?:string|null):string{
 switch(normalizeJourneyStage(value)){
  case 'Target School':return 'Target';
  case 'Interested':return 'Recruiting Interest';
  case 'Offer':return 'Decision';
  default:return normalizeJourneyStage(value);
 }
}

export const JOURNEY_STAGE_EXPLANATIONS:Record<RecruitingJourneyStage,string>={
 Researching:'You are learning about the school and deciding whether it belongs on your list.',
 'Target School':'This is a school you want to pursue more intentionally.',
 Contacted:'You have reached out to a coach, but the relationship is still getting started.',
 Engaged:'You and the coaching staff have had meaningful two-way contact.',
 Interested:'There are signs the relationship is moving forward and this school is becoming a serious possibility.',
 'Visit/Camp':'You are preparing for or have completed an in-person recruiting opportunity with this school.',
 Offer:'You have a real offer or recruiting decision to consider.',
 Committed:'You have made your college decision and recorded the commitment.'
};

export function journeyStageExplanation(stage?:string|null){return JOURNEY_STAGE_EXPLANATIONS[normalizeJourneyStage(stage)]}

export function journeyUrgencyDays(stage?:string|null){switch(normalizeJourneyStage(stage)){case'Committed':return 9999;case'Offer':return 7;case'Visit/Camp':return 10;case'Interested':return 14;case'Engaged':return 18;case'Contacted':return 21;case'Target School':return 30;default:return 45}}
export function journeySuggestion(stage?:string|null,days=999){const s=normalizeJourneyStage(stage),limit=journeyUrgencyDays(s);if(s==='Committed')return'Celebrate the commitment and keep outcome details current.';if(days>=limit)return`${s} relationship has been quiet for ${days===999?'a while':`${days} days`}. Consider a thoughtful next move.`;return'Keep building the relationship and log meaningful recruiting milestones.'}
