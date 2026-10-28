import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const scopes=read('app/api/google/connect/route.ts');
const callback=read('app/api/google/callback/route.ts');
const mode=read('lib/gmail-feature-mode.ts');
assert(scopes.includes('gmail.send'),'Gmail send permission must remain');
assert(!scopes.includes('gmail.readonly'),'New OAuth connections must not request restricted read access');
assert(callback.includes("gmail:['https://www.googleapis.com/auth/gmail.send'].join(' ')"),'OAuth callback must request send-only scope');
assert(callback.includes("return redirect(req,'unexpected-read-permission'"),'Callback must reject unexpected restricted grants');
assert(!callback.includes('startGmailWatch(user.id)'),'New OAuth connections must not start watches');
assert(mode.includes('GMAIL_INBOX_MONITORING_ENABLED = false'),'Read access must be disabled by default');
for(const path of [
 'app/api/google/gmail/sync/route.ts','app/api/google/gmail/watch/route.ts',
 'app/api/google/gmail/push/route.ts','app/api/cron/gmail-watch/route.ts',
 'app/api/google/gmail/backfill-sent/route.ts','lib/gmail-inbound.ts'
]){
 assert(read(path).includes('!GMAIL_INBOX_MONITORING_ENABLED'),path+' must block inbox access');
}
assert(!JSON.stringify(JSON.parse(read('vercel.json')).crons||[]).includes('/api/cron/gmail-watch'),'No Gmail watch cron scheduled');
assert(!read('app/layout.tsx').includes('<GmailInboundSync/>'),'Browser must not scan Gmail');
assert(read('lib/reply-to-production-test.ts').includes('if(!GMAIL_INBOX_MONITORING_ENABLED)return null'),'Reply-To pilot must be disabled');
const send=read('app/api/google/gmail/send/route.ts');
assert(send.includes('/gmail/v1/users/me/messages/send'),'Sending must remain operational');
assert(send.includes("type:'Email Sent'"),'Outgoing recruiting activity must still be logged');
assert(send.includes('if(!GMAIL_INBOX_MONITORING_ENABLED&&(sentInteractionId||recruitingInteractionId||recruitingMessageId||previewOnly))'),'Read-dependent thread continuation must be blocked');
assert(read('app/api/google/gmail/manual-send/route.ts').includes('/gmail/v1/users/me/messages/send'),'Manual send must remain operational');
assert(read('components/GoogleWorkspaceSettings.tsx').includes('Gmail — sending only'),'Settings must accurately describe scope');
console.log('Gmail send-only OAuth, disabled inbox paths, normal replies and activity smoke passed.');
