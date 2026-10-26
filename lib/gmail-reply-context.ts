export function gmailSubjectChanged(original:string,proposed:string):boolean{
 const normalize=(value:string)=>value.trim().replace(/^(?:re\s*:\s*)+/gi,'').replace(/\s+/g,' ').trim().toLowerCase();
 return normalize(original)!==normalize(proposed);
}
type Header={name?:string;value?:string};
type Part={mimeType?:string;filename?:string;body?:{data?:string};parts?:Part[]};
export type GmailConversationMessage={id?:string;internalDate?:string;labelIds?:string[];payload?:Part&{headers?:Header[]}};
export type QuotedConversation={text:string;html:string;messageCount:number;omittedCount:number};
function header(message:GmailConversationMessage,name:string){return String(message.payload?.headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||'').replace(/[\r\n]+/g,' ').trim()}
function addresses(value:string){return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase())}
function escapeHtml(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function decodeBody(data?:string){if(!data)return '';try{return Buffer.from(data.slice(0,100_000).replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch{return ''}}
function findPart(part:Part|undefined,type:string):string{
 if(!part)return '';
 if(part.mimeType?.toLowerCase()===type&&!part.filename&&part.body?.data)return decodeBody(part.body.data);
 for(const child of part.parts||[]){const text=findPart(child,type);if(text)return text}
 return '';
}
function plainFromHtml(html:string){return html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/\s*(?:script|style)>/gi,'')
 .replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi,'\n').replace(/<[^>]+>/g,'')
 .replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
 .replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&')}
function messageBody(message:GmailConversationMessage){
 const plain=findPart(message.payload,'text/plain');
 const raw=plain||plainFromHtml(findPart(message.payload,'text/html'));
 const head=raw.replace(/\r\n?/g,'\n').split(/\n(?:On .{5,200} wrote:|[-]{2,}\s*(?:Original Message|Forwarded message)\s*[-]{2,}|From:\s+.{4,200}|>\s)/i)[0];
 return head.replace(/\n{4,}/g,'\n\n\n').trim().slice(0,2500);
}
export function buildPreviousConversation(messages:GmailConversationMessage[],coachEmail:string,anchorMessageId:string):QuotedConversation{
 if(!Array.isArray(messages)||!messages.some(m=>m.id===anchorMessageId))throw new Error('The original email could not be verified in this Gmail conversation.');
 const target=coachEmail.trim().toLowerCase();
 const eligible=messages.filter(m=>{
  if(!m.id||m.labelIds?.some(x=>['DRAFT','TRASH','SPAM'].includes(x)))return false;
  return addresses(header(m,'From')).includes(target)||addresses(header(m,'To')).includes(target);
 }).sort((a,b)=>Number(a.internalDate||0)-Number(b.internalDate||0));
 if(!eligible.some(m=>m.id===anchorMessageId))throw new Error('The original email does not match this coach. No email was sent.');
 const candidates=eligible.map(m=>({message:m,body:messageBody(m)})).filter(x=>x.body);
 if(!candidates.length)throw new Error('Gmail did not return readable previous messages. No email was sent.');
 const included=candidates.slice(-12),omittedCount=candidates.length-included.length;
 const entries=included.map(({message,body})=>{
  const from=header(message,'From').slice(0,160)||'Previous correspondent';
  const date=header(message,'Date').slice(0,120);
  return {heading:'From: '+from+(date?'\nDate: '+date:''),body};
 });
 const text='\n\n--- Previous conversation (quoted for context) ---\n'+
  (omittedCount?'\nEarlier messages omitted for length.\n':'')+
  entries.map(e=>'\n'+e.heading+'\n\n'+e.body+'\n').join('\n---\n');
 const html='<div style="margin-top:28px;border-top:1px solid #cbd5e1;padding-top:14px;color:#475569;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5">'+
  '<p style="font-weight:bold;margin:0 0 12px">Previous conversation (quoted for context)</p>'+
  (omittedCount?'<p>Earlier messages omitted for length.</p>':'')+
  entries.map(e=>'<div style="border-left:3px solid #cbd5e1;padding-left:12px;margin:0 0 16px"><div style="font-weight:bold;white-space:pre-wrap">'+escapeHtml(e.heading)+'</div><div style="white-space:pre-wrap;margin-top:8px">'+escapeHtml(e.body)+'</div></div>').join('')+
  '</div>';
 return {text,html,messageCount:entries.length,omittedCount};
}
export async function loadPreviousConversation(accessToken:string,threadId:string,coachEmail:string,anchorMessageId:string,fetchImpl:typeof fetch=fetch):Promise<QuotedConversation>{
 if(!threadId||!anchorMessageId)throw new Error('This Gmail conversation is missing its original message. No email was sent.');
 let response:Response;
 try{response=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/threads/'+encodeURIComponent(threadId)+'?format=full',{
  headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(12000)
 })}catch{throw new Error('Gmail could not retrieve the previous conversation. No email was sent. Try again or uncheck Include previous conversation.')}
 if(!response.ok)throw new Error('Gmail could not retrieve the previous conversation. No email was sent. Try again or uncheck Include previous conversation.');
 const thread=await response.json() as {id?:string;messages?:GmailConversationMessage[]};
 if(thread.id!==threadId)throw new Error('Gmail returned a different conversation. No email was sent.');
 return buildPreviousConversation(thread.messages||[],coachEmail,anchorMessageId);
}
