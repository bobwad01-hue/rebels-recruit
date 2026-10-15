// Only documented coach-directed communication counts as "Contacted".
// School research, events, videos, and merely saving a coach do not.
export function isCoachContactActivity(type: string | null | undefined): boolean {
  const normalized=String(type||'').trim().toLowerCase();
  return /\b(email|text|sms|phone|call|direct message|dm|conversation|meeting)\b/.test(normalized);
}
type ContactInteraction={
  coach_id?:string|null;
  type?:string|null;
  interaction_recipients?:{coach_id?:string|null}[]|{coach_id?:string|null}|null;
};
export function contactedCoachIdsFromInteractions(rows:ContactInteraction[]):string[]{
  const result=new Set<string>();
  for(const row of rows){
    if(!isCoachContactActivity(row.type))continue;
    if(row.coach_id)result.add(row.coach_id);
    const recipients=Array.isArray(row.interaction_recipients)?row.interaction_recipients:
      row.interaction_recipients?[row.interaction_recipients]:[];
    for(const recipient of recipients)if(recipient.coach_id)result.add(recipient.coach_id);
  }
  return [...result];
}
