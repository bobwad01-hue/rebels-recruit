import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const js=ts.transpileModule(read('lib/gmail-coach-lookup.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const module={exports:{}};
vm.runInNewContext('(function(exports,require,module){'+js+'\n})')(module.exports,()=>{throw Error('Unexpected dependency')},module);
const {lookupCoachWithRetry,isTransientCoachLookupError}=module.exports;
const send=read('app/api/google/gmail/send/route.ts');
const success={data:{id:'coach-1'},error:null,status:200};
const missing={data:null,error:null,status:200};
const unavailable={data:null,error:{code:'PGRST000',message:'Connection unavailable'},status:503};
const forbidden={data:null,error:{code:'42501',message:'Permission denied'},status:403};
const brokenSchema={data:null,error:{code:'PGRST200',message:'Invalid relationship'},status:400};

assert.equal(isTransientCoachLookupError(unavailable.error,unavailable.status),true);
assert.equal(isTransientCoachLookupError(forbidden.error,forbidden.status),false);
assert.equal(isTransientCoachLookupError(brokenSchema.error,brokenSchema.status),false);
assert.equal(isTransientCoachLookupError({code:'NETWORK_ERROR'},0),true);
assert.equal(isTransientCoachLookupError({code:'08006'},500),true);
assert.equal(isTransientCoachLookupError({code:'42P01'},500),false);

let attempts=0,waits=0,failures=[];
let result=await lookupCoachWithRetry(async()=>{
  attempts++;
  return attempts===1?unavailable:success;
}, failure=>failures.push(failure),async ms=>{assert.equal(ms,200);waits++});
assert.equal(result.data.id,'coach-1','Transient lookup must succeed on the second read');
assert.equal(attempts,2,'Transient lookup must retry exactly once');
assert.equal(waits,1);
assert.equal(failures.length,1);
assert.equal(failures[0].retrying,true);

attempts=0;waits=0;
result=await lookupCoachWithRetry(async()=>{attempts++;return missing},undefined,async()=>{waits++});
assert.equal(result.data,null,'An empty result is distinct from an error');
assert.equal(result.error,null);
assert.equal(attempts,1,'Do not retry a genuinely missing coach');
assert.equal(waits,0);

attempts=0;waits=0;
result=await lookupCoachWithRetry(async()=>{attempts++;return forbidden},undefined,async()=>{waits++});
assert.equal(result.error.code,'42501');
assert.equal(attempts,1,'Do not retry authorization failures');
assert.equal(waits,0);

attempts=0;
result=await lookupCoachWithRetry(async()=>{attempts++;return brokenSchema},undefined,async()=>{throw Error('Should not wait')});
assert.equal(result.error.code,'PGRST200');
assert.equal(attempts,1,'Do not retry a schema/relationship error');

attempts=0;waits=0;
result=await lookupCoachWithRetry(async()=>{attempts++;return unavailable},undefined,async()=>{waits++});
assert.equal(result.error.code,'PGRST000');
assert.equal(attempts,2,'Retry must stop after two failed reads');
assert.equal(waits,1,'Retry must wait only once');

attempts=0;
result=await lookupCoachWithRetry(async()=>{
  attempts++;
  if(attempts===1)throw new TypeError('fetch failed');
  return success;
},undefined,async()=>{});
assert.equal(result.data.id,'coach-1');
assert.equal(attempts,2,'Transient network exceptions must be retried');

attempts=0;
result=await lookupCoachWithRetry(async()=>{
  attempts++;
  throw new Error('Invalid application code');
},undefined,async()=>{throw Error('Unexpected wait')});
assert.equal(result.error.code,'QUERY_EXCEPTION');
assert.equal(attempts,1,'Unexpected application exceptions must not be retried');

assert(send.includes('lookupCoachWithRetry<GmailSendCoach>('),'Gmail send route must use the bounded, typed coach lookup');
assert(send.includes("console.error('[gmail/send] Coach lookup failed before Gmail send'"),'Database failures must be logged with diagnostic details');
assert(send.includes("if(coachError)return NextResponse.json("),'Database failures must have their own response');
assert(send.includes("error:'Unable to load coach information. Please try again.'"),'Transient failures must not be reported as a missing coach');
assert(send.includes("if(!coach){"),'Genuinely missing coach must have a separate response');
assert(send.indexOf('lookupCoachWithRetry<GmailSendCoach>(')<send.indexOf("fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send'"),'Retries must happen before sending anything to Gmail');
assert.equal((send.match(/lookupCoachWithRetry<GmailSendCoach>\(/g)||[]).length,1,'Never wrap the Gmail send itself in retry logic');
console.log('Gmail coach lookup: transient retry, missing record, authorization, schema failure, logging and no-duplicate-send tests passed.');
