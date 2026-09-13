"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Mail,
  MessageCircle,
  Phone,
  Activity,
  Clock3,
  UserRound,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import {
  EMAIL_STARTERS,
  starterById,
  type EmailStarterId,
} from "@/lib/recruiting-email-playbook";
import RichEmailEditor, {
  type EmailAttachment,
} from "@/components/RichEmailEditor";
import EmailVideoPicker from "@/components/EmailVideoPicker";
type PrimaryAction = "email" | "text" | "call" | "log" | "reminder" | null;
type Props = {
  coachId: string;
  collegeId: string;
  coachName: string;
  collegeName?: string;
  email?: string | null;
  phone?: string | null;
  athleteUserId?: string;
  compact?: boolean;
  hideReminder?: boolean;
  hideRelationship?: boolean;
  primaryAction?: PrimaryAction;
  initialEmailStarter?: EmailStarterId;
  autoOpenEmail?: boolean;
};
export default function CoachActionBar({
  coachId,
  collegeId,
  coachName,
  collegeName,
  email,
  phone,
  athleteUserId,
  compact = false,
  hideReminder = false,
  hideRelationship = false,
  primaryAction = null,
  initialEmailStarter = "introduction",
  autoOpenEmail = false,
}: Props) {
  const c = createClient(),
    params = useSearchParams(),
    opened = useRef(false),
    draftReady = useRef(false),
    draftKey = `rr-email-draft:${athleteUserId || "self"}:${coachId}`,
    requested = params.get("emailStarter") as EmailStarterId | null,
    requestedValid = EMAIL_STARTERS.some((s) => s.id === requested),
    effectiveStarter =
      requestedValid && requested ? requested : initialEmailStarter,
    shouldAutoOpen = autoOpenEmail || !!requestedValid;
  const [emailOpen, setEmailOpen] = useState(false),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [bodyHtml, setBodyHtml] = useState(""),
    [attachments, setAttachments] = useState<EmailAttachment[]>([]),
    [starter, setStarter] = useState<EmailStarterId>(effectiveStarter),
    [openingIndex, setOpeningIndex] = useState(0),
    [profile, setProfile] = useState<any>(null),
    [message, setMessage] = useState(""),
    [draftNotice, setDraftNotice] = useState(""),
    [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error">(
      "idle",
    ),
    [gmailConnected, setGmailConnected] = useState<boolean | null>(null),
    [reminderOpen, setReminderOpen] = useState(false),
    [reminderDate, setReminderDate] = useState(""),
    [busy, setBusy] = useState(false),
    [schoolCoaches, setSchoolCoaches] = useState<any[]>([]),
    [ccCoachIds, setCcCoachIds] = useState<string[]>([]);
  async function context() {
    const {
      data: { user },
    } = await c.auth.getUser();
    return user ? { user, athlete: athleteUserId || user.id } : null;
  }
  function values(p: any) {
    const a = p?.athlete || {},
      pr = p?.profile || {},
      s = p?.signature || {},
      positions = Array.isArray(a.positions)
        ? a.positions.join("/")
        : a.position || "",
      majors = Array.isArray(a.interested_majors)
        ? a.interested_majors.filter(Boolean).join(" or ")
        : a.academic_interest || "";
    return {
      name: pr.full_name || a.full_name || "",
      grad: a.class_year || a.grad_year || "",
      school: a.school_name || a.school || "",
      positions,
      gpa: a.gpa || "",
      jersey: a.jersey_number || "",
      travelTeam: s.travelTeamName || a.travel_team || "",
      academic: majors,
      college: collegeName || "your program",
      mobile: pr.phone || "",
      email: pr.email || "",
      twitter: s.xTwitter || a.twitter || a.twitter_handle || "",
      sports:
        s.sportsRecruitsUrl ||
        a.sportsrecruits_url ||
        a.sports_recruits_url ||
        "",
      travelCoach: s.travelTeamCoachName || "",
      travelCoachPhone: s.travelTeamCoachPhone || "",
      hsCity: s.highSchoolCity || "",
      hsState: s.highSchoolState || a.primary_state || "",
      hsCoach: s.highSchoolCoachName || "",
      hsCoachPhone: s.highSchoolCoachPhone || "",
      throwBat: s.throwBat || a.throw_bat || "",
      ncaa: s.ncaaNumber || a.ncaa_number || "",
    };
  }
  function fill(text: string, p: any) {
    const v = values(p);
    return text.replace(/{{(\w+)}}/g, (_, k) =>
      String((v as any)[k] || `[${k}]`),
    );
  }
  function signature(p: any) {
    const v = values(p),
      lines: string[] = [];
    if (v.name) lines.push(`${v.name} Profile Summary`);
    if (v.mobile) lines.push(`Mobile: ${v.mobile}`);
    if (v.email) lines.push(`Email: ${v.email}`);
    if (v.twitter) lines.push(`X/Twitter: ${v.twitter}`);
    if (v.grad) lines.push(`Graduation Year: ${v.grad}`);
    if (v.sports) lines.push(`SportsRecruits Profile: ${v.sports}`);
    if (v.travelTeam) {
      let x = v.travelTeam;
      if (v.travelCoach || v.travelCoachPhone)
        x += ` (${[v.travelCoach, v.travelCoachPhone].filter(Boolean).join(": ")})`;
      lines.push(`Travel Team: ${x}`);
    }
    if (v.school) {
      let x = v.school,
        loc = [v.hsCity, v.hsState].filter(Boolean).join(", ");
      if (loc) x += `, ${loc}`;
      if (v.hsCoach || v.hsCoachPhone)
        x += ` (${[v.hsCoach, v.hsCoachPhone].filter(Boolean).join(": ")})`;
      lines.push(`High School: ${x}`);
    }
    if (v.positions) lines.push(`Position: ${v.positions}`);
    if (v.throwBat) lines.push(`Throw/Bat: ${v.throwBat}`);
    if (v.academic) lines.push(`Academic Interest: ${v.academic}`);
    if (v.ncaa) lines.push(`NCAA #: ${v.ncaa}`);
    return lines.join("\n");
  }
  function compose(id: EmailStarterId, index: number, p: any) {
    const s = starterById(id),
      v = values(p),
      sig = signature(p),
      lastName = coachName.trim().split(/\s+/).slice(-1)[0] || coachName;
    setBodyHtml("");
    if (id === "custom") {
      setSubject("");
      setBody(sig ? `\n\n${sig}` : "");
      return;
    }
    setSubject(
      `${s.purpose} | ${v.name || "[Your Name]"} | ${v.grad || "[Grad Year]"} | ${v.positions || "[POS]"} | ${v.gpa || "[GPA]"} | #${v.jersey || "[Jersey]"}`,
    );
    const opening = fill(
        s.openings[index]?.text || s.openings[0]?.text || "",
        p,
      ),
      ask = fill(s.ask, p);
    setBody(
      `Hello Coach ${lastName},\n\n${opening}${ask ? `\n\n${ask}` : ""}${sig ? `\n\n${sig}` : ""}`,
    );
  }
  function insertVideo(video: { title: string; url: string }) {
    setBody(
      (current) => `${current.trimEnd()}\n\n${video.title}: ${video.url}`,
    );
    setBodyHtml("");
  }
  async function loadProfile() {
    const ctx = await context();
    if (!ctx) return null;
    try {
      const r = await fetch(
        `/api/profile/email-signature?athlete=${encodeURIComponent(ctx.athlete)}`,
        { cache: "no-store" },
      );
      if (!r.ok) return null;
      const d = await r.json();
      setProfile(d);
      return d;
    } catch {
      return null;
    }
  }
  async function loadSchoolCoaches() {
    const { data } = await c
      .from("college_coaches")
      .select("id,first_name,last_name,title,email")
      .eq("college_id", collegeId)
      .order("last_name");
    setSchoolCoaches((data || []).filter((x: any) => x.id !== coachId));
  }
  async function checkGmailConnection() {
    const ctx = await context();
    if (!ctx) {
      setGmailConnected(false);
      return false;
    }
    const { data, error } = await c
      .from("google_workspace_connections")
      .select("gmail_connected")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    const connected = !error && data?.gmail_connected === true;
    setGmailConnected(connected);
    return connected;
  }
  async function buildStarter(id: EmailStarterId, index = 0) {
    setStarter(id);
    setOpeningIndex(index);
    setAttachments([]);
    compose(id, index, profile || (await loadProfile()));
  }
  function chooseOpening(i: number) {
    setOpeningIndex(i);
    compose(starter, i, profile);
  }
  function openEmail(id: EmailStarterId = effectiveStarter) {
    if (!email) return;
    setMessage("");
    setDraftNotice("");
    setEmailStatus("idle");
    setAttachments([]);
    setCcCoachIds([]);
    setEmailOpen(true);
    let recovered = false;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved?.subject && saved?.body) {
        setSubject(String(saved.subject));
        setBody(String(saved.body));
        setBodyHtml(String(saved.bodyHtml || ""));
        setStarter(
          EMAIL_STARTERS.some((item) => item.id === saved.starter)
            ? saved.starter
            : id,
        );
        setOpeningIndex(Number(saved.openingIndex || 0));
        setCcCoachIds(Array.isArray(saved.ccCoachIds) ? saved.ccCoachIds : []);
        setDraftNotice("Your saved draft was recovered.");
        recovered = true;
      }
    } catch {}
    draftReady.current = true;
    if (!recovered) buildStarter(id);
    loadSchoolCoaches();
    checkGmailConnection();
  }
  useEffect(() => {
    if (shouldAutoOpen && email && !opened.current) {
      opened.current = true;
      openEmail(effectiveStarter);
    }
  }, [shouldAutoOpen, email, effectiveStarter]);
  useEffect(() => {
    if (!emailOpen || !draftReady.current || (!subject && !body)) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          subject,
          body,
          bodyHtml,
          starter,
          openingIndex,
          ccCoachIds,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {}
  }, [
    emailOpen,
    draftKey,
    subject,
    body,
    bodyHtml,
    starter,
    openingIndex,
    ccCoachIds,
  ]);
  async function sendEmail() {
    const ctx = await context();
    if (!ctx) {
      setEmailStatus("error");
      setMessage("Your session could not be verified. Please sign in again.");
      return;
    }
    const connected =
      gmailConnected === true ? true : await checkGmailConnection();
    if (!connected) {
      setEmailStatus("error");
      setMessage(
        "Connect Gmail before sending. Signing in with Google does not automatically give Rebels Recruit permission to send email.",
      );
      return;
    }
    const s = starterById(starter);
    if (s.requiresSchoolReason && body.includes("[ADD ONE SPECIFIC")) {
      setEmailStatus("error");
      setMessage(
        "For an introduction email, add a specific reason this school fits you before sending.",
      );
      return;
    }
    if (starter !== "custom" && /\[[A-Z][A-Z0-9 ’'&/.,-]{2,}\]/.test(body)) {
      setEmailStatus("error");
      setMessage(
        "Replace the remaining bracketed starter prompts with your own details before sending.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    setEmailStatus("idle");
    try {
      const r = await fetch("/api/google/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId,
          ccCoachIds,
          athleteUserId: ctx.athlete,
          subject,
          body,
          bodyHtml,
          emailPurpose: starter,
          attachments,
        }),
      });
      let d: any = {};
      try {
        d = await r.json();
      } catch {}
      if (!r.ok) {
        setEmailStatus("error");
        setMessage(d.error || `Could not send email (error ${r.status}).`);
        return;
      }
      setEmailStatus("success");
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setDraftNotice("");
      setMessage(
        d.logged
          ? `Email sent through Gmail${d.ccCount ? ` to ${d.ccCount + 1} coaches` : ""} and logged in Activity.`
          : "Email sent through Gmail, but Activity could not be updated.",
      );
    } catch {
      setEmailStatus("error");
      setMessage("Could not send email. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function createReminder(days?: number) {
    const ctx = await context();
    if (!ctx) return;
    const d = reminderDate ? new Date(`${reminderDate}T12:00:00`) : new Date();
    if (days) d.setDate(d.getDate() + days);
    setBusy(true);
    setMessage("");
    const { data, error } = await c
      .from("reminders")
      .insert({
        owner_user_id: ctx.user.id,
        athlete_user_id: ctx.athlete,
        college_id: collegeId,
        coach_id: coachId,
        title: `Follow up with ${coachName}`,
        due_date: d.toISOString().slice(0, 10),
        status: "open",
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      setMessage(error?.message || "Could not create reminder.");
      return;
    }
    let synced = false;
    try {
      synced = (
        await fetch("/api/google/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "reminder", entityId: data.id }),
        })
      ).ok;
    } catch {}
    setBusy(false);
    setReminderOpen(false);
    setReminderDate("");
    setMessage(
      synced
        ? "Reminder created and synced to Google Calendar."
        : "Reminder created.",
    );
  }
  const base = compact ? "btn py-1.5 px-2.5 text-xs" : "btn",
    primary = `${base} btn-red`,
    reminderSecondary = `${base} bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100`,
    cls = (a: PrimaryAction, disabled = false) =>
      `${primaryAction === a ? primary : a === "reminder" ? reminderSecondary : base} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`,
    logHref = `/activity/new?college=${collegeId}&coach=${coachId}${athleteUserId ? `&athlete=${athleteUserId}` : ""}`,
    hubHref = `/coaches/${coachId}${athleteUserId ? `?athlete=${athleteUserId}` : ""}`,
    current = starterById(starter);
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        {!hideRelationship && (
          <Link className={base} href={hubHref}>
            <UserRound size={compact ? 13 : 15} /> Relationship
          </Link>
        )}
        <button
          type="button"
          className={cls("email", !email)}
          disabled={!email}
          onClick={() => openEmail()}
        >
          <Mail size={compact ? 13 : 15} /> Email
        </button>
        <a
          className={`${cls("text", !phone)} ${phone ? "" : "pointer-events-none"}`}
          href={phone ? `sms:${phone}` : undefined}
        >
          <MessageCircle size={compact ? 13 : 15} /> Text
        </a>
        <a
          className={`${cls("call", !phone)} ${phone ? "" : "pointer-events-none"}`}
          href={phone ? `tel:${phone}` : undefined}
        >
          <Phone size={compact ? 13 : 15} /> Call
        </a>
        <Link className={cls("log")} href={logHref}>
          <Activity size={compact ? 13 : 15} /> Log
        </Link>
        {!hideReminder && (
          <button
            type="button"
            className={cls("reminder")}
            onClick={() => setReminderOpen((v) => !v)}
          >
            <Clock3 size={compact ? 13 : 15} /> Reminder
          </button>
        )}
      </div>
      {!hideReminder && reminderOpen && (
        <div className="mt-3 rounded-xl border bg-white p-3">
          <div className="text-sm font-bold">Remind me to follow up</div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              className="btn py-1.5 px-2.5 text-xs"
              disabled={busy}
              onClick={() => createReminder(1)}
            >
              Tomorrow
            </button>
            <button
              className="btn py-1.5 px-2.5 text-xs"
              disabled={busy}
              onClick={() => createReminder(3)}
            >
              3 days
            </button>
            <button
              className="btn py-1.5 px-2.5 text-xs"
              disabled={busy}
              onClick={() => createReminder(7)}
            >
              1 week
            </button>
            <input
              className="input py-1.5 text-xs max-w-[155px]"
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
            />
            <button
              className="btn btn-red py-1.5 px-2.5 text-xs"
              disabled={!reminderDate || busy}
              onClick={() => createReminder()}
            >
              Set date
            </button>
          </div>
        </div>
      )}
      {message && !emailOpen && (
        <div className="text-xs mt-2 font-semibold">{message}</div>
      )}
      {emailOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-slate-950/40 p-0 sm:p-4"
            onMouseDown={(e) => {
              if (e.currentTarget === e.target && !busy) setEmailOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="email-dialog-title"
              className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-2xl"
            >
              <div className="shrink-0 p-5 border-b flex justify-between gap-4">
                <div>
                  <h2 id="email-dialog-title" className="text-xl font-black">
                    Email {coachName}
                  </h2>
                  <p className="muted text-sm mt-1">
                    Use a Rebels starter, rewrite it, or write your own. You can
                    also include other known coaches from this school.
                  </p>
                  {draftNotice && (
                    <p className="mt-2 text-xs font-bold text-green-700">
                      {draftNotice}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-slate-100"
                  disabled={busy}
                  onClick={() => setEmailOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              {emailStatus === "success" ? (
                <div className="p-8 text-center">
                  <CheckCircle2 size={44} className="mx-auto text-red-600" />
                  <h3 className="text-xl font-black mt-4">Email sent</h3>
                  <p className="muted mt-2">{message}</p>
                  <button
                    className="btn btn-red mt-6"
                    onClick={() => setEmailOpen(false)}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                    <div>
                      <label className="text-xs uppercase font-bold muted">
                        What are you emailing about?
                      </label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {EMAIL_STARTERS.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => buildStarter(s.id)}
                            className={`rounded-full border px-3 py-2 text-xs font-bold ${starter === s.id ? "bg-slate-950 text-white border-slate-950" : "bg-white hover:bg-slate-50"}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 rounded-xl bg-slate-50 border p-3 text-sm">
                        <div className="font-black flex items-center gap-2">
                          <Sparkles size={15} className="text-red-600" /> Rebels
                          Email Playbook
                        </div>
                        <div className="text-slate-600 mt-1">
                          {current.guidance}
                        </div>
                        <div className="mt-2 font-semibold">
                          {starter === "introduction"
                            ? "Who you are → Why this school → What you want."
                            : "Lead with why you are emailing today. You do not need to reintroduce yourself every time."}
                        </div>
                      </div>
                    </div>
                    {current.openings.length > 1 && (
                      <div>
                        <label className="text-xs uppercase font-bold muted">
                          Choose a starting point
                        </label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {current.openings.map((o, i) => (
                            <button
                              key={o.label}
                              onClick={() => chooseOpening(i)}
                              className={`rounded-lg border px-3 py-2 text-xs font-bold ${openingIndex === i ? "border-slate-950 bg-slate-100" : "bg-white"}`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        <p className="muted text-xs mt-2">
                          These are starting points, not scripts. Edit as much
                          as you want.
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs uppercase font-bold muted">
                        To
                      </label>
                      <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2.5 text-sm font-semibold break-all">
                        {email}
                      </div>
                    </div>
                    {schoolCoaches.length > 0 && (
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center gap-2 font-black">
                          <UsersRound size={17} />
                          Add Another {collegeName || "School"} Coach
                        </div>
                        <p className="muted text-xs mt-1">
                          Selected coaches are added as CC recipients so
                          everyone can see who received the message.
                        </p>
                        <div className="space-y-2 mt-3">
                          {schoolCoaches.map((co) => (
                            <label
                              key={co.id}
                              className={`flex items-start gap-3 rounded-lg border p-3 ${co.email ? "cursor-pointer" : "opacity-55"}`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                disabled={!co.email}
                                checked={ccCoachIds.includes(co.id)}
                                onChange={(e) =>
                                  setCcCoachIds((v) =>
                                    e.target.checked
                                      ? [...v, co.id]
                                      : v.filter((id) => id !== co.id),
                                  )
                                }
                              />
                              <div>
                                <div className="font-bold">
                                  {[co.first_name, co.last_name]
                                    .filter(Boolean)
                                    .join(" ") || "Coach"}
                                  {co.title ? ` · ${co.title}` : ""}
                                </div>
                                <div className="muted text-xs mt-0.5">
                                  {co.email || "Email not available"}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs uppercase font-bold muted">
                        Subject
                      </label>
                      <input
                        className="input mt-1"
                        value={subject}
                        maxLength={200}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <label className="text-xs uppercase font-bold muted">
                          Message
                        </label>
                        <EmailVideoPicker
                          athleteUserId={athleteUserId}
                          onInsert={insertVideo}
                        />
                      </div>
                      <RichEmailEditor
                        value={body}
                        onChange={(plain, html) => {
                          setBody(plain);
                          setBodyHtml(html);
                        }}
                        attachments={attachments}
                        onAttachmentsChange={setAttachments}
                        disabled={busy}
                      />
                      <div className="text-xs text-slate-500 mt-2">
                        Use bold, italic, underline, links, bullets or numbered
                        lists. Up to 5 attachments; 2.5 MB each and 3 MB
                        combined. Recruiting video links can be inserted
                        directly from My Videos.
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 border-t bg-white px-5 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                    {(gmailConnected === false || emailStatus === "error") && (
                      <div
                        role="alert"
                        className="mb-3 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex gap-2">
                          <AlertCircle size={18} className="shrink-0 mt-0.5" />
                          <div>
                            <div className="font-black">Email was not sent</div>
                            <div className="mt-1">
                              {message ||
                                "Connect Gmail before sending from Rebels Recruit."}
                            </div>
                          </div>
                        </div>
                        {gmailConnected === false && (
                          <a
                            className="btn btn-red shrink-0"
                            href="/api/google/connect?service=gmail"
                          >
                            Connect Gmail
                          </a>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => setEmailOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-red"
                        disabled={
                          busy ||
                          gmailConnected === false ||
                          !subject.trim() ||
                          !body.trim()
                        }
                        onClick={sendEmail}
                      >
                        <Send size={15} />
                        {busy ? "Sending..." : "Send Email"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
