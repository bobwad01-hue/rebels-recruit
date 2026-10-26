import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const journeyApi=read('app/api/journey/route.ts');
const journey=read('app/journey/page.tsx');
const coach=read('app/coaches/[id]/page.tsx');
const composer=read('components/CoachActionBar.tsx');
const send=read('app/api/google/gmail/send/route.ts');
const activity=read('app/activity/[id]/page.tsx');

assert(journeyApi.includes('can_continue_thread: athleteUserId===user.id'), 'Only the signed-in athlete may continue their own sent Gmail threads');
assert(journeyApi.includes('row.actor_user_id===user.id'), 'Do not offer continuation of an advisor-sent email from the athlete mailbox');
assert(journey.includes('action=continue-thread&sentInteraction='), 'Journey sent email needs a Continue Thread action');
assert(activity.includes('action=continue-thread&sentInteraction='), 'Activity details need the same continuation action');
assert(coach.includes('i.actor_user_id===user.id&&i.gmail_message_id&&i.gmail_thread_id'), 'Coach timeline should only offer the action for the athlete\'s actual Gmail sends');
assert(coach.includes('<a href={`/coaches/${id}?action=continue-thread&sentInteraction=${encodeURIComponent(i.id)}`}'), 'Coach timeline must perform a fresh page load for a sent Gmail thread, not reuse stale client navigation state');
assert(coach.includes("qs.action==='continue-thread'&&canReadOwnCoachEmail&&!sentThreadEmail"), 'If original thread validation fails, the athlete must see an explanation instead of a dead click');
assert(coach.includes("No email has been sent."), 'Missing-thread warning must reassure athlete that no email was sent');
assert(coach.includes(".eq('athlete_user_id',user.id).eq('actor_user_id',user.id).eq('coach_id',id)"), 'Coach composer must validate the original sent interaction');
assert(composer.includes('sentInteractionId: contextualReply?.sentInteractionId || null'), 'Composer must pass sent interaction ID to Gmail API');
assert(composer.includes('kind==="sent_follow_up"'), 'Sent follow-ups must not pretend the coach already replied');
assert(send.includes(".eq('type','Email Sent').eq('source','automatic')"), 'Gmail send must restrict sent-thread anchors to real Gmail sends');
assert(send.includes("om.threadId!==outgoing.gmail_thread_id"), 'Gmail send must verify the original Gmail thread');
assert(send.includes("om.labelIds?.includes('SENT')"), 'Gmail send must verify that the original Gmail message was sent');
assert(send.includes("addresses(header('To')).includes(originalRecipient)"), 'Gmail send must preserve the original verified recipient');
assert(send.includes('replyMeta={threadId:outgoing.gmail_thread_id'), 'Gmail send must retain Gmail thread and Message-ID headers');
assert(send.includes('...(threadReplyMeta?{threadId:threadReplyMeta.threadId}:{})'), 'Gmail send must retain threadId only when the subject is unchanged');
assert(send.includes('const threadReplyMeta=startedNewConversation?null:replyMeta'), 'Changing subject must never send old Gmail threading metadata');

console.log('Sent Gmail thread continuation security, routing, and history smoke tests passed.');
