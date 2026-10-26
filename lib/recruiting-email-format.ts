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

export type RecruitingEmailSubjectFields = {
  name?: unknown;
  grad?: unknown;
  positions?: unknown;
  throwBat?: unknown;
  gpa?: unknown;
  college?: unknown;
  jersey?: unknown;
};

export type RecruitingEmailSubjectPreferences = {
  subjectMode?: "default" | "custom";
  customSubjectTemplate?: string;
};

export const DEFAULT_RECRUITING_SUBJECT_TEMPLATE =
  "{{topic}} | {{name}} | {{grad}} | {{positionsAndBats}} | {{gpaLabel}}";

export const RECRUITING_SUBJECT_TOKENS = [
  "topic", "name", "grad", "positions", "bats",
  "positionsAndBats", "gpa", "gpaLabel", "college", "jersey",
] as const;

/** Display only. Do not round or modify the GPA saved on the athlete profile. */
export function formatRecruitingEmailGpa(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 5) return numeric.toFixed(2);
  }
  return raw;
}

/** Returns an error message, or null for a safe, usable custom subject pattern. */
export function validateRecruitingSubjectTemplate(template: unknown): string | null {
  if (typeof template !== "string" || !template.trim()) return "Enter a subject format.";
  if (template.length > 200) return "Subject format must be 200 characters or fewer.";
  if (/[\r\n]/.test(template)) return "Subject format must stay on one line.";
  const unknown = [...template.matchAll(/{{([^{}]+)}}/g)]
    .map(match => match[1])
    .find(token => !(RECRUITING_SUBJECT_TOKENS as readonly string[]).includes(token));
  if (unknown) return "Unknown field: " + unknown + ". Use the supported fields shown below.";
  if (template.replace(/{{[^{}]+}}/g, "").includes("{{") || template.replace(/{{[^{}]+}}/g, "").includes("}}"))
    return "Check the field brackets in your subject format.";
  return null;
}

export function buildRecruitingEmailSubject(
  topic: string,
  fields: RecruitingEmailSubjectFields,
  preferences?: RecruitingEmailSubjectPreferences,
): string {
  const name = String(fields.name ?? "").trim() || "[Full Name]";
  const year = String(fields.grad ?? "").trim() || "[Graduation Year]";
  const positions = String(fields.positions ?? "").trim().replace(/\s*\/\s*/g, "/") || "[Positions]";
  const bats = recruitingBattingStyle(fields.throwBat) || "[Bats]";
  const positionsAndBats = /\/(?:Slap|RHH|LHH)$/i.test(positions) ? positions : positions + "/" + bats;
  const gpa = formatRecruitingEmailGpa(fields.gpa);
  const tokens = {
    topic: topic.trim() || "Recruiting Update",
    name, grad: year, positions, bats, positionsAndBats,
    gpa: gpa || "[GPA]",
    gpaLabel: gpa ? gpa + " GPA" : "[GPA]",
    college: String(fields.college ?? "").trim() || "[College]",
    jersey: String(fields.jersey ?? "").trim() || "[Jersey]",
  };
  const custom = preferences?.subjectMode === "custom" ? preferences.customSubjectTemplate?.trim() : "";
  const pattern = custom && !validateRecruitingSubjectTemplate(custom)
    ? custom : DEFAULT_RECRUITING_SUBJECT_TEMPLATE;
  return pattern.replace(/{{(\w+)}}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key)
      ? tokens[key as keyof typeof tokens] : match
  ).trim().slice(0, 200);
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
