import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helper=read('lib/reply-to-production-test.ts');
const send=read('app/api/google/gmail/send/route.ts');
for(const gate of ["input.environment!=='production'","input.enabled!=='true'","input.signedInUserId!==input.allowedUserId","input.athleteUserId!==input.allowedUserId","input.ccCount!==0||input.isReply","input.recipient.trim().toLowerCase()!==input.allowedRecipient.trim().toLowerCase()"]){assert(helper.includes(gate),`Missing safety gate: ${gate}`)}
assert(send.includes('productionTestReplyTo('),'Production sender must call gated helper');
assert(send.includes('RLTNL_REPLY_TO_PROD_TEST_ENABLED'),'Production flag must be explicit');
assert(send.includes('Reply-To: ${cleanHeader(replyToAddress)}'),'MIME must set Reply-To');
console.log('Production test Reply-To guard smoke passed.');
