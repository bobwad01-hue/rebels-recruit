'use client';

export const SUCCESS_EVENT = 'rr:success';
export const SUCCESS_STORAGE_KEY = 'rr-success-feedback';

export function announceSuccess(message:string,{persist=false}:{persist?:boolean}={}){
  if(typeof window==='undefined')return;
  const detail={message:String(message||'Done.'),createdAt:Date.now()};
  if(persist){
    try{sessionStorage.setItem(SUCCESS_STORAGE_KEY,JSON.stringify(detail))}catch{}
  }
  window.dispatchEvent(new CustomEvent(SUCCESS_EVENT,{detail}));
}

export function announceSuccessAfterReload(message:string){
  announceSuccess(message,{persist:true});
}
