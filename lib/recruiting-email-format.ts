/**
 * Formatting for athlete-to-coach recruiting emails.
 * Presentation only: never rewrite the athlete's saved profile values.
 */
export function formatEmailPhone(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^(?:\+?1[\s().-]*)?\(?(\d{3})\)?[\s().-]*(\d{3})[\s().-]*(\d{4})(?:\s*(?:ext\.?|x|#)\s*(\d+))?$/i);
  if (!match) return raw; // Preserve international, incomplete, and nonstandard numbers.
  return `${match[1]}-${match[2]}-${match[3]}${match[4] ? ` ext. ${match[4]}` : ""}`;
}

export function recruitingBattingStyle(throwBat: unknown): string {
  const raw = String(throwBat ?? "").trim();
  if (/\bslap\b/i.test(raw)) return "Slap";
  if (/\bRHH\b/i.test(raw)) return "RHH";
  if (/\bLHH\b/i.test(raw)) return "LHH";
  const match = raw.match(/\/\s*([RL])(?=\s*(?:$|\(|\/))/i);
  return match ? (match[1].toUpperCase() === "R" ? "RHH" : "LHH") : "";
}

type RecruitingEmailSubjectFields = {
  name?: unknown;
  grad?: unknown;
  positions?: unknown;
  throwBat?: unknown;
  gpa?: unknown;
};

export function buildRecruitingEmailSubject(topic: string, fields: RecruitingEmailSubjectFields): string {
  const name = String(fields.name ?? "").trim() || "[Full Name]";
  const year = String(fields.grad ?? "").trim() || "[Graduation Year]";
  const positions = String(fields.positions ?? "").trim().replace(/\s*\/\s*/g, "/") || "[Positions]";
  const bats = recruitingBattingStyle(fields.throwBat) || "[Bats]";
  const positionsAndBats = /\/(?:Slap|RHH|LHH)$/i.test(positions) ? positions : `${positions}/${bats}`;
  const gpa = String(fields.gpa ?? "").trim();
  return `${topic.trim() || "Recruiting Update"} | ${name} | ${year} | ${positionsAndBats} | ${gpa ? `${gpa} GPA` : "[GPA]"}`;
}

/** Refresh only phone values inside an existing draft's profile-summary footer. */
export function formatDraftSignaturePhones(body: string, name: string, phones: unknown[]): string {
  const marker = name ? `${name} Profile Summary` : "";
  const start = marker ? body.lastIndexOf(marker) : -1;
  if (start < 0) return body;
  let footer = body.slice(start);
  for (const phone of phones) {
    const raw = String(phone ?? "").trim();
    const formatted = formatEmailPhone(raw);
    if (raw && formatted !== raw) footer = footer.split(raw).join(formatted);
  }
  return body.slice(0, start) + footer;
}
