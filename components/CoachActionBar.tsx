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
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import {emitDataChanged} from "@/lib/data-events";
import {
  EMAIL_STARTERS,
  mergeEmailStarters,
  starterById,
  type EmailStarterId,
} from "@/lib/recruiting-email-playbook";
import RichEmailEditor, {
  type EmailAttachment,
  type RichEmailEditorHandle,
} from "@/components/RichEmailEditor";
import EmailVideoPicker from "@/components/EmailVideoPicker";
import EmailSubjectSettings from "@/components/EmailSubjectSettings";
import RecruitingEmailReader from "@/components/RecruitingEmailReader";
import { buildRecruitingEmailSubject, formatDraftSignaturePhones, formatEmailPhone } from "@/lib/recruiting-email-format";
import {gmailSubjectChanged} from "@/lib/gmail-reply-context";
type PrimaryAction = "email" | "text" | "call" | "log" | "reminder" | null;
type Props = {
  coachId: string;
  collegeId: string;
  coachName: string;
  collegeName?: string;
  email?: string | null;
  emailOverride?: string | null;
  contactVerificationNeeded?: boolean;
  phone?: string | null;
  athleteUserId?: string;
  compact?: boolean;
  hideReminder?: boolean;
  hideRelationship?: boolean;
  primaryAction?: PrimaryAction;
  initialEmailStarter?: EmailStarterId;
  autoOpenEmail?: boolean;
  contextualReply?: {interactionId?:string;emailId?:string;sentInteractionId?:string;recipientEmail?:string;kind:string;choice?:string;subject?:string;originalEmail?:{body:string|null;summary:string|null;receivedAt:string|null}};
  onEmailSent?: (detail?: any) => void | Promise<void>;
  staffMode?: boolean;
  athleteEntitlement?: "free" | "full";
};
export default function CoachActionBar({
  coachId,
  collegeId,
  coachName,
  collegeName,
  email,
  emailOverride,
  contactVerificationNeeded = false,
  phone,
  athleteUserId,
  compact = false,
  hideReminder = false,
  hideRelationship = false,
  primaryAction = null,
  initialEmailStarter = "custom",
  autoOpenEmail = false,
  contextualReply,
  onEmailSent,
  staffMode = false,
  athleteEntitlement = "full",
}: Props) {
  const emailEditorRef=useRef<RichEmailEditorHandle>(null);
  const c = createClient(),
    params = useSearchParams(),
    openedKey = useRef(""),
    draftReady = useRef(false),
    draftKey = `rr-email-draft:${staffMode ? "staff" : athleteUserId || "self"}:${coachId}${contextualReply ? `:reply:${contextualReply.emailId || contextualReply.sentInteractionId || contextualReply.interactionId || "message"}` : ""}`,
    requested = params.get("emailStarter") as EmailStarterId | null,
    requestedValid = EMAIL_STARTERS.some((s) => s.id === requested),
    effectiveStarter = staffMode
      ? "custom"
      : requestedValid && requested ? requested : initialEmailStarter,
    shouldAutoOpen = (autoOpenEmail && !!params.get("action")) || !!requestedValid,
    autoOpenKey = shouldAutoOpen
      ? [params.get("action") || "starter", params.get("replyEmail") || "", params.get("interaction") || "", params.get("sentInteraction") || "", params.get("emailStarter") || ""].join(":")
      : "";
  const [emailOpen, setEmailOpen] = useState(false),
    [recipientEmail, setRecipientEmail] = useState(email || emailOverride || ""),
    [recipientSavedNotice, setRecipientSavedNotice] = useState(""),
    [templates, setTemplates] = useState(() => mergeEmailStarters([])),
    [subject, setSubject] = useState(""),
    [includePreviousConversation,setIncludePreviousConversation]=useState(true),
    [startedNewConversation,setStartedNewConversation]=useState(false),
    [quotedPreview,setQuotedPreview]=useState<{text:string;messageCount:number;omittedCount:number}|null>(null),
    [quotedPreviewOpen,setQuotedPreviewOpen]=useState(false),
    [quotedPreviewLoading,setQuotedPreviewLoading]=useState(false),
    [quotedPreviewError,setQuotedPreviewError]=useState(""),
    [body, setBody] = useState(""),
    [bodyHtml, setBodyHtml] = useState(""),
    [attachments, setAttachments] = useState<EmailAttachment[]>([]),
    [starter, setStarter] = useState<EmailStarterId>(effectiveStarter),
    [openingIndex, setOpeningIndex] = useState(0),
    [profile, setProfile] = useState<any>(null),
    [signatureMode, setSignatureMode] = useState<"default"|"custom"|"none">("default"),
    [customSignature, setCustomSignature] = useState(""),
    [signatureEditing, setSignatureEditing] = useState(false),
    [signatureSaving, setSignatureSaving] = useState(false),
    [signatureFeedback, setSignatureFeedback] = useState(""),
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
    [ccCoachIds, setCcCoachIds] = useState<string[]>([]),
    [actionPrompt, setActionPrompt] = useState<null | "connect-gmail" | "upgrade-gmail" | "desktop-text" | "desktop-call">(null);
  const changedReplySubject=!!contextualReply?.subject&&gmailSubjectChanged(contextualReply.subject,subject);
  useEffect(() => {
    let alive = true;
    void c.from("recruiting_email_templates")
      .select("id,label,purpose,guidance,ask,subject_template,openings,full_signature,requires_school_reason,is_active,sort_order")
      .then(({ data, error }) => {
        if (alive && !error) setTemplates(mergeEmailStarters((data || []) as any[]));
      });
    return () => { alive = false; };
  }, []);
  function originalReplySubject() {
    const original = contextualReply?.subject?.trim();
    return original ? (/^re:/i.test(original) ? original : `Re: ${original}`) : null;
  }
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
      mobile: formatEmailPhone(pr.phone),
      email: pr.email || "",
      twitter: s.xTwitter || a.twitter || a.twitter_handle || "",
      sports:
        s.sportsRecruitsUrl ||
        a.sportsrecruits_url ||
        a.sports_recruits_url ||
        "",
      travelCoach: s.travelTeamCoachName || "",
      travelCoachPhone: formatEmailPhone(s.travelTeamCoachPhone),
      hsCity: s.highSchoolCity || "",
      hsState: s.highSchoolState || a.primary_state || "",
      hsCoach: s.highSchoolCoachName || "",
      hsCoachPhone: formatEmailPhone(s.highSchoolCoachPhone),
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
    const preference = p?.signature?.signatureMode || "default";
    if (!staffMode && preference === "none") return "";
    if (!staffMode && preference === "custom") return String(p?.signature?.customSignature || "");
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
  async function saveSignaturePreference() {
    setSignatureSaving(true);
    setSignatureFeedback("");
    try {
      const response = await fetch("/api/profile/email-signature", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({signatureMode,customSignature}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save signature.");
      setProfile((current:any) => ({...current,signature:{...(current?.signature||{}),signatureMode,customSignature}}));
      setSignatureEditing(false);
      setSignatureFeedback("Signature preference saved. New emails will use it; this draft is unchanged.");
    } catch (error) {
      setSignatureFeedback(error instanceof Error ? error.message : "Unable to save signature.");
    } finally {setSignatureSaving(false);}
  }
  function compose(id: EmailStarterId, index: number, p: any) {
    const s = starterById(id, templates),
      v = values(p),
      sig = signature(p),
      lastName = coachName.trim().split(/\s+/).slice(-1)[0] || coachName;
    setBodyHtml("");
    if (id === "custom") {
      setSubject(originalReplySubject() || (staffMode ? "" : buildRecruitingEmailSubject("Recruiting Update", v, p?.signature)));
      setBody(sig ? `\n\n${sig}` : "");
      return;
    }
    // The template label is the topic (e.g. "Upcoming Weekend"), not its internal purpose.
    // Admin subject overrides supply a custom topic; the recruiting details remain consistent.
    const topic = s.subjectTemplate ? fill(s.subjectTemplate, p).split("|")[0].trim() : s.label;
    setSubject(originalReplySubject() || buildRecruitingEmailSubject(topic, v, p?.signature));
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
    emailEditorRef.current?.insertVideo(video);
  }
  async function previewPreviousConversation(){
    if(quotedPreviewLoading||busy||!contextualReply||!changedReplySubject||!includePreviousConversation)return;
    if(quotedPreview){setQuotedPreviewOpen(v=>!v);return}
    setQuotedPreviewLoading(true);
    setQuotedPreviewError("");
    try{
      const ctx=await context();
      if(!ctx)throw new Error("Please sign in again to preview the conversation.");
      const r=await fetch("/api/google/gmail/send",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({
          previewOnly:true,coachId,athleteUserId:ctx.athlete,staffMode,
          recipientEmail:!email?recipientEmail.trim().toLowerCase():undefined,
          subject,includePreviousConversation:true,
          recruitingInteractionId:contextualReply.sentInteractionId?null:contextualReply.interactionId||null,
          sentInteractionId:contextualReply.sentInteractionId||null,
          recruitingMessageId:contextualReply.sentInteractionId?null:contextualReply.emailId||null
        })
      });
      const result=await r.json().catch(()=>({}));
      if(!r.ok||!result.previousConversation?.text)throw new Error(result.error||"Unable to preview the previous conversation.");
      setQuotedPreview(result.previousConversation);
      setQuotedPreviewOpen(true);
    }catch(error){
      setQuotedPreviewError(error instanceof Error?error.message:"Unable to preview the previous conversation.");
    }finally{setQuotedPreviewLoading(false)}
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
      setSignatureMode(["default","custom","none"].includes(d?.signature?.signatureMode) ? d.signature.signatureMode : "default");
      setCustomSignature(String(d?.signature?.customSignature || ""));
      return d;
    } catch {
      return null;
    }
  }
  async function loadSchoolCoaches() {
    const {data,error}=await c.from("college_coaches")
      .select("id,first_name,last_name,title,email,contact_verification_needed,lifecycle_status")
      .eq("college_id",collegeId).order("last_name");
    if(error){setSchoolCoaches([]);return;}
    const others=(data||[]).filter((x:any)=>x.id!==coachId);
    if(staffMode){setSchoolCoaches(others);return;}
    const eligible=others.filter((x:any)=>x.email&&x.lifecycle_status==='active'&&!x.contact_verification_needed);
    if(!eligible.length){setSchoolCoaches([]);setCcCoachIds([]);return;}
    const ctx=await context();
    if(!ctx){setSchoolCoaches([]);setCcCoachIds([]);return;}
    const {data:linked,error:linkError}=await c.from('athlete_coaches')
      .select('coach_id').eq('athlete_user_id',ctx.athlete)
      .in('coach_id',eligible.map((x:any)=>x.id)).is('archived_at',null);
    if(linkError){setSchoolCoaches([]);setCcCoachIds([]);return;}
    const saved=new Set((linked||[]).map((x:any)=>x.coach_id));
    const choices=eligible.filter((x:any)=>saved.has(x.id));
    setSchoolCoaches(choices);
    setCcCoachIds(current=>current.filter(id=>saved.has(id)));
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
  async function openEmail(id: EmailStarterId = effectiveStarter) {
    if (contactVerificationNeeded || (staffMode && !email)) return;
    setRecipientEmail(current=>contextualReply?.recipientEmail || email || current || emailOverride || '');
    setRecipientSavedNotice('');
    if (!staffMode && athleteEntitlement === "free") {
      setActionPrompt("upgrade-gmail");
      return;
    }
    const connected = await checkGmailConnection();
    if (!staffMode && !connected) {
      setActionPrompt("connect-gmail");
      return;
    }
    draftReady.current = false;
    setMessage("");
    setDraftNotice("");
    setEmailStatus("idle");
    setStartedNewConversation(false);
    setIncludePreviousConversation(true);
    setQuotedPreview(null);
    setQuotedPreviewOpen(false);
    setQuotedPreviewError("");
    setQuotedPreviewLoading(false);
    setAttachments([]);
    setCcCoachIds([]);
    setEmailOpen(true);
    let recovered = false;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved?.subject && saved?.body) {
        const p = profile || (await loadProfile());
        const v = values(p);
        const savedStarter = starterById(String(saved.starter || id), templates);
        const oldAutoSubject = savedStarter.subjectTemplate
          ? fill(savedStarter.subjectTemplate, p)
          : `${savedStarter.purpose} | ${v.name || "[Your Name]"} | ${v.grad || "[Grad Year]"} | ${v.positions || "[POS]"} | ${v.gpa || "[GPA]"} | #${v.jersey || "[Jersey]"}`;
        const savedSubject = String(saved.subject);
        // Upgrade only a recognizable generated subject; never overwrite an edited subject or a reply.
        const shouldUpdateSubject = !contextualReply && !staffMode && saved.starter !== "custom" && savedSubject === oldAutoSubject;
        const topic = savedStarter.subjectTemplate ? fill(savedStarter.subjectTemplate, p).split("|")[0].trim() : savedStarter.label;
        const nextSubject = shouldUpdateSubject ? buildRecruitingEmailSubject(topic, v, p?.signature) : savedSubject;
        const signaturePhones = [p?.profile?.phone, p?.signature?.travelTeamCoachPhone, p?.signature?.highSchoolCoachPhone];
        const nextBody = formatDraftSignaturePhones(String(saved.body), v.name, signaturePhones);
        const nextHtml = formatDraftSignaturePhones(String(saved.bodyHtml || ""), v.name, signaturePhones);
        setSubject(nextSubject);
        setIncludePreviousConversation(saved.includePreviousConversation!==false);
        setBody(nextBody);
        setBodyHtml(nextHtml);
        setStarter(
          templates.some((item) => item.id === saved.starter)
            ? saved.starter
            : id,
        );
        setOpeningIndex(Number(saved.openingIndex || 0));
        setCcCoachIds(Array.isArray(saved.ccCoachIds) ? saved.ccCoachIds : []);
        if (!email && typeof saved.recipientEmail === "string") setRecipientEmail(saved.recipientEmail);
        setDraftNotice(contextualReply ? "Your saved reply draft was restored." : "Your saved draft was recovered.");
        recovered = true;
      }
    } catch {}
    if (!recovered) {
      if (contextualReply) {
        {const p=profile || (await loadProfile());const lastName=coachName.trim().split(/\s+/).slice(-1)[0]||coachName;const sig=signature(p);const kind=contextualReply.kind,choice=contextualReply.choice||"";const drafts:Record<string,{subject:string;body:string}>={
          camp_invitation:{subject:"Re: Camp Invitation",body:choice==="cannot_attend"?"Thank you for thinking of me and for the invitation. Unfortunately, I won't be able to attend, but I really appreciate you reaching out.": "Thank you for sending me the camp information. I'm definitely interested and will take a look at the details. I really appreciate you reaching out!"},
          call_request:{subject:"Re: Call",body:choice==="need_time"?"Thank you for reaching out. I'd really like to talk. The suggested time doesn't work for me, but I'd be happy to find another time that works for both of us.":"Thank you for reaching out. I'd be happy to set up a call and look forward to talking with you."},
          visit_invitation:{subject:"Re: Visit",body:choice==="cannot_attend"?"Thank you very much for the invitation. Unfortunately, I won't be able to make that date, but I really appreciate you thinking of me.":"Thank you for the invitation. I'm very interested in visiting and would love to work out the details."},
          schedule_request:{subject:"Re: Schedule",body:"Thank you for reaching out. I'm happy to send my upcoming game schedule. I've included the details below."},
          event_attendance:{subject:"Re: Game Details",body:"Thank you for letting me know. I really appreciate you planning to come watch me play. Here are the game details:"},
          information_request:{subject:"Re: Requested Information",body:"Thank you for reaching out. I'm happy to send the information you requested. I've included it below."},
          questionnaire:{subject:"Re: Recruiting Questionnaire",body:"Thank you for sending the recruiting questionnaire. I've completed it and wanted to let you know. I appreciate you staying in touch."},
          offer_related:{subject:"Re: Recruiting Conversation",body:"Thank you for reaching out. I appreciate the opportunity and would like to set up a time to talk through the details and next steps."},
          follow_up:{subject:"Re: Checking In",body:"Thank you for checking in. I really appreciate you staying in touch. I wanted to send you a quick update."}
        };const d=drafts[kind]||{subject:"Re: Recruiting Update",body:"Thank you for reaching out. I really appreciate you staying in touch."};setStarter("custom");setSubject(originalReplySubject() || d.subject);
          // Continuing an athlete's own sent email is not a response to a coach.
          // Start with a neutral greeting, never a fabricated thank-you.
          setBody(kind==="sent_follow_up"
            ? `Hello Coach ${lastName},\n\n\n\n${sig||""}`
            : `Hello Coach ${lastName},\n\n${d.body}${sig?`\n\n${sig}`:""}`);
          setBodyHtml("");}
      } else await buildStarter(id);
    }
    draftReady.current = true;
    void loadSchoolCoaches();
    void checkGmailConnection();
  }
  useEffect(() => {
    if (!shouldAutoOpen || contactVerificationNeeded || (staffMode && !email) || !autoOpenKey || openedKey.current === autoOpenKey) return;
    openedKey.current = autoOpenKey;
    void openEmail(effectiveStarter);
  }, [shouldAutoOpen, email, staffMode, contactVerificationNeeded, effectiveStarter, autoOpenKey]);

  function closeEmail() {
    if (busy) return;
    setEmailOpen(false);
    if (params.get("action") === "recruiting-reply" || params.get("action") === "camp-reply" || params.get("action") === "continue-thread" || params.has("emailStarter")) {
      const url = new URL(window.location.href);
      for (const key of ["action", "replyEmail", "interaction", "sentInteraction", "intent", "choice", "emailStarter"]) url.searchParams.delete(key);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }
  useEffect(() => {
    if (!emailOpen || !draftReady.current || (!subject && !body)) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          subject,
          body,
          bodyHtml,
          includePreviousConversation,
          starter,
          openingIndex,
          ccCoachIds,
          recipientEmail: !email ? recipientEmail : undefined,
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
    includePreviousConversation,
    starter,
    openingIndex,
    ccCoachIds,
    recipientEmail,
    email,
  ]);
  const validRecipient=(value:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()) && value.trim().length<=254;
  async function saveRecipient(){
    const address=recipientEmail.trim().toLowerCase();
    if(!validRecipient(address)){
      setRecipientSavedNotice('Enter a valid email address before saving.');
      return;
    }
    const ctx=await context();
    if(!ctx){setRecipientSavedNotice('Please sign in again.');return;}
    const existing=await c.from('athlete_coaches').select('id')
      .eq('athlete_user_id',ctx.athlete).eq('coach_id',coachId)
      .is('archived_at',null).maybeSingle();
    if(existing.error){setRecipientSavedNotice('Could not check Coach Connections. Please try again.');return;}
    if(!existing.data){
      setRecipientSavedNotice('Add this coach to My Coach Connections before saving an email address.');
      return;
    }
    const result=await c.from('athlete_coaches').update({
      email_override:address,email_override_updated_at:new Date().toISOString()
    }).eq('id',existing.data.id).eq('athlete_user_id',ctx.athlete).is('archived_at',null);
    if(result.error){
      setRecipientSavedNotice('Could not save the address to this Coach Connection. Please try again.');
      return;
    }
    emitDataChanged('athlete_coaches','update',coachId);
    const pending=await c.from('college_coach_update_suggestions').select('id')
      .eq('coach_id',coachId).eq('submitted_by_user_id',ctx.user.id)
      .eq('proposed_email',address).eq('status','pending').limit(1);
    if(!pending.error&&!(pending.data||[]).length){
      const suggestion=await c.from('college_coach_update_suggestions').insert({
        coach_id:coachId,submitted_by_user_id:ctx.user.id,suggestion_type:'contact_update',
        proposed_email:address,
        details:'Athlete-supplied email for personal outreach; requires independent verification before global publication.'
      });
      if(suggestion.error)console.warn('Could not queue coach email verification',suggestion.error.code);
    }
    setRecipientSavedNotice('Email address saved for this Coach Connection. This does not count as outreach. RLTNL has not verified this address.');
  }
  async function sendEmail() {
    const ctx = await context();
    if (!ctx) {
      setEmailStatus("error");
      setMessage("Your session could not be verified. Please sign in again.");
      return;
    }
    if (!email && !validRecipient(recipientEmail)) {
      setEmailStatus("error");
      setMessage("Enter a valid coach email address in the To field before sending.");
      return;
    }
    const connected =
      gmailConnected === true ? true : await checkGmailConnection();
    if (!connected) {
      setEmailStatus("error");
      setMessage(
        "Connect Gmail before sending. Signing in with Google does not automatically give RLTNL Recruiting permission to send email.",
      );
      return;
    }
    const s = starterById(starter, templates);
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
          recipientEmail: !email ? recipientEmail.trim().toLowerCase() : undefined,
          ccCoachIds,
          athleteUserId: ctx.athlete,
          subject,
          body,
          bodyHtml,
          includePreviousConversation:changedReplySubject?includePreviousConversation:false,
          emailPurpose: starter,
          attachments,
          recruitingInteractionId: contextualReply?.sentInteractionId ? null : contextualReply?.interactionId || null,
          sentInteractionId: contextualReply?.sentInteractionId || null,
          recruitingMessageId: contextualReply?.sentInteractionId ? null : contextualReply?.emailId || null,
          staffMode,
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
      setStartedNewConversation(d.startedNewConversation===true);
      setEmailStatus("success");
      if(!staffMode){emitDataChanged('athlete_coaches','update',coachId);emitDataChanged('interaction','create',coachId)}
      window.dispatchEvent(new CustomEvent('rltnl:coach-emails-updated', { detail: { emailId: d.repliedToEmailId || null } }));
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setDraftNotice("");
      setMessage(
        d.contactSaved === false
          ? "Email sent through Gmail, but your connection's contact status could not be updated. Please refresh and check Coach Connections."
          : !email && d.recipientSaved === false
            ? "Email sent through Gmail, but the email address could not be saved for future use."
            : d.logged
              ? `Email sent through Gmail${d.ccCount ? ` to ${d.ccCount + 1} coaches` : ""}, logged in Activity, and contact status updated.`
              : "Email sent through Gmail and coach contact status updated, but Activity could not be updated.",
      );
      if (onEmailSent) await onEmailSent(d);
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
  function isMobileDevice() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  }
  function copyPhone() {
    if (!phone) return;
    void navigator.clipboard?.writeText(phone);
    setMessage("Coach phone number copied.");
  }
  function handlePhoneAction(channel: "Text" | "Phone") {
    if (!phone) return;
    if (!isMobileDevice()) {
      setActionPrompt(channel === "Text" ? "desktop-text" : "desktop-call");
      return;
    }
    if (staffMode || athleteEntitlement === "full") logInitiated(channel);
    window.location.href = channel === "Text" ? `sms:${phone}` : `tel:${phone}`;
  }
  function logInitiated(channel: "Text" | "Phone") {
    const payload = JSON.stringify({coachId,collegeId,athleteUserId:athleteUserId||null,staffMode,channel});
    try { if (navigator.sendBeacon) { navigator.sendBeacon('/api/communication/initiate', new Blob([payload], {type:'application/json'})); return; } } catch {}
    void fetch('/api/communication/initiate',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true});
  }
  const base = compact ? "btn py-1.5 px-2.5 text-xs" : "btn",
    primary = `${base} btn-red`,
    reminderSecondary = `${base} bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100`,
    cls = (a: PrimaryAction, disabled = false) =>
      `${primaryAction === a ? primary : a === "reminder" ? reminderSecondary : base} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`,
    logHref = `/activity/new?college=${collegeId}&coach=${coachId}${athleteUserId ? `&athlete=${athleteUserId}` : ""}`,
    hubHref = `/coaches/${coachId}${athleteUserId ? `?athlete=${athleteUserId}` : ""}`,
    current = starterById(starter, templates);
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
          className={cls("email", contactVerificationNeeded || (staffMode && !email))}
          disabled={contactVerificationNeeded || (staffMode && !email)}
          title={contactVerificationNeeded?"Contact verification required before emailing":!email?"Enter the coach email address to send":undefined}
          onClick={() => openEmail()}
        >
          <Mail size={compact ? 13 : 15} /> Email
        </button>
        <button
          type="button"
          className={cls("text", !phone)}
          disabled={!phone}
          title={phone ? "Text coach" : "No phone number available"}
          onClick={() => handlePhoneAction("Text")}
        >
          <MessageCircle size={compact ? 13 : 15} /> Text
        </button>
        <button
          type="button"
          className={cls("call", !phone)}
          disabled={!phone}
          title={phone ? "Call coach" : "No phone number available"}
          onClick={() => handlePhoneAction("Phone")}
        >
          <Phone size={compact ? 13 : 15} /> Call
        </button>
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
      {actionPrompt &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setActionPrompt(null); }}>
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    {actionPrompt === "connect-gmail" ? "Connect Gmail to email coaches from RLTNL" : actionPrompt === "upgrade-gmail" ? "Email coaches directly from RLTNL" : actionPrompt === "desktop-text" ? `Text ${coachName}` : `Call ${coachName}`}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {actionPrompt === "connect-gmail" ? "Connect Gmail to send without leaving RLTNL. Your coach communication can be captured in your recruiting history so relationships, Journey, and Next Steps stay current." : actionPrompt === "upgrade-gmail" ? "Upgrade to RLTNL Recruiting to connect Gmail, send coach emails from RLTNL, automatically capture communication activity, and keep your recruiting history and Next Steps current." : actionPrompt === "desktop-text" ? "Texting is available from your phone. You can copy the coach’s number here, or open RLTNL on your phone to text." : "Calling is available from your phone. You can copy the coach’s number here, or open RLTNL on your phone to call."}
                  </p>
                </div>
                <button type="button" className="p-2 rounded-lg hover:bg-slate-100" onClick={() => setActionPrompt(null)}><X size={18}/></button>
              </div>
              {(actionPrompt === "desktop-text" || actionPrompt === "desktop-call" || actionPrompt === "upgrade-gmail") && phone && actionPrompt !== "upgrade-gmail" && (
                <div className="mt-4 rounded-xl border bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Coach phone</div><div className="mt-1 font-bold">{phone}</div></div>
              )}
              {actionPrompt === "upgrade-gmail" && email && <div className="mt-4 rounded-xl border bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Prefer to email outside RLTNL?</div><div className="mt-1 break-all font-bold">{email}</div></div>}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {actionPrompt === "connect-gmail" && <a className="btn btn-red" href="/api/google/connect?service=gmail">Connect Gmail</a>}
                {actionPrompt === "upgrade-gmail" && <Link className="btn btn-red" href="/upgrade">Upgrade to RLTNL Recruiting</Link>}
                {actionPrompt === "upgrade-gmail" && email && <button className="btn" onClick={() => { void navigator.clipboard?.writeText(email); setMessage("Coach email copied."); setActionPrompt(null); }}>Copy Email</button>}
                {(actionPrompt === "desktop-text" || actionPrompt === "desktop-call") && <button className="btn btn-red" onClick={() => { copyPhone(); setActionPrompt(null); }}>Copy Number</button>}
                <button className="btn" onClick={() => setActionPrompt(null)}>Not Now</button>
              </div>
            </div>
          </div>, document.body
        )}
      {emailOpen &&
        createPortal(
          <div
            className={'fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-slate-950/50 ' + (emailStatus === 'success' ? 'p-4' : 'p-0 sm:p-4')}
            onMouseDown={(e) => {
              if (e.currentTarget === e.target && !busy) closeEmail();
            }}
          >
            <div
              role="dialog"
              data-rr-fullscreen-dialog
              aria-modal="true"
              aria-labelledby="email-dialog-title"
              className={'flex w-full flex-col overflow-hidden bg-white shadow-2xl ' + (emailStatus === 'success' ? 'max-w-md rounded-2xl' : 'h-[100dvh] max-w-4xl sm:h-[90dvh] sm:max-h-[880px] sm:rounded-2xl')}
            >
              {emailStatus !== "success" && <div className="shrink-0 border-b p-4 sm:p-5 flex justify-between gap-4">
                <div>
                  <h2 id="email-dialog-title" className="text-xl font-black">
                    {contextualReply ? "Reply to" : "Email"} {coachName}
                  </h2>
                  <p className="muted text-sm mt-1">
                    {contextualReply ? (changedReplySubject?'Changing the subject starts a new Gmail conversation. Both conversations remain in your RLTNL coach history.':'Your reply stays in the Gmail conversation and is logged in RLTNL.') : 'Write your own email or start with a RLTNL template. You can also CC other coaches at this school.'}
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
                  onClick={closeEmail}
                >
                  <X size={18} />
                </button>
              </div>}
              {emailStatus === "success" ? (
                <div className="px-6 py-8 text-center sm:px-8 sm:py-9" aria-live="polite">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <CheckCircle2 size={30} />
                  </div>
                  <h3 id="email-dialog-title" className="mt-4 text-xl font-black">Email sent</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                  {contextualReply && <p className="mt-2 text-xs font-semibold text-slate-500">{startedNewConversation?"Your updated subject started a new Gmail conversation. Both conversations are associated with this coach in RLTNL.":"Your reply stays in the existing Gmail conversation."}</p>}
                  <button type="button" className="btn btn-red mt-6 min-w-28" onClick={closeEmail}>Done</button>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
                    {!contextualReply && (
                      <div className="space-y-4">
                    <div>
                      <label htmlFor="coach-email-starter" className="text-xs uppercase font-bold muted">
                        Email starting point
                      </label>
                      <div className="relative mt-2 max-w-xl">
                        <select
                          id="coach-email-starter"
                          value={starter}
                          disabled={busy}
                          onChange={(event) => { void buildStarter(event.target.value as EmailStarterId); }}
                          className="input w-full appearance-none !pr-12 text-sm font-semibold"
                        >
                          {(staffMode ? templates.filter((item) => item.id === "custom") : templates).map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </select>
                        <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"/>
                      </div>
                      <div className="mt-3 flex items-start gap-2 rounded-xl border bg-slate-50 px-3 py-2.5 text-sm">
                        <Sparkles size={16} className="mt-0.5 shrink-0 text-red-600" />
                        <div>
                          <div className="font-black">RLTNL Email Playbook</div>
                          <p className="mt-1 text-slate-600">{current.guidance}</p>
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
                      </div>
                    )}
                    <div className={contextualReply ? "grid gap-3 sm:grid-cols-2" : "space-y-4"}>
                    <div>
                      <label className="text-xs uppercase font-bold muted">
                        To
                      </label>
                      {(email || contextualReply?.sentInteractionId) ? <div className="mt-1 rounded-xl border bg-slate-50 px-3 py-2.5 text-sm font-semibold break-all">{contextualReply?.sentInteractionId ? (contextualReply.recipientEmail || email || recipientEmail) : email}</div>
                      : <div className="mt-1 space-y-2">
                        <input type="email" autoComplete="email" inputMode="email" required
                          aria-label="Coach email address" placeholder="Enter coach email address"
                          className="input w-full" value={recipientEmail} maxLength={254} disabled={busy}
                          onChange={e=>{setRecipientEmail(e.target.value);setRecipientSavedNotice('')}}/>
                        <p className="text-xs text-slate-600">RLTNL doesn't have a confirmed email for this coach. Enter an address you know. Save it for future use or send an email to record outreach. The address stays private until RLTNL verifies it.</p>
                        <button type="button" className="text-xs font-black text-red-700 hover:underline disabled:opacity-50"
                          disabled={busy||!validRecipient(recipientEmail)} onClick={()=>void saveRecipient()}>Save this address for later</button>
                        {recipientSavedNotice&&<p role="status" className="text-xs font-semibold text-slate-700">{recipientSavedNotice}</p>}
                      </div>}
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold muted">
                        Subject
                      </label>
                      <input
                        className="input mt-1"
                        value={subject}
                        disabled={busy}
                        maxLength={200}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                    </div>
                    {!staffMode&&!contextualReply&&<EmailSubjectSettings
                      profile={profile}
                      topic={current.subjectTemplate?fill(current.subjectTemplate,profile).split("|")[0].trim():current.label}
                      fields={values(profile)}
                      disabled={busy}
                      onSaved={next=>setProfile((p:any)=>({...p,signature:{...(p?.signature||{}),...next}}))}
                    />}
                    {contextualReply?.subject && (
                      <div className="mt-3">
                        {changedReplySubject ? (
                          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-800" aria-label="New subject and conversation history">
                            <div className="font-bold">New subject = new Gmail conversation</div>
                            <p className="mt-1 text-xs leading-5 text-slate-700">Your earlier Gmail thread stays intact. RLTNL keeps both conversations under this coach.</p>
                            <label className="mt-3 flex cursor-pointer items-start gap-3">
                              <input type="checkbox" className="mt-1" checked={includePreviousConversation} disabled={busy}
                                onChange={e=>{setIncludePreviousConversation(e.target.checked);setQuotedPreviewOpen(false);setQuotedPreviewError("");}} />
                              <span><span className="block font-semibold">Include previous conversation</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-700">Recommended. RLTNL adds up to 12 previous emails from this coach's Gmail conversation as quoted context below your new message. This is visible to everyone receiving the email, including CC recipients.</span>
                              </span>
                            </label>
                            {includePreviousConversation&&<div className="mt-3 border-t border-amber-200 pt-3">
                              <button type="button" className="text-xs font-bold text-red-700 underline underline-offset-2 disabled:opacity-50"
                                disabled={busy||quotedPreviewLoading} aria-expanded={quotedPreviewOpen}
                                onClick={()=>void previewPreviousConversation()}>
                                {quotedPreviewLoading?"Loading quoted conversation…":quotedPreviewOpen?"Hide quoted conversation":"Preview previous conversation"}
                              </button>
                              {quotedPreviewError&&<p role="alert" className="mt-2 text-xs font-semibold text-red-800">{quotedPreviewError}</p>}
                              {quotedPreviewOpen&&quotedPreview&&<div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                                <p className="mb-2 text-xs font-bold text-slate-800">Quoted history · {quotedPreview.messageCount} {quotedPreview.messageCount===1?"message":"messages"}{quotedPreview.omittedCount>0?` · ${quotedPreview.omittedCount} older omitted`:""}</p>
                                <p className="mb-2 text-xs text-slate-600">This text will appear after your new message. Earlier attachments are not copied. Gmail history is checked again when you send.</p>
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 font-sans text-xs leading-5 text-slate-700">{quotedPreview.text.trim()}</pre>
                              </div>}
                            </div>}
                            {!includePreviousConversation&&<p className="mt-2 text-xs font-semibold text-amber-900">The coach will receive only your new message, without the earlier conversation attached.</p>}
                          </section>
                        ) : <p className="text-xs font-semibold text-slate-500">Keeping this subject continues the original Gmail thread. You can edit it to reflect a new topic.</p>}
                      </div>
                    )}
                    {schoolCoaches.length > 0 && (
                      <details className="group rounded-xl border bg-white">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-bold hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                          <span className="flex min-w-0 items-center gap-2">
                            <UsersRound size={17} className="shrink-0 text-slate-500" />
                            CC another {collegeName || "school"} coach
                            {ccCoachIds.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">{ccCoachIds.length} selected</span>}
                          </span>
                          <ChevronDown size={17} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t px-4 pb-4 pt-3">
                          <p className="text-xs text-slate-600">CC recipients can see everyone included in the email.{!staffMode&&' Only coaches already in My Coach Connections are available here.'}</p>
                          <div className="mt-3 space-y-2">
                            {schoolCoaches.map((co) => (
                              <label key={co.id} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${co.email ? "cursor-pointer hover:bg-slate-50" : "opacity-55"}`}>
                                <input type="checkbox" className="mt-1" disabled={!co.email} checked={ccCoachIds.includes(co.id)}
                                  onChange={(event) => setCcCoachIds((current) => event.target.checked ? [...current, co.id] : current.filter((id) => id !== co.id))} />
                                <span className="min-w-0">
                                  <span className="block font-bold">{[co.first_name, co.last_name].filter(Boolean).join(" ") || "Coach"}{co.title ? ` · ${co.title}` : ""}</span>
                                  <span className="mt-0.5 block break-all text-xs text-slate-500">{co.email || "Email not available"}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </details>
                    )}
                    <div>
                      <label className="mb-1 block text-xs uppercase font-bold muted">
                        Message
                      </label>
                      {!staffMode && <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">My Email Signature</span>
                          <button type="button" className="text-red-700 font-semibold underline" onClick={()=>{setSignatureEditing(v=>!v);setSignatureFeedback("");}}>Manage signature</button>
                        </div>
                        {signatureEditing && <div className="mt-3 space-y-3">
                          <label className="block text-xs font-semibold">Signature for future emails</label>
                          <select aria-label="Email signature preference" className="input w-full" value={signatureMode} onChange={e=>setSignatureMode(e.target.value as "default"|"custom"|"none")}>
                            <option value="default">RLTNL signature (default)</option>
                            <option value="custom">My custom signature</option>
                            <option value="none">No signature</option>
                          </select>
                          {signatureMode==="custom" && <textarea aria-label="Custom email signature" className="input w-full min-h-32" maxLength={4000} value={customSignature} onChange={e=>setCustomSignature(e.target.value)} placeholder="Your name, graduation year, team, contact details…" />}
                          <button type="button" className="btn btn-red" disabled={signatureSaving || (signatureMode==="custom"&&!customSignature.trim())} onClick={saveSignaturePreference}>{signatureSaving?"Saving…":"Save signature"}</button>
                          <p className="text-xs text-slate-500">Existing drafts will not be changed. Your signature is included automatically when starting a new email.</p>
                        </div>}
                        {signatureFeedback && <p role="status" className="mt-2 text-xs text-slate-600">{signatureFeedback}</p>}
                      </div>}
                      <RichEmailEditor
                        ref={emailEditorRef}
                        videoPicker={<EmailVideoPicker athleteUserId={athleteUserId} onInsert={insertVideo}/>}
                        value={body}
                        html={bodyHtml}
                        onChange={(plain, html) => {
                          setBody(plain);
                          setBodyHtml(html);
                        }}
                        attachments={attachments}
                        onAttachmentsChange={setAttachments}
                        disabled={busy}
                      />
                      <div className="text-xs text-slate-500 mt-2">
                        Choose a font and text size, or select text to format it. Use bold, italic, underline, links, bullets or numbered
                        lists. Up to 5 attachments; 2.5 MB each and 3 MB
                        combined. Recruiting video links can be inserted
                        directly from My Videos.
                      </div>
                    </div>
                    {contextualReply?.originalEmail && (
                      <section aria-label={contextualReply.sentInteractionId ? "Previous sent email" : "Previous coach email"} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Mail size={17} className="shrink-0 text-slate-500" /> Previous Email</div>
                            <p className="mt-1 text-xs text-slate-600">
                              {contextualReply.sentInteractionId ? `Sent to ${coachName}` : `From ${coachName}`}{collegeName ? ` · ${collegeName}` : ""}
                              {contextualReply.originalEmail.receivedAt ? ` · ${new Date(contextualReply.originalEmail.receivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                            </p>
                            {contextualReply.subject && <p className="mt-2 break-words text-sm font-semibold text-slate-800">{contextualReply.subject}</p>}
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">Reference only</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{changedReplySubject&&includePreviousConversation ? "This message is a reference preview. When you send, RLTNL will quote prior messages from the Gmail conversation below your new email." : contextualReply.sentInteractionId ? "Your earlier email is shown for reference. It will not be added to your follow-up." : "Read the coach\'s message while composing. It will not be added to your outgoing reply."}</p>
                        <RecruitingEmailReader body={contextualReply.originalEmail.body} summary={contextualReply.originalEmail.summary} compact />
                      </section>
                    )}
                    {contextualReply && (
                      <details className="group rounded-xl border bg-slate-50">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center gap-2"><Sparkles size={16} className="text-red-600" /> Writing help &amp; email templates (optional)</span>
                          <ChevronDown size={17} className="shrink-0 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 border-t bg-white p-3">
                          <p className="text-xs text-slate-600">{contextualReply.sentInteractionId ? 'You can use a template to draft a follow-up. Selecting one will' : 'Your reply is already drafted. Selecting a template will'} replace the current message, but keep the original Gmail conversation.</p>
                          <div>
                            <label htmlFor="coach-reply-starter" className="text-xs font-bold uppercase text-slate-500">Email starting point</label>
                            <div className="relative mt-1">
                              <select
                                id="coach-reply-starter"
                                value={starter}
                                disabled={busy}
                                onChange={(event) => { void buildStarter(event.target.value as EmailStarterId); }}
                                className="input w-full appearance-none !pr-12 text-sm font-semibold"
                              >
                                {(staffMode ? templates.filter((item) => item.id === "custom") : templates).map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"/>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600">{current.guidance}</p>
                          {current.openings.length > 1 && (
                            <div>
                              <div className="text-xs font-bold uppercase text-slate-500">Choose a starting point</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {current.openings.map((opening, index) => (
                                  <button type="button" key={opening.label} onClick={() => chooseOpening(index)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-bold ${openingIndex === index ? "border-slate-950 bg-slate-100" : "bg-white hover:bg-slate-50"}`}>
                                    {opening.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="shrink-0 border-t bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(15,23,42,0.06)] sm:px-5 sm:py-4">
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
                                "Connect Gmail before sending from RLTNL Recruiting."}
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
                        onClick={closeEmail}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-red"
                        disabled={
                          busy ||
                          gmailConnected === false ||
                          !subject.trim() ||
                          !body.trim() ||
                          (!email && !validRecipient(recipientEmail))
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
