// Production sender experiment. Defaults off and requires exact server-side allowlists.
// This must never be enabled for ordinary athletes or coach outreach.
export function productionTestReplyTo(input:{
  environment?:string;
  enabled?:string;
  signedInUserId:string;
  athleteUserId:string;
  recipient:string;
  ccCount:number;
  isReply:boolean;
  allowedUserId?:string;
  allowedRecipient?:string;
  address?:string;
}):string|null{
  // The Reply-To pilot is retired during send-only Gmail operation.
  // Never divert coach replies away from the athlete's actual Gmail address.
  return null;
  /* if(input.environment!=='production'||input.enabled!=='true')return null;
  if(!input.allowedUserId||input.signedInUserId!==input.allowedUserId||input.athleteUserId!==input.allowedUserId)return null;
  if(!input.allowedRecipient||input.recipient.trim().toLowerCase()!==input.allowedRecipient.trim().toLowerCase())return null;
  if(input.ccCount!==0||input.isReply)return null;
  const address=(input.address||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(address)||/[\r\n]/.test(address))return null;
  return address; */
}
