// Shared, explicit email personalization tokens. Templates store tokens, never coach-specific values.
export const EMAIL_PERSONALIZATION_FIELDS = [
  { key: "coachLastName", label: "Coach's Last Name" },
  { key: "coachFirstName", label: "Coach's First Name" },
  { key: "coachFullName", label: "Coach's Full Name" },
  { key: "collegeName", label: "College Name" },
] as const;

export type EmailPersonalizationKey = (typeof EMAIL_PERSONALIZATION_FIELDS)[number]["key"];
export type EmailPersonalizationValues = Partial<Record<EmailPersonalizationKey, string>>;

const aliases: Record<string, EmailPersonalizationKey> = {
  coachlastname: "coachLastName",
  coachslastname: "coachLastName",
  coachfirstname: "coachFirstName",
  coachsfirstname: "coachFirstName",
  coachfullname: "coachFullName",
  coachsfullname: "coachFullName",
  collegename: "collegeName",
  schoolname: "collegeName",
};

export function emailPersonalizationKey(raw: string): EmailPersonalizationKey | null {
  return aliases[raw.replace(/[^a-z0-9]/gi, "").toLowerCase()] || null;
}

export function emailPersonalizationToken(key: EmailPersonalizationKey): string {
  return "{{" + key + "}}";
}

// Accept old hand-entered syntax such as {{Coach Last Name}} as well as the
// canonical tokens inserted by the editor. Keep unknown tokens for validation.
export function normalizeEmailPersonalizationTokens(text: string): string {
  return text.replace(/{{\s*([^{}]+?)\s*}}/g, (original, raw: string) => {
    const key = emailPersonalizationKey(raw);
    return key ? emailPersonalizationToken(key) : original;
  });
}

export function hasEmailPersonalizationTokens(text: string): boolean {
  return /{{\s*[^{}]+?\s*}}/.test(text);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function resolveEmailPersonalization(
  text: string,
  values: EmailPersonalizationValues,
  html = false,
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const resolved = text.replace(/{{\s*([^{}]+?)\s*}}/g, (original, raw: string) => {
    const key = emailPersonalizationKey(raw);
    if (!key) {
      missing.add(String(raw).trim());
      return original;
    }
    const value = String(values[key] || "").trim();
    if (!value) {
      missing.add(EMAIL_PERSONALIZATION_FIELDS.find((field) => field.key === key)!.label);
      return original;
    }
    return html ? escapeHtml(value) : value;
  });
  return { text: resolved, missing: [...missing] };
}
