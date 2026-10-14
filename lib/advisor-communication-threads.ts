/**
 * Advisor Communications uses real Gmail thread IDs whenever available.
 * Subject matching is a conservative fallback for manually logged / unlinked
 * messages; two different Gmail threads are never merged just because their
 * subjects happen to match.
 */
export type AdvisorMessage = {
  id: string;
  athleteId: string;
  athleteName: string;
  coachId: string | null;
  coachName: string;
  collegeId: string | null;
  schoolName: string;
  direction: 'sent' | 'received';
  sentByAdvisor: boolean;
  subject: string;
  body: string | null;
  summary: string | null;
  timestamp: string;
  tracked: boolean;
  actionRequired: boolean;
  actionState: string | null;
  actionDecision: string | null;
  nextAction: string | null;
  reviewed: boolean;
  source: 'gmail' | 'rltnl' | 'manual';
  gmailThreadId: string | null;
  gmailMessageId: string | null;
  senderEmail: string | null;
};

export type AdvisorThread = {
  id: string;
  athleteId: string;
  athleteName: string;
  coachName: string;
  schoolName: string;
  subject: string;
  lastActivity: string;
  messages: AdvisorMessage[];
  sentCount: number;
  receivedCount: number;
  needsAttention: boolean;
  needsReview: boolean;
  suggestedNextAction: string | null;
  latest: AdvisorMessage;
};

const GAP_MS = 45 * 24 * 60 * 60 * 1000;
const resolvedStates = new Set(['completed', 'closed', 'dismissed', 'done', 'no_action']);
const genericSubjects = new Set(['', 'coach email', 'recruiting email', '(no subject)', 'no subject']);

export function normalizedSubject(value: string | null | undefined) {
  return String(value || '')
    .replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/gi, '')
    .trim().replace(/\s+/g, ' ').toLowerCase();
}

function identity(message: AdvisorMessage) {
  return [message.athleteId, message.collegeId || message.schoolName.toLowerCase(), message.coachId || message.coachName.toLowerCase()].join('|');
}
function closeInTime(a: AdvisorMessage, b: AdvisorMessage) {
  const x = Date.parse(a.timestamp), y = Date.parse(b.timestamp);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= GAP_MS;
}
function canAttach(message: AdvisorMessage, group: AdvisorMessage[]) {
  const subject = normalizedSubject(message.subject);
  return !genericSubjects.has(subject)
    && identity(message) === identity(group[0])
    && group.some(existing => normalizedSubject(existing.subject) === subject && closeInTime(existing, message));
}

export function groupAdvisorCommunications(items: AdvisorMessage[]): AdvisorThread[] {
  const byGmail = new Map<string, AdvisorMessage[]>();
  const groups: { id: string; messages: AdvisorMessage[] }[] = [];
  const withoutThread: AdvisorMessage[] = [];
  const seen = new Set<string>();

  // Deduplicate a Gmail message represented both by a Gmail row and an
  // interaction. Distinct Gmail IDs are always distinct messages.
  const sorted = [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id));
  for (const message of sorted) {
    const dedupe = message.gmailMessageId ? 'gmail:' + message.athleteId + ':' + message.gmailMessageId : 'row:' + message.id;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    if (!message.gmailThreadId) { withoutThread.push(message); continue; }
    const key = identity(message) + '|gmail:' + message.gmailThreadId;
    let group = byGmail.get(key);
    if (!group) {
      group = [];
      byGmail.set(key, group);
      groups.push({ id: key, messages: group });
    }
    group.push(message);
  }

  for (const message of withoutThread) {
    // Only attach to a known Gmail thread if there is *one* unambiguous
    // candidate. Never fuse two separate Gmail conversations by subject.
    const candidates = groups.filter(group => canAttach(message, group.messages));
    if (candidates.length === 1) candidates[0].messages.push(message);
    else {
      // For messages with no Gmail thread, use subject + relationship + a
      // 45-day activity window, but do not group generic subjects.
      const fallback = groups.filter(group => !group.id.includes('|gmail:') && canAttach(message, group.messages));
      if (fallback.length === 1) fallback[0].messages.push(message);
      else groups.push({ id: 'manual:' + message.id, messages: [message] });
    }
  }

  return groups.map(group => {
    const chronological = [...group.messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
    const latest = chronological[chronological.length - 1];
    const outstanding = chronological.filter(m => {
      if (m.direction !== 'received' || !m.actionRequired || resolvedStates.has((m.actionState || '').toLowerCase())) return false;
      const receivedAt = Date.parse(m.timestamp);
      // A later outbound message in this conversation is evidence of a
      // response, not proof that every future task is completed. We keep the
      // suggestion visible on the original message, but do not count it as an
      // unanswered coach email in the summary.
      return !chronological.some(reply => reply.direction === 'sent' && Date.parse(reply.timestamp) > receivedAt);
    });
    const pending = outstanding[outstanding.length - 1];
    const subject = [...chronological].reverse().find(m => !genericSubjects.has(normalizedSubject(m.subject)))?.subject || latest.subject;
    return {
      id: group.id,
      athleteId: latest.athleteId,
      athleteName: latest.athleteName,
      coachName: latest.coachName,
      schoolName: latest.schoolName,
      subject,
      lastActivity: latest.timestamp,
      messages: chronological,
      sentCount: chronological.filter(m => m.direction === 'sent').length,
      receivedCount: chronological.filter(m => m.direction === 'received').length,
      needsAttention: outstanding.length > 0,
      needsReview: outstanding.some(m => !m.reviewed),
      suggestedNextAction: pending?.nextAction || null,
      latest,
    };
  }).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}
