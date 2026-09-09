export type InteractionDatePrecision='exact'|'month'|'year'|'unknown';

export type InteractionDateFields={
 date?:string|null;
 date_precision?:InteractionDatePrecision|string|null;
 date_year?:number|null;
 date_month?:number|null;
};

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

export function interactionDatePrecision(i:InteractionDateFields|null|undefined):InteractionDatePrecision{
 const p=i?.date_precision;
 if(p==='month'||p==='year'||p==='unknown'||p==='exact')return p;
 return i?.date?'exact':'unknown';
}

export function exactInteractionDate(i:InteractionDateFields|null|undefined){
 return interactionDatePrecision(i)==='exact'&&i?.date?String(i.date).slice(0,10):null;
}

export function isExactDatedInteraction(i:InteractionDateFields|null|undefined){return Boolean(exactInteractionDate(i))}

export function interactionDateLabel(i:InteractionDateFields|null|undefined){
 const precision=interactionDatePrecision(i);
 if(precision==='exact'){
  const value=exactInteractionDate(i);
  if(!value)return 'Date unknown';
  const [year,month,day]=value.split('-');
  return year&&month&&day?`${month}/${day}/${year}`:value;
 }
 if(precision==='month'){
  const year=Number(i?.date_year||0),month=Number(i?.date_month||0);
  return year&&month>=1&&month<=12?`${MONTHS[month-1]} ${year}`:'Date unknown';
 }
 if(precision==='year')return i?.date_year?String(i.date_year):'Date unknown';
 return 'Date unknown';
}

export function interactionChronologyValue(i:InteractionDateFields|null|undefined){
 const precision=interactionDatePrecision(i);
 if(precision==='exact'){
  const value=exactInteractionDate(i);
  return value?Number(value.replaceAll('-',''))*10+3:-1;
 }
 const year=Number(i?.date_year||0);
 if(precision==='month'&&year){const month=Math.max(1,Math.min(12,Number(i?.date_month||1)));return Number(`${year}${String(month).padStart(2,'0')}00`)*10+2}
 if(precision==='year'&&year)return Number(`${year}0000`)*10+1;
 return -1;
}

export function interactionDatePayload(precision:InteractionDatePrecision,exactDate:string,monthValue:string,yearValue:string){
 if(precision==='exact'){
  const [year,month]=exactDate.split('-').map(Number);
  return{date:exactDate||null,date_precision:'exact' as const,date_year:year||null,date_month:month||null};
 }
 if(precision==='month'){
  const [year,month]=monthValue.split('-').map(Number);
  return{date:null,date_precision:'month' as const,date_year:year||null,date_month:month||null};
 }
 if(precision==='year')return{date:null,date_precision:'year' as const,date_year:Number(yearValue)||null,date_month:null};
 return{date:null,date_precision:'unknown' as const,date_year:null,date_month:null};
}

export function importedHistoryType(type:string){
 const clean=String(type||'Other').trim();
 if(/^imported\s+/i.test(clean))return clean;
 if(/^email sent$/i.test(clean))return 'Imported Email Sent';
 if(/^email received$/i.test(clean))return 'Imported Email Received';
 return `Imported ${clean}`;
}

export function isImportedHistory(i:{type?:string|null}|null|undefined){return /^imported\s+/i.test(String(i?.type||''))}

const normalizeKey=(value:any)=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const collegeDedupKey=(name:any)=>normalizeKey(name);
export function coachDedupKey(input:{email?:any;first_name?:any;last_name?:any;college?:any}){
 const email=String(input.email||'').trim().toLowerCase();
 if(email)return `email:${email}`;
 return `name:${normalizeKey(`${input.first_name||''} ${input.last_name||''}`)}|college:${collegeDedupKey(input.college)}`;
}
