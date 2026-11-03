import {formatEmailPhone} from './recruiting-email-format';

export type RecruitingSignatureFields = Partial<Record<
  'name'|'mobile'|'email'|'twitter'|'grad'|'sports'|'travelTeam'|'travelCoach'|
  'travelCoachPhone'|'school'|'hsCity'|'hsState'|'hsCoach'|'hsCoachPhone'|
  'positions'|'throwBat'|'academic'|'ncaa', unknown
>>;
export type RecruitingSignaturePreferences = {
  signatureMode?: string;
  customSignature?: string;
};
const value=(input:unknown)=>String(input??'').trim();

export function buildRecruitingEmailSignature(
  fields:RecruitingSignatureFields,
  preferences:RecruitingSignaturePreferences={},
  forceDefault=false,
):string{
  if(!forceDefault&&preferences.signatureMode==='none')return '';
  if(!forceDefault&&preferences.signatureMode==='custom')return value(preferences.customSignature);
  const v=(key:keyof RecruitingSignatureFields)=>value(fields[key]);
  const lines:string[]=[];
  if(v('name'))lines.push(v('name')+' Profile Summary');
  if(v('mobile'))lines.push('Mobile: '+formatEmailPhone(v('mobile')));
  if(v('email'))lines.push('Email: '+v('email'));
  if(v('twitter'))lines.push('X/Twitter: '+v('twitter'));
  if(v('grad'))lines.push('Graduation Year: '+v('grad'));
  if(v('sports'))lines.push('SportsRecruits Profile: '+v('sports'));
  if(v('travelTeam')){
    let line=v('travelTeam');
    if(v('travelCoach')||v('travelCoachPhone'))
      line+=' ('+[v('travelCoach'),formatEmailPhone(v('travelCoachPhone'))].filter(Boolean).join(': ')+')';
    lines.push('Travel Team: '+line);
  }
  if(v('school')){
    let line=v('school');
    const location=[v('hsCity'),v('hsState')].filter(Boolean).join(', ');
    if(location)line+=', '+location;
    if(v('hsCoach')||v('hsCoachPhone'))
      line+=' ('+[v('hsCoach'),formatEmailPhone(v('hsCoachPhone'))].filter(Boolean).join(': ')+')';
    lines.push('High School: '+line);
  }
  if(v('positions'))lines.push('Position: '+v('positions'));
  if(v('throwBat'))lines.push('Throw/Bat: '+v('throwBat'));
  if(v('academic'))lines.push('Academic Interest: '+v('academic'));
  if(v('ncaa'))lines.push('NCAA #: '+v('ncaa'));
  return lines.join('\n');
}

function escapeHtml(text:string){
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** Existing drafts and older saved templates may already contain a footer. */
export function hasEmbeddedRecruitingSignature(body:string,signature:string):boolean{
  if(!signature.trim())return false;
  if(body.trimEnd().endsWith(signature.trim()))return true;
  // Prior RLTNL drafts stored their generated profile-summary footer in body.
  // Don't append another copy if the current preference has since changed.
  return /(?:^|\n)[^\n]{1,150} Profile Summary(?:\n|$)/.test(body.slice(-2000));
}

/** Keep the editable draft separate from the signature. Append to both MIME
 * representations only when sending, preserving formatted message content. */
export function withRecruitingEmailSignature(
  body:string,bodyHtml:string,signature:string,
):{body:string;bodyHtml:string;added:boolean}{
  const sig=signature.trim();
  if(!sig||hasEmbeddedRecruitingSignature(body,sig))
    return {body,bodyHtml,added:false};
  const text=body.trimEnd()+'\n\n'+sig;
  const html=bodyHtml.trim()?bodyHtml+'<br><br>'+escapeHtml(sig).replace(/\n/g,'<br>'):'';
  return {body:text,bodyHtml:html,added:true};
}
