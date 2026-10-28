// Preview-only Reply-To experiment. Never enable for production sends.
// All three allowlist values are required; fail closed on any mismatch.
export function previewReplyToAddress(input:{
  environment?:string;
  enabled?:string;
  userId:string;
  recipient:string;
  allowedUserId?:string;
  allowedRecipient?:string;
  address?:string;
}):string|null{
  if(input.environment!=='preview'||input.enabled!=='true')return null;
  if(!input.allowedUserId||input.userId!==input.allowedUserId)return null;
  if(!input.allowedRecipient||input.recipient.trim().toLowerCase()!==input.allowedRecipient.trim().toLowerCase())return null;
  const address=(input.address||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._+-]*@[a-z0-9-]+(?:\\.[a-z0-9-]+)+$/.test(address)||/[\\r\\n]/.test(address))return null;
  return address;
}
