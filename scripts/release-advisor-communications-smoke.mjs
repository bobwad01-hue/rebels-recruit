import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real TypeScript implementation without adding a runtime dependency
// or requiring a browser / database. This runs in Vercel's prebuild check.
const source = fs.readFileSync(new URL('../lib/advisor-communication-threads.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { groupAdvisorCommunications, normalizedSubject } = context.exports;

const base = {
  athleteId: 'athlete-1', athleteName: 'Test Athlete', coachId: 'coach-1',
  coachName: 'Test Coach', collegeId: 'school-1', schoolName: 'Test University',
  direction: 'received', sentByAdvisor: false, subject: 'Recruiting follow-up',
  body: null, summary: 'Coach wrote back', timestamp: '2026-10-10T12:00:00Z',
  tracked: true, actionRequired: true, actionState: 'review', actionDecision: null,
  nextAction: 'Reply to coach', reviewed: true, source: 'gmail',
  gmailThreadId: 'gmail-thread-1', gmailMessageId: 'gmail-msg-1', senderEmail: null,
};
const msg = (id, changes = {}) => ({ ...base, id, ...changes });

assert.equal(normalizedSubject('Re: Fwd: RE: Recruiting follow-up'), 'recruiting follow-up');

const one = groupAdvisorCommunications([
  msg('received-1'),
  msg('received-2', { gmailMessageId: 'gmail-msg-2', timestamp: '2026-10-10T13:00:00Z' }),
]);
assert.equal(one.length, 1, 'Same Gmail thread must group together');
assert.equal(one[0].receivedCount, 2, 'Keep distinct received emails');
assert.equal(one[0].needsAttention, true, 'Open coach requests stay flagged');
assert.equal(one[0].needsReview, false, 'Reviewed is not the same as resolved');

const replied = groupAdvisorCommunications([
  msg('received-1'),
  msg('sent-1', { direction: 'sent', gmailMessageId: 'gmail-msg-3', timestamp: '2026-10-10T14:00:00Z', actionRequired: false }),
]);
assert.equal(replied.length, 1);
assert.equal(replied[0].needsAttention, false, 'A later sent reply removes unanswered-email count');
assert.equal(replied[0].sentCount, 1);

const distinct = groupAdvisorCommunications([
  msg('received-1'),
  msg('received-2', { gmailThreadId: 'gmail-thread-2', gmailMessageId: 'gmail-msg-2' }),
]);
assert.equal(distinct.length, 2, 'Never combine distinct Gmail threads by subject');

const linkedFallback = groupAdvisorCommunications([
  msg('received-1'),
  msg('sent-1', { direction: 'sent', subject: 'Re: Recruiting follow-up', gmailThreadId: null, gmailMessageId: null, timestamp: '2026-10-10T15:00:00Z', actionRequired: false }),
]);
assert.equal(linkedFallback.length, 1, 'Attach one unambiguous manually logged reply');

const ambiguous = groupAdvisorCommunications([
  msg('received-1'),
  msg('received-2', { gmailThreadId: 'gmail-thread-2', gmailMessageId: 'gmail-msg-2' }),
  msg('sent-1', { direction: 'sent', gmailThreadId: null, gmailMessageId: null, timestamp: '2026-10-10T15:00:00Z', actionRequired: false }),
]);
assert.equal(ambiguous.length, 3, 'Ambiguous fallback must not merge unrelated Gmail threads');

const generic = groupAdvisorCommunications([
  msg('received-1', { gmailThreadId: null, gmailMessageId: null, subject: 'Coach email' }),
  msg('received-2', { gmailThreadId: null, gmailMessageId: null, subject: 'Coach email' }),
]);
assert.equal(generic.length, 2, 'Generic subjects must not collapse separate messages');

const completed = groupAdvisorCommunications([msg('received-1', { actionState: 'completed' })]);
assert.equal(completed[0].needsAttention, false, 'Completed actions do not count as open');
const unread = groupAdvisorCommunications([msg('received-1', { reviewed: false })]);
assert.equal(unread[0].needsReview, true, 'Unreviewed open actions need athlete review');

const duplicate = groupAdvisorCommunications([
  msg('received-1'),
  msg('same-gmail-id', { gmailMessageId: 'gmail-msg-1' }),
]);
assert.equal(duplicate[0].messages.length, 1, 'Do not double-count one Gmail message');

// Test the exact email presentation and Gmail MIME metadata helpers used by
// the Advisor reader. These are pure functions; no live Gmail access required.
function loadTs(relativePath) {
  const code = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const scope = { exports: {}, URL };
  vm.runInNewContext(js, scope);
  return scope.exports;
}
const { formatRecruitingEmail, emailLinkParts, safeAttachmentMetadata } = loadTs('../lib/recruiting-email-display.ts');
const { extractGmailAttachmentMetadata } = loadTs('../lib/gmail-attachment-metadata.ts');

const rawCoachEmail = [
  'We have a fall skills academy. I have attached a flyer.',
  '',
  'Thanks a bunch,',
  '[cid:image001.png@sample]',
  'GO CATS!',
  'Coach Example',
  'Email: coach@example.edu<mailto:coach@example.edu>',
  'Softball<https://example.edu/sports/softball>',
].join('\n');
const formatted = formatRecruitingEmail(rawCoachEmail);
assert.ok(formatted.message.includes('attached a flyer'), 'Retain the coach message');
assert.ok(!formatted.message.includes('GO CATS'), 'Move closing into signature');
assert.ok(formatted.signature.includes('GO CATS'), 'Preserve signature');
assert.ok(!formatted.signature.includes('[cid:'), 'Hide inline CID markup in clean view');
assert.ok(formatted.signature.includes('coach@example.edu'), 'Keep email contact');
assert.ok(!formatted.signature.includes('mailto:'), 'Remove duplicated mailto markup');
assert.ok(formatted.signature.includes('https://example.edu/sports/softball'), 'Keep web links');
assert.equal(formatted.attachmentMentioned, true, 'Flag mentioned but unverified attachments');
assert.ok(rawCoachEmail.includes('[cid:'), 'Saved original text remains intact');

const short = formatRecruitingEmail('Hi Coach,\nThanks for the invitation.');
assert.equal(short.signature, null, 'Do not invent a signature');
assert.equal(short.attachmentMentioned, false);

const links = emailLinkParts('Email coach@example.edu or https://example.edu/path.');
assert.ok(links.some(p => p.href === 'mailto:coach@example.edu'), 'Linkify mailto safely');
assert.ok(links.some(p => p.href === 'https://example.edu/path'), 'Linkify web URL without punctuation');
assert.ok(!emailLinkParts('javascript:alert(1)').some(p => p.href), 'Do not create script links');

const mime = {
  mimeType: 'multipart/mixed', parts: [
    { mimeType: 'text/plain', body: { data: 'text', size: 50 } },
    { mimeType: 'image/png', filename: 'signature.png', headers: [
      { name: 'Content-Disposition', value: 'inline' }, { name: 'Content-ID', value: '<image001>' },
    ], body: { attachmentId: 'private-google-id', size: 2500 } },
    { mimeType: 'application/pdf', filename: 'camp-flyer.pdf', headers: [
      { name: 'Content-Disposition', value: 'attachment' },
    ], body: { attachmentId: 'another-private-id', size: 60000 } },
  ],
};
const metadata = extractGmailAttachmentMetadata(mime);
assert.equal(metadata.attachmentMetadataChecked, true);
assert.equal(metadata.attachments.length, 2, 'Exclude text parts and include actual file parts');
assert.equal(metadata.attachments[0].inline, true, 'Inline image is not a regular attachment');
assert.equal(metadata.attachments[1].name, 'camp-flyer.pdf');
assert.ok(!JSON.stringify(metadata).includes('private-google-id'), 'Never expose Gmail attachment IDs');
const sanitized = safeAttachmentMetadata(metadata);
assert.equal(sanitized.attachments.length, 2);
assert.equal(sanitized.attachments[1].size, 60000);
assert.equal(safeAttachmentMetadata({ urls: [] }).checked, false, 'Legacy rows are unverified');
assert.equal(extractGmailAttachmentMetadata(undefined).attachmentMetadataChecked, false);

console.log('Advisor Communications threading, email reader, and attachment metadata smoke tests passed.');
