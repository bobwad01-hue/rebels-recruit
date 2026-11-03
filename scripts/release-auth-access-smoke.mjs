import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const middleware=read('middleware.ts');
const callback=read('app/auth/callback/route.ts');
const login=read('app/login/page.tsx');
const legal=read('app/legal/accept/page.tsx');
const unavailable=read('app/service-unavailable/page.tsx');

assert.match(middleware,/error:accessError/, 'Middleware checks status RPC errors');
assert.match(middleware,/if\(user&&\(accessError\|\|!sessionProfile\)\)/, 'Unknown access state fails closed');
assert.match(middleware,/status:503/, 'APIs receive a retryable unavailable response');
assert.match(middleware,/pathname==='\/service-unavailable'/, 'Error page is accessible during an outage');
assert.match(middleware,/sessionProfile\?\.registration_status!=='active'/, 'Invite-only registration remains enforced');
assert.match(middleware,/sessionProfile\?\.account_status==='suspended'/, 'Suspended accounts remain blocked');
assert.match(callback,/if\(acceptError\)return NextResponse.redirect\(new URL\('\/service-unavailable'/, 'OAuth legal RPC failure does not demand new acceptance');
assert.match(callback,/if\(platformRoleError\)/, 'OAuth platform role errors cannot silently demote a Super Owner');
assert.match(login,/acceptError\|\|profileError\|\|platformRoleError\|\|!profile/, 'Password login handles account lookup failures');
assert.match(legal,/acceptError\|\|profileError\|\|accessError\|\|!profile\|\|!access/, 'Legal acceptance requires verified account state');
assert.match(legal,/disabled=\{!checked\|\|busy\|\|!!error\|\|!docs\}/, 'Cannot accept terms during a lookup failure');
assert.match(unavailable,/Try again/, 'Outage screen provides retry');
assert.match(unavailable,/auth\/callback/, 'Retry resumes the authenticated callback');
console.log('Authentication access fail-closed regression checks passed.');
