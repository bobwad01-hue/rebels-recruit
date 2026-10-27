import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const config=JSON.parse(read('vercel.json'));
const cronSchedule=config.crons?.find(c=>c.path==='/api/cron/gmail-watch');
assert(cronSchedule?.schedule,'Gmail renewal cron must remain scheduled');

const middleware=read('middleware.ts');
assert(middleware.includes("pathname==='/api/cron/gmail-watch'"),
  'Gmail cron must bypass session middleware (its handler enforces the cron secret)');
assert(middleware.includes("pathname==='/api/google/gmail/push'"),
  'Google Pub/Sub push must bypass interactive session middleware');

const cron=read('app/api/cron/gmail-watch/route.ts');
assert(cron.includes("req.headers.get('authorization')!==`Bearer ${secret}`"),
  'Gmail cron must validate its bearer secret');
assert(cron.includes("t.scope?.includes('gmail.readonly')"),
  'Only accounts with incoming Gmail read permission can be watched');
assert(cron.includes("await startGmailWatch(row.user_id)"),
  'Gmail cron must renew expiring watches');
assert(cron.includes("new URL('/api/google/gmail/sync'"),
  'Gmail cron must catch up on missed messages independently of watch renewal');
assert(cron.includes("'Gmail watch cron completed'"),
  'Gmail cron must emit its daily execution heartbeat');

const push=read('app/api/google/gmail/push/route.ts');
assert(push.includes('verifyPubSub(req)'),'Gmail push must validate authenticated delivery');
assert(push.includes("skipped:'gmail-read-permission-required'"),
  'Gmail push must acknowledge permanent send-only notifications without retry storms');
assert(push.includes("new URL('/api/google/gmail/sync'"),
  'Gmail push must trigger incoming coach email synchronization');

const watch=read('app/api/google/gmail/watch/route.ts');
assert(watch.includes('client.auth.getUser()'),
  'Manual watch repair must authenticate the current user');
assert(watch.includes("startGmailWatch(user.id)"),
  'Manual watch repair must only renew the current user watch');

const sync=read('app/api/google/gmail/sync/route.ts');
assert(sync.includes('let persistenceFailures=0'),
  'Incoming Gmail sync must track partial persistence failures');
assert(sync.includes('if(persistenceFailures)return NextResponse.json('),
  'Partial Gmail failures must return a retryable error before advancing sync success');
assert(sync.includes('retryable:true'),
  'Gmail partial failures must be explicitly retryable');
assert(sync.indexOf('if(persistenceFailures)return NextResponse.json(')<sync.indexOf("gmail_last_synced_at:new Date().toISOString()"),
  'Never advance Gmail last-synced timestamp after partial persistence failure');

assert(sync.includes('if(stepUpdate.error)persistenceFailures++'),
  'A failed coach Next Step update must require Gmail sync retry');
assert(sync.includes('if(checkpoint.error)return NextResponse.json('),
  'A failed Gmail sync checkpoint must return an error');
assert(push.includes('if(checkpoint.error)'),
  'Gmail push checkpoint persistence failures must not be acknowledged as success');
assert(!push.includes('gmail_last_synced_at:new Date().toISOString()'),
  'Gmail push must not overwrite the synchronization checkpoint');

console.log('Gmail watch renewal, security, catch-up and push delivery smoke tests passed.');
