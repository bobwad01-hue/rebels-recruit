import { cleanDisplayNote } from "@/lib/display-notes";

export type JourneyEntry = {
  type: string;
  note?: string | null;
  email_subject?: string | null;
  email_type?: string | null;
  email_content?: string | null;
  source?: string | null;
  gmail_intelligence?: { subject?: string | null; summary?: string | null } | null;
};

const isEmail = (entry: JourneyEntry) => /^Email (Sent|Received)$/i.test(entry.type);
const displayText = (value: string | null | undefined) => cleanDisplayNote(value).trim();
const shortText = (value: string, max = 190) => value.length > max ? value.slice(0, max - 1).trimEnd() + "…" : value;
const legacySubject = (note: string) => note.match(/(?:^|\n)Subject:\s*(.*?)(?=\s+Email Type:|\n|$)/i)?.[1]?.trim() || "";
const legacyEmailType = (note: string) => note.match(/Email Type:\s*([^\n]+)/i)?.[1]?.trim() || "";
const readableEmailType = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());

function emailFields(entry: JourneyEntry) {
  const note = displayText(entry.note);
  const subject = displayText(entry.email_subject) || displayText(entry.gmail_intelligence?.subject) || legacySubject(note);
  const emailType = displayText(entry.email_type) || legacyEmailType(note);
  const content = displayText(entry.email_content);
  const summary = displayText(entry.gmail_intelligence?.summary);
  // Some imported messages store the subject alone in email_content. That is not a message body.
  const body = content && content !== subject ? content : "";
  const metadataOnly = /^Subject:\s*/i.test(note) && /Email Type:/i.test(note);
  const extra = note && !metadataOnly && note !== subject && note !== content && note !== summary ? note : "";
  return { subject, emailType, body, summary: !body && summary !== subject ? summary : "", extra };
}

function debriefFields(note: string) {
  const matches = Array.from(note.matchAll(/\b(Coaches\s+spoken\s+with|Interest\s+signal|Follow[\s-]*up)\s*:/gi));
  const lead = matches.length ? note.slice(0, matches[0].index).trim() : note;
  const eventMatch = lead.match(/^([^:\n]{4,180}):\s*([\s\S]*)$/);
  const result: { label: string; value: string }[] = [];
  if (eventMatch) {
    result.push({ label: "Event", value: eventMatch[1].trim() });
    if (eventMatch[2].trim()) result.push({ label: "What happened", value: eventMatch[2].trim() });
  } else if (lead) {
    result.push({ label: "Debrief notes", value: lead });
  }
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const value = note.slice((match.index || 0) + match[0].length, matches[index + 1]?.index ?? note.length).trim();
    if (!value) continue;
    const key = match[1].toLowerCase();
    result.push({
      label: key.startsWith("coaches") ? "Coaches spoken with" : key.startsWith("interest") ? "Interest signal" : "Follow-up",
      value,
    });
  }
  return result;
}

export function JourneyEntryPreview({ entry, expanded = false }: { entry: JourneyEntry; expanded?: boolean }) {
  if (expanded) return null;
  const note = displayText(entry.note);
  if (isEmail(entry)) {
    const { subject, body, summary } = emailFields(entry);
    const value = subject || shortText((body || summary || note).replace(/\s+/g, " "), 175);
    if (!value) return null;
    return <p className="mt-2 text-sm sm:text-[15px] leading-6 text-slate-700 line-clamp-2 break-words">
      <span className="font-bold text-slate-600">{subject ? "Subject: " : "Recorded detail: "}</span>{value}
    </p>;
  }
  if (!note) return null;
  const fields = entry.type === "Event Debrief" ? debriefFields(note) : [];
  const preview = fields.length ? fields.map(field => field.value).join(" · ") : note;
  return <p className="mt-2 text-sm sm:text-[15px] leading-6 text-slate-600 line-clamp-2 break-words">{shortText(preview.replace(/\s+/g, " "), 220)}</p>;
}

export function JourneyEntryDetails({ entry }: { entry: JourneyEntry }) {
  const note = displayText(entry.note);
  if (isEmail(entry)) {
    const { subject, emailType, body, summary, extra } = emailFields(entry);
    return <div className="space-y-4 text-sm sm:text-[15px] text-slate-700">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Subject</dt>
          <dd className="mt-1 font-semibold break-words">{subject || "Not recorded"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Email type</dt>
          <dd className="mt-1 break-words">{emailType ? readableEmailType(emailType) : "Not recorded"}</dd>
        </div>
      </dl>
      {body ? <div className="border-t pt-4">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Recorded message</h4>
        <p className="whitespace-pre-wrap break-words leading-7">{body}</p>
      </div> : summary ? <div className="border-t pt-4">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Recorded summary</h4>
        <p className="whitespace-pre-wrap break-words leading-7">{summary}</p>
      </div> : <p className="border-t pt-3 text-slate-500">No message body was recorded for this email.</p>}
      {extra && <div className="border-t pt-3">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-1">Additional recorded details</h4>
        <p className="whitespace-pre-wrap break-words leading-6">{extra}</p>
      </div>}
    </div>;
  }
  if (entry.type === "Event Debrief" && note) {
    return <dl className="grid gap-3 text-sm sm:text-[15px]">{debriefFields(note).map((field, index) =>
      <div key={field.label + index} className="min-w-0">
        <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{field.label}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words leading-7 text-slate-700">{field.value}</dd>
      </div>)}</dl>;
  }
  return <div className="text-sm sm:text-[15px] leading-7 whitespace-pre-wrap break-words text-slate-700">
    {note || "No notes recorded for this activity."}
  </div>;
}
