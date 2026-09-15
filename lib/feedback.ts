'use client';

export const SUCCESS_EVENT = 'rr:success';
export const SUCCESS_STORAGE_KEY = 'rr-success-feedback';
export const DATA_CHANGED_EVENT = 'rr:data-changed';

export type DataChangedDetail={entity:string;action?:'created'|'updated'|'deleted'|'completed'|'reopened'|'archived'|'restored'|'rsvp';id?:string;payload?:unknown};

export function announceSuccess(message:string,{persist=false}:{persist?:boolean}={}){
  if(typeof window==='undefined')return;
  const detail={message:String(message||'Done.'),createdAt:Date.now()};
  if(persist){
    try{sessionStorage.setItem(SUCCESS_STORAGE_KEY,JSON.stringify(detail))}catch{}
  }
  window.dispatchEvent(new CustomEvent(SUCCESS_EVENT,{detail}));
}

export function announceDataChanged(detail:DataChangedDetail){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT,{detail:{...detail,createdAt:Date.now()}}));
}

export function announceSuccessAfterReload(message:string){
  announceSuccess(message,{persist:true});
}
