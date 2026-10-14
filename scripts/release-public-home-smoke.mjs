import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('app/page.tsx');
const demo = read('app/demo/page.tsx');
const form = read('components/DemoRequestForm.tsx');
const api = read('app/api/demo-request/route.ts');
const inbox = read('app/api/platform/demo-inquiries/route.ts');
const tour = read('components/PublicProductTour.tsx');
const sql = read('supabase/migrations/20261014_organization_demo_requests.sql');
const privacy = read('app/privacy/page.tsx');
const middleware = read('middleware.ts');
const lockdown = read('supabase/migrations/20261014_02_lock_down_demo_requests.sql');
const workflow = read('supabase/migrations/20261014_03_demo_inquiry_workflow.sql');
const alerts = read('app/api/platform/attention/route.ts');
const alertUi = read('components/PlatformOwnerAlerts.tsx');
const adminHome = read('app/platform-admin/page.tsx');
const inquiryPage = read('app/platform-admin/inquiries/page.tsx');

assert.match(home, /RLTNL: Relationships lead to the next level\./, 'Approved closing line uses colon');
assert.match(home, /Recruiting happens in the/, 'Retain follow-through positioning');
assert.ok(home.indexOf('id="organizations"') < home.indexOf('id="features"'), 'Organizations appear before detailed product features');
assert.ok(home.indexOf('id="features"') < home.indexOf('id="how-it-works"'), 'Features precede lifecycle');
assert.match(home, /href="\/demo"/, 'Primary commercial CTA opens demo form');
assert.match(home, /href="\/signup"/, 'Existing team signup stays available');
assert.match(home, /#features/, 'Feature navigation anchor exists');
assert.match(home, /#organizations/, 'Organization navigation anchor exists');
assert.match(home, /#how-it-works/, 'Lifecycle navigation anchor exists');
assert.match(home, /<header className="sticky top-0 z-50/, 'Keep public homepage navigation visible during scroll');
assert.match(home, /Recruiting built on relationships/, 'Relationship-led hero eyebrow');
for (const promise of ['Athletes first', 'Families supported', 'Advisors connected', 'Organizations informed']) {
  assert.ok(home.includes(promise), 'Hero includes ' + promise);
}
for (const [file, source] of [['homepage', home], ['product tour', tour]]) {
  for (const removed of ['Sample data', 'sample data', 'Illustrative product preview', 'Product walkthrough', 'Interactive, anonymized walkthrough', 'not a live account or a screenshot']) {
    assert.ok(!source.includes(removed), file + ' should not show ' + removed);
  }
}
assert.match(home, /<PreviewChrome label="Game Plan">/, 'Keep clean Game Plan hero preview label');
assert.match(tour, /Recruiting Board/, 'Show organization product evidence');
assert.match(tour, /Advisor Communications/, 'Show advisor product evidence');
assert.match(form, /privacyAccepted/, 'Consent is required in the form');
assert.match(form, /Phone number/, 'Demo form supports optional phone');
assert.match(form, /Preferred contact method/, 'Demo form supports contact preference');
assert.match(api, /preferredContact === 'phone' && !phone/, 'Phone preference requires a phone');
assert.match(api, /phone: phone \|\| null/, 'Persist optional phone');
assert.match(workflow, /organization_demo_request_events/, 'Keep private inquiry activity history');
assert.match(workflow, /revoke all on table public.organization_demo_request_events from anon, authenticated/, 'Protect private activity history');
assert.match(inbox, /internalNotes/, 'Allow internal notes in owner-only API');
assert.match(inbox, /followUpAt/, 'Allow follow-up scheduling');
assert.match(inbox, /demo_scheduled/, 'Support demo scheduling outcomes');
assert.match(inbox, /acknowledge/, 'Support alert acknowledgment');
assert.match(inbox, /dismiss/, 'Support alert dismissal');
assert.match(inquiryPage, /role="dialog"/, 'In-app inquiry detail drawer');
assert.match(inquiryPage, /navigator.clipboard.writeText/, 'Copy contacts without opening Outlook');
assert.ok(!inquiryPage.includes('mailto:'), 'Inquiries should not auto-open email apps');
assert.match(alerts, /demoRequests/, 'Surface new demos in platform alerts');
assert.match(alerts, /followUps/, 'Surface due follow-ups in platform alerts');
assert.match(alerts, /approvals/, 'Surface pending account approvals in platform alerts');
assert.match(alertUi, /Needs Your Attention/, 'Command center prioritizes outstanding work');
assert.ok(adminHome.indexOf('<PlatformOwnerAlerts variant="home"/>') < adminHome.indexOf('<Metric label="Organizations"'), 'Prioritize owner alerts over platform statistics');
assert.match(adminHome, /id="pending-approvals"/, 'Deep link to pending approvals');
assert.match(form, /required/, 'Browser validates required fields');
assert.match(form, /role="alert"/, 'Form errors are accessible');
assert.match(form, /Request a demo/, 'Demo request CTA present');
assert.match(demo, /DemoRequestForm/, 'Demo page renders request form');
assert.match(api, /privacyAccepted !== true/, 'API enforces consent');
assert.match(api, /createAdminClient/, 'Server-only service-role storage');
assert.match(api, /organization_demo_requests/, 'Persist requests durably');
assert.match(api, /count: 'exact', head: true/, 'Limit repeated requests');
assert.match(api, /clean\(body\.website\)/, 'Honeypot spam check');
assert.match(api, /escapeHtml/, 'Escape user content in notification');
assert.match(api, /notification_sent_at/, 'Track delivery without losing saved inquiries');
assert.match(inbox, /ownerAuthorized/, 'Protect commercial inbox');
assert.match(inbox, /super_owner/, 'Restrict inbox to platform owners');
assert.match(sql, /enable row level security/, 'Private inquiries have RLS');
assert.ok(!/create policy/i.test(sql), 'Do not add public inquiry access policies');
assert.match(lockdown, /revoke all on table public.organization_demo_requests from anon, authenticated/, 'Revoke direct client access');
assert.match(privacy, /organization demo inquiry/, 'Privacy notice covers public form');
assert.match(middleware, /publicPaths=\['\/',\s*'\/demo'/, 'Public demo page is accessible without sign-in');
assert.match(middleware, /request.method==='POST'&&\(pathname==='\/api\/signup\/authorize'\|\|pathname==='\/api\/demo-request'\)/, 'Anonymous demo POST passes middleware');
assert.match(middleware, /pendingApiAllowed=pathname==='\/api\/demo-request'/, 'Pending accounts may request a demo');
console.log('Commercial homepage, product tour, inquiry and privacy smoke tests passed.');
