"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  MessageSquare,
  School,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import CoachActionBar from "@/components/CoachActionBar";
import EventWorkflowPanel from "@/components/EventWorkflowPanel";
import { createClient } from "@/lib/supabase-browser";

const one = (v: any) => (Array.isArray(v) ? v[0] : v);
const fmt = (d: any) =>
  d
    ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString(
        "en-US",
        { month: "2-digit", day: "2-digit", year: "numeric" },
      )
    : "Date not set";

export default function EventPrep() {
  const { id } = useParams<{ id: string }>(),
    c = createClient();
  // Deployment sync marker: event prep relationship/outreach fix.
  const [event, setEvent] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [relationshipInteractionCount,setRelationshipInteractionCount]=useState(0),
    [coaches, setCoaches] = useState<any[]>([]),
    [directoryCoaches, setDirectoryCoaches] = useState<any[]>([]),
    [prep, setPrep] = useState<any>({target_coach_ids:[],questions:["","",""],personal_goal:"",conversation_reviewed:false,video_ready:false}),
    [prepSaving,setPrepSaving]=useState(false),
    [prepMessage,setPrepMessage]=useState(""),
    [prepEditing,setPrepEditing]=useState(false),
    [debrief, setDebrief] = useState<any>(null),
    [eventReminders, setEventReminders] = useState<any[]>([]),
    [form, setForm] = useState({
      coaches_spoken_to: "",
      what_happened: "",
      interest_signal: "unclear",
      follow_up_needed: true,
      follow_up_notes: "",
    }),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [saveMessage, setSaveMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error: authError,
      } = await c.auth.getUser();
      if (authError || !user) {
        setLoadError("Your account could not be verified. Please try again.");
        setLoading(false);
        return;
      }
      const { data: e, error: eventError } = await c
        .from("events")
        .select("*,colleges(id,name)")
        .eq("id", id)
        .single();
      if (eventError || !e) {
        setLoadError("This event could not be loaded.");
        setLoading(false);
        return;
      }
      setEvent(e);
      if (e?.college_id) {
        const [historyResult, interactionCountResult, coachResult, directoryResult] = await Promise.all([
          c
            .from("interactions")
            .select("id,coach_id,type,date,note,initiated_by,email_subject,email_type,interaction_recipients(coach_id,recipient_type)")
            .eq("athlete_user_id", user.id)
            .eq("college_id", e.college_id)
            .order("date", { ascending: false })
            .limit(8),
          c
            .from("interactions")
            .select("id",{count:"exact",head:true})
            .eq("athlete_user_id",user.id)
            .eq("college_id",e.college_id),
          c
            .from("athlete_coaches")
            .select(
              "coach_id,college_coaches(id,first_name,last_name,title,email,phone)",
            )
            .eq("athlete_user_id", user.id)
            .eq("college_id", e.college_id),
          c
            .from("college_coaches")
            .select("id,first_name,last_name,title,email,phone,source_note")
            .eq("college_id", e.college_id),
        ]);
        if (historyResult.error || interactionCountResult.error || coachResult.error || directoryResult.error) {
          setLoadError(
            "The event loaded, but its coach and activity context could not be loaded.",
          );
          setLoading(false);
          return;
        }
        const cr = coachResult.data || [];
        const trackedIds = new Set(cr.map((row:any)=>row.coach_id));
        setDirectoryCoaches((directoryResult.data || []).filter((x:any)=>!trackedIds.has(x.id)));
        const coachMap = new Map(
          cr.map((row: any) => [row.coach_id, one(row.college_coaches)]),
        );
        setHistory(
          (historyResult.data || []).map((row: any) => ({
            ...row,
            college_coaches: coachMap.get(row.coach_id) || null,
          })),
        );
        setRelationshipInteractionCount(interactionCountResult.count||0);
        setCoaches(
          (cr || []).sort((a: any, b: any) => {
            const ta = String(
                one(a.college_coaches)?.title || "",
              ).toLowerCase(),
              tb = String(one(b.college_coaches)?.title || "").toLowerCase(),
              rank = (t: string) =>
                /^head\s+coach\b/.test(t)
                  ? 0
                  : /associate\s+head/.test(t)
                    ? 1
                    : /assistant/.test(t)
                      ? 3
                      : 2;
            return rank(ta) - rank(tb);
          }),
        );
      }
      const [debriefResult, reminderResult, prepResult] = await Promise.all([
        c
          .from("event_debriefs")
          .select("*")
          .eq("athlete_user_id", user.id)
          .eq("event_id", id)
          .maybeSingle(),
        c
          .from("reminders")
          .select("id,title,due_date,status,reminder_kind,event_id")
          .eq("athlete_user_id", user.id)
          .eq("event_id", id),
        c.from("event_preparations").select("*").eq("athlete_user_id",user.id).eq("event_id",id).maybeSingle(),
      ]);
      if (debriefResult.error || reminderResult.error || prepResult.error) {
        setLoadError(
          "The event loaded, but its debrief or reminders could not be loaded.",
        );
        setLoading(false);
        return;
      }
      const d = debriefResult.data;
      const r = reminderResult.data;
      if(prepResult.data)setPrep({...prepResult.data,questions:[...(prepResult.data.questions||[]),"","",""].slice(0,3)});
      setEventReminders(r || []);
      if (d) {
        setDebrief(d);
        setForm({
          coaches_spoken_to: Array.isArray(d.coaches_spoken_to) ? d.coaches_spoken_to.join(", ") : (d.coaches_spoken_to || ""),
          what_happened: d.what_happened || d.meaningful_notes || "",
          interest_signal: d.interest_signal || d.interest_change || "unclear",
          follow_up_needed: d.follow_up_needed,
          follow_up_notes: d.follow_up_notes || "",
        });
      }
      setLoading(false);
    })();
  }, [id]);
  async function trackCoach(x:any) {
    const { data: { user } } = await c.auth.getUser();
    if (!user || !event?.college_id || !x?.id) return;
    setSaving(true); setSaveMessage("");
    const { error } = await c.from("athlete_coaches").insert({athlete_user_id:user.id,college_id:event.college_id,coach_id:x.id,archived_at:null,archived_reason:null});
    if (error) { setSaveMessage("We found the coach, but could not add them to your Connections. Please try again."); setSaving(false); return; }
    setCoaches(v=>[...v,{coach_id:x.id,college_coaches:x}]);
    setDirectoryCoaches(v=>v.filter(y=>y.id!==x.id));
    setSaveMessage(`${x.first_name || "Coach"} is now in your Connections. You can email them below.`);
    setSaving(false);
    setTimeout(()=>document.getElementById("email-coaches")?.scrollIntoView({behavior:"smooth",block:"start"}),50);
  }
  async function markRelationshipReviewed(){
    const {data:{user}}=await c.auth.getUser(); if(!user)return;
    const payload={athlete_user_id:user.id,event_id:id,target_coach_ids:prep.target_coach_ids||[],questions:(prep.questions||[]).map((q:string)=>q.trim()).filter(Boolean),personal_goal:prep.personal_goal?.trim()||null,conversation_reviewed:true,video_ready:!!prep.video_ready,updated_at:new Date().toISOString()};
    const {data,error}=await c.from("event_preparations").upsert(payload,{onConflict:"athlete_user_id,event_id"}).select("*").single();
    if(!error&&data)setPrep({...data,questions:[...(data.questions||[]),"",""].slice(0,3)});
  }
  async function savePrep(){
    const {data:{user}}=await c.auth.getUser(); if(!user)return;
    setPrepSaving(true);setPrepMessage("");
    const payload={athlete_user_id:user.id,event_id:id,target_coach_ids:prep.target_coach_ids||[],questions:(prep.questions||[]).map((q:string)=>q.trim()).filter(Boolean),personal_goal:prep.personal_goal?.trim()||null,conversation_reviewed:!!prep.conversation_reviewed,video_ready:!!prep.video_ready,updated_at:new Date().toISOString()};
    const {data,error}=await c.from("event_preparations").upsert(payload,{onConflict:"athlete_user_id,event_id"}).select("*").single();
    if(error){setPrepMessage("Your event prep could not be saved. Please try again.");setPrepSaving(false);return}
    setPrep({...data,questions:[...(data.questions||[]),"",""].slice(0,3)});
    const complete=Boolean((data.target_coach_ids||[]).length)&&Boolean((data.questions||[]).filter((q:string)=>q?.trim()).length>=3)&&Boolean(data.personal_goal?.trim());
    setPrepEditing(!complete);setPrepMessage(complete?"Event prep complete. You’re ready for the event.":"Event prep saved. Add a target coach, 3 questions and an event goal to complete prep.");setPrepSaving(false);
    if(complete)setTimeout(()=>{document.getElementById("event-plan")?.scrollIntoView({behavior:"smooth",block:"start"});},150);
  }
  async function save() {
    const {
      data: { user },
    } = await c.auth.getUser();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setSaveMessage("");
    const now = new Date(),
      today = now.toISOString().slice(0, 10);
    const { data: d, error } = await c
      .from("event_debriefs")
      .upsert(
        {
          athlete_user_id: user.id,
          event_id: id,
          coaches_spoken_to: form.coaches_spoken_to.split(",").map((x:string)=>x.trim()).filter(Boolean),
          what_happened: form.what_happened,
          meaningful_notes: form.what_happened,
          interest_signal: form.interest_signal,
          interest_change: form.interest_signal,
          follow_up_needed: form.follow_up_needed,
          follow_up_notes: form.follow_up_notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "athlete_user_id,event_id" },
      )
      .select("*")
      .single();
    if (error) {
      setSaveMessage(error.message);
      setSaving(false);
      return;
    }
    setDebrief(d);
    if (event?.college_id && form.what_happened.trim() && !debrief) {
      const interactionResult = await c.from("interactions").insert({
        athlete_user_id: user.id,
        actor_user_id: user.id,
        college_id: event.college_id,
        type: "Event Debrief",
        initiated_by: "Athlete",
        date: today,
        date_precision: "exact",
        date_year: now.getFullYear(),
        date_month: now.getMonth() + 1,
        note: `${event.name}: ${form.what_happened}${form.coaches_spoken_to ? ` Coaches spoken with: ${form.coaches_spoken_to}.` : ""}${form.follow_up_notes ? ` Follow-up: ${form.follow_up_notes}` : ""}`,
      });
      if (interactionResult.error) {
        setSaveMessage(
          "The debrief was saved, but its Journey entry could not be created. Please try again.",
        );
        setSaving(false);
        return;
      }
    }
    if (form.follow_up_needed) {
      const existing = eventReminders.find(
        (r: any) =>
          r.reminder_kind === "event_followup" && r.status !== "completed",
      );
      if (!existing) {
        const due = new Date();
        due.setDate(due.getDate() + 1);
        const { data: r, error: reminderError } = await c
          .from("reminders")
          .insert({
            owner_user_id: user.id,
            athlete_user_id: user.id,
            event_id: id,
            college_id: event?.college_id || null,
            title: `Follow up after ${event?.name || "recruiting event"}`,
            due_date: due.toISOString().slice(0, 10),
            status: "open",
            reminder_kind: "event_followup",
          })
          .select("id,title,due_date,status,reminder_kind,event_id")
          .single();
        if (reminderError) {
          setSaveMessage(
            "The debrief was saved, but its follow-up could not be created. Please try again.",
          );
          setSaving(false);
          return;
        }
        if (r) setEventReminders((v) => [...v, r]);
      }
    }
    const pre = eventReminders.filter(
      (r: any) =>
        r.reminder_kind === "event_prearrival_email" &&
        r.status !== "completed",
    );
    if (pre.length && event?.date <= today) {
      const { error: completionError } = await c
        .from("reminders")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .in(
          "id",
          pre.map((r: any) => r.id),
        );
      if (completionError) {
        setSaveMessage(
          "The debrief was saved, but the pre-event reminder could not be completed. Please retry.",
        );
        setSaving(false);
        return;
      }
    }
    setSaved(true);
    setSaveMessage(
      form.follow_up_needed
        ? "Debrief saved. A follow-up Next Step is ready for you."
        : "Debrief saved to your Journey.",
    );
    setSaving(false);
  }
  if (loading)
    return (
      <AppShell>
        <div className="p-8 text-center muted">
          Loading Camp & Visit Prep...
        </div>
      </AppShell>
    );
  if (loadError || !event)
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-8">
          <div role="alert" className="card border-red-200 bg-red-50 p-6">
            <div className="font-black">
              Camp & Visit Prep could not be loaded
            </div>
            <p className="mt-2 text-sm text-red-700">{loadError}</p>
            <button className="btn mt-4" onClick={() => location.reload()}>
              Try Again
            </button>
          </div>
        </div>
      </AppShell>
    );
  const school = one(event.colleges),
    past = event.date < new Date().toISOString().slice(0, 10),
    emailReminder = eventReminders.find(
      (r: any) =>
        r.reminder_kind === "event_prearrival_email" ||
        /email coaches before/i.test(r.title || ""),
    ),
    followupReminder = eventReminders.find((r:any)=>r.reminder_kind==="event_followup");
  const eventDate=String(event.date||"").slice(0,10);
  const preEventContactByCoach=new Map<string,any>();
  history.forEach((h:any)=>{
    const d=String(h.date||"").slice(0,10);
    const athleteInitiated=String(h.initiated_by||"").toLowerCase()==="athlete";
    const communication=/email sent|text sent|call/i.test(String(h.type||""));
    if(!athleteInitiated||!communication||(eventDate&&d&&d>eventDate))return;
    const recipientIds=[h.coach_id,...(h.interaction_recipients||[]).map((r:any)=>r.coach_id)].filter(Boolean);
    const searchable=String([h.note,h.email_subject].filter(Boolean).join(" ")).toLowerCase();
    coaches.forEach((r:any)=>{const x=one(r.college_coaches);if(x?.email&&searchable.includes(String(x.email).toLowerCase()))recipientIds.push(r.coach_id)});
    [...new Set(recipientIds)].forEach((coachId:any)=>{if(!preEventContactByCoach.has(coachId))preEventContactByCoach.set(coachId,h)});
  });
  const contactedCoachCount=coaches.filter((r:any)=>preEventContactByCoach.has(r.coach_id)).length;
  const allTrackedCoachesContacted=coaches.length>0&&contactedCoachCount===coaches.length;
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-5 md:px-8 py-6">
        <Link
          href="/game-plan#camp-visit-prep"
          className="text-sm font-bold inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Game Plan
        </Link>
        <div className="mt-5">
          <PageHeader
            eyebrow="RECRUITING EVENT WORKFLOW"
            title={past ? "Camp & Visit Debrief" : "Camp & Visit Prep"}
            subtitle={`${event.name} · ${fmt(event.date)}${school?.name ? ` · ${school.name}` : ""}`}
          />
        </div>
        <div id="event-plan" className="scroll-mt-6">
        <EventWorkflowPanel
          event={event}
          emailReminder={emailReminder}
          debrief={debrief}
          preparation={prep}
          followupReminder={followupReminder}
          trackedCoachCount={coaches.length}
          contactedCoachCount={contactedCoachCount}
          relationshipInteractionCount={relationshipInteractionCount}
          onRelationshipReview={markRelationshipReviewed}
        />
        </div>
        {!past && (
          allTrackedCoachesContacted ? <section id="email-coaches" className="card p-4 mt-5 scroll-mt-6"><div className="flex flex-col sm:flex-row sm:items-center gap-3"><CheckCircle2 className="text-green-600 shrink-0" size={20}/><div className="flex-1"><div className="font-black">Pre-event outreach complete</div><div className="muted text-sm">{coaches.map((r:any)=>{const x=one(r.college_coaches);return [x?.first_name,x?.last_name].filter(Boolean).join(" ")}).filter(Boolean).join(" + ")} contacted{[...preEventContactByCoach.values()][0]?.date?` · ${fmt([...preEventContactByCoach.values()][0].date)}`:""}</div></div><a href="#outreach-details" className="btn">View outreach</a></div><details id="outreach-details" className="mt-3"><summary className="cursor-pointer text-sm font-bold">Outreach details</summary><div className="mt-3 space-y-2">{coaches.map((r:any,i)=>{const x=one(r.college_coaches),prior=x?.id?preEventContactByCoach.get(x.id):null;return <div key={x?.id||i} className="rounded-xl border p-3"><div className="font-black text-sm">{[x?.first_name,x?.last_name].filter(Boolean).join(" ")||"Coach"}</div><div className="muted text-xs">{x?.title||"Coach"}{prior?.date?` · Contacted ${fmt(prior.date)}`:""}</div></div>})}</div></details></section> :
          <section id="email-coaches" className="card p-5 mt-5 border-2 border-red-200 bg-red-50 scroll-mt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
                <Mail size={19} />
              </div>
              <div>
                <div className="rr-eyebrow">HIGH-PRIORITY PREP STEP</div>
                <h2 className="text-xl font-black">
                  {allTrackedCoachesContacted ? "Pre-event outreach complete" : "Email the coaches before you go"}
                </h2>
                <p className="text-sm text-slate-700 mt-1 max-w-3xl">
                  {allTrackedCoachesContacted
                    ? "You have already contacted the coaches you are tracking for this event. No duplicate outreach is needed."
                    : "Contact the coaches you still need to notify before the event. Rebels Recruit will not ask you to re-email a coach when your outreach is already recorded."}
                </p>
              </div>
            </div>
            {coaches.length > 0 ? (
              <div className="mt-4 space-y-3">
                {coaches.map((r: any, i) => {
                  const x = one(r.college_coaches),
                    name =
                      [x?.first_name, x?.last_name].filter(Boolean).join(" ") ||
                      "Coach";
                  const priorContact=x?.id?preEventContactByCoach.get(x.id):null;
                  return (
                    <div
                      key={x?.id || i}
                      className="rounded-xl border bg-white p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <Link
                            href={x?.id ? `/coaches/${x.id}` : "#"}
                            className="font-black hover:text-red-700"
                          >
                            {name}
                          </Link>
                          <div className="muted text-xs">
                            {x?.title || "Coach"}
                            {x?.email ? ` · ${x.email}` : ""}
                          </div>
                        </div>
                        <div className={`text-xs font-bold ${priorContact?"text-green-700":"text-red-700"}`}>
                          {priorContact ? `Already contacted${priorContact.date ? ` · ${fmt(priorContact.date)}` : ""}` : "Send before the event"}
                        </div>
                      </div>
                      {x?.id && !priorContact && (
                        <div className="mt-3">
                          <CoachActionBar
                            coachId={x.id}
                            collegeId={event.college_id}
                            coachName={name}
                            collegeName={school?.name}
                            email={x.email}
                            phone={x.phone}
                            compact
                            primaryAction="email"
                            hideReminder
                            initialEmailStarter="pre_camp"
                          />
                        </div>
                      )}
                      {priorContact && <div className="mt-3 text-sm text-slate-600">Your pre-event outreach to this coach is already in the Journey.</div>}
                    </div>
                  );
                })}
              </div>
            ) : directoryCoaches.length > 0 ? (
              <div className="rounded-xl border bg-white p-4 mt-4">
                <div className="font-black">We found coaches for {school?.name || "this school"}</div>
                <p className="muted text-sm mt-1">They are in the shared Rebels Recruit directory but not in your Connections yet. Choose who you want to contact.</p>
                <div className="mt-3 space-y-2">{directoryCoaches.map((x:any)=><div key={x.id} className="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1"><div className="font-black">{[x.first_name,x.last_name].filter(Boolean).join(" ")}</div><div className="muted text-xs">{x.title || "Coach"}{x.email?` · ${x.email}`:""}</div>{x.source_note&&<div className="text-[11px] text-green-700 font-bold mt-1">Verified from official athletics source</div>}</div><button className="btn btn-red self-start" disabled={saving} onClick={()=>trackCoach(x)}>Add to My Connections →</button></div>)}</div>
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-4 mt-4">
                <div className="font-black">We don't have this school's softball coaches yet.</div>
                <p className="muted text-sm mt-1">Use the school's official athletics site as the source of truth, then add the coach you want to contact. Rebels Recruit will keep that coach in the shared directory for the next athlete too.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent((school?.name || "") + " softball coaching staff official athletics")}`} target="_blank" rel="noreferrer" className="btn">Find Official Coaching Staff →</a>
                  {school?.id&&<Link href={`/coaches/new?college=${school.id}&returnTo=${encodeURIComponent(`/events/${id}/prep#email-coaches`)}`} className="btn btn-red">+ Add Coach</Link>}
                </div>
              </div>
            )}
          </section>
        )}
        {past ? <details className="card mt-5"><summary className="p-5 cursor-pointer font-black">View Event Prep</summary><div className="grid lg:grid-cols-3 gap-5 px-5 pb-5"><section id="get-ready" className="border rounded-xl p-5 lg:col-span-2 scroll-mt-6">
            <div className="rr-eyebrow">EVENT PREP WORKSPACE</div>
            <h2 className="font-black text-lg">Get ready to make the event count</h2>
            <p className="muted text-sm mt-1">Choose who you want to meet, review the relationship, prepare your questions, and decide what you want to accomplish.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="border rounded-xl p-3 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={!!prep.conversation_reviewed} onChange={e=>setPrep({...prep,conversation_reviewed:e.target.checked})}/>I reviewed my last conversation</label>
              <label className="border rounded-xl p-3 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={!!prep.video_ready} onChange={e=>setPrep({...prep,video_ready:e.target.checked})}/>My recruiting video/profile is ready</label>
            </div>
            {coaches.length>0&&<><h3 className="font-black mt-5">Who do you want to connect with?</h3><div className="mt-2 space-y-2">{coaches.map((r:any,i)=>{const x=one(r.college_coaches),checked=(prep.target_coach_ids||[]).includes(x?.id);return <label key={x?.id||i} className="border rounded-xl p-3 flex gap-3 cursor-pointer"><input type="checkbox" checked={checked} onChange={e=>setPrep({...prep,target_coach_ids:e.target.checked?[...(prep.target_coach_ids||[]),x.id]:(prep.target_coach_ids||[]).filter((v:string)=>v!==x.id)})}/><span><b>{x?.first_name} {x?.last_name}</b><span className="block muted text-xs">{x?.title||"Coach"}{x?.email?` · ${x.email}`:""}</span></span></label>})}</div></>}
            <h3 className="font-black mt-5">Prepare 3 questions</h3>
            <div className="space-y-2 mt-2">{[0,1,2].map(i=><input key={i} className="input w-full" value={prep.questions?.[i]||""} onChange={e=>{const qs=[...(prep.questions||[])];qs[i]=e.target.value;setPrep({...prep,questions:qs})}} placeholder={`Question ${i+1}`}/>)}</div>
            <label className="text-sm font-bold block mt-5">What do you want to accomplish at this event?<textarea className="input w-full mt-1 min-h-20" value={prep.personal_goal||""} onChange={e=>setPrep({...prep,personal_goal:e.target.value})} placeholder="Example: Introduce myself to Coach Anderson after the hitting session."/></label>
            <div className="flex flex-wrap items-center gap-3 mt-5"><button className="btn btn-red" disabled={prepSaving} onClick={savePrep}>{prepSaving?"Saving...":"Save Event Prep"}</button>{prepMessage&&<span className="text-sm font-bold text-slate-700">{prepMessage}</span>}</div>
          </section>
          <section className="card p-5">
            <div className="rr-eyebrow">RELATIONSHIP CONTEXT</div>
            <div className="text-3xl font-black">{relationshipInteractionCount}</div>
            <div className="muted text-sm">recent recorded interactions</div>
            {school?.id && (
              <Link href={`/colleges/${school.id}`} className="btn w-full mt-5">
                <School size={16} />
                Open Playbook
              </Link>
            )}
          </section>
        </div></details> : <div className="grid lg:grid-cols-3 gap-5 mt-5">
          <section id="get-ready" className="card p-5 lg:col-span-2 scroll-mt-6">
            {Boolean((prep.target_coach_ids||[]).length)&&Boolean((prep.questions||[]).filter((q:string)=>q?.trim()).length>=3)&&Boolean(prep.personal_goal?.trim())&&!prepEditing ? <>
              <div className="flex items-start gap-3"><CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={22}/><div className="flex-1"><div className="rr-eyebrow text-green-700">PREP COMPLETE</div><h2 className="font-black text-lg">You’re ready for the event</h2><p className="muted text-sm mt-1">Your event plan is saved. Review it here anytime before you go.</p></div></div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4"><div className="border rounded-xl p-3"><div className="muted text-xs font-bold">TARGET COACH{(prep.target_coach_ids||[]).length===1?"":"ES"}</div><div className="font-black mt-1">{coaches.filter((r:any)=>(prep.target_coach_ids||[]).includes(r.coach_id)).map((r:any)=>{const x=one(r.college_coaches);return [x?.first_name,x?.last_name].filter(Boolean).join(" ")}).filter(Boolean).join(", ")||`${(prep.target_coach_ids||[]).length} selected`}</div></div><div className="border rounded-xl p-3"><div className="muted text-xs font-bold">READINESS</div><div className="font-black mt-1">{prep.conversation_reviewed?"Conversation reviewed":"Conversation review optional"} · {prep.video_ready?"Profile/video ready":"Profile/video check optional"}</div></div></div>
              <div className="border rounded-xl p-4 mt-3"><div className="font-black text-sm">3 prepared questions</div><ol className="list-decimal ml-5 mt-2 text-sm space-y-1">{(prep.questions||[]).filter((q:string)=>q?.trim()).slice(0,3).map((q:string,i:number)=><li key={i}>{q}</li>)}</ol></div>
              <div className="border rounded-xl p-4 mt-3"><div className="font-black text-sm">Event goal</div><p className="text-sm mt-1">{prep.personal_goal}</p></div>
              <button className="btn mt-4" onClick={()=>setPrepEditing(true)}>Edit Prep</button>
            </> : <>
            <div className="rr-eyebrow">EVENT PREP WORKSPACE</div>
            <h2 className="font-black text-lg">Get ready to make the event count</h2>
            <p className="muted text-sm mt-1">Choose who you want to meet, review the relationship, prepare your questions, and decide what you want to accomplish.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="border rounded-xl p-3 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={!!prep.conversation_reviewed} onChange={e=>setPrep({...prep,conversation_reviewed:e.target.checked})}/>I reviewed my last conversation</label>
              <label className="border rounded-xl p-3 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={!!prep.video_ready} onChange={e=>setPrep({...prep,video_ready:e.target.checked})}/>My recruiting video/profile is ready</label>
            </div>
            {coaches.length>0&&<><h3 className="font-black mt-5">Who do you want to connect with?</h3><div className="mt-2 space-y-2">{coaches.map((r:any,i)=>{const x=one(r.college_coaches),checked=(prep.target_coach_ids||[]).includes(x?.id);return <label key={x?.id||i} className="border rounded-xl p-3 flex gap-3 cursor-pointer"><input type="checkbox" checked={checked} onChange={e=>setPrep({...prep,target_coach_ids:e.target.checked?[...(prep.target_coach_ids||[]),x.id]:(prep.target_coach_ids||[]).filter((v:string)=>v!==x.id)})}/><span><b>{x?.first_name} {x?.last_name}</b><span className="block muted text-xs">{x?.title||"Coach"}{x?.email?` · ${x.email}`:""}</span></span></label>})}</div></>}
            <h3 className="font-black mt-5">Prepare 3 questions</h3>
            <div className="space-y-2 mt-2">{[0,1,2].map(i=><input key={i} className="input w-full" value={prep.questions?.[i]||""} onChange={e=>{const qs=[...(prep.questions||[])];qs[i]=e.target.value;setPrep({...prep,questions:qs})}} placeholder={`Question ${i+1}`}/>)}</div>
            <label className="text-sm font-bold block mt-5">What do you want to accomplish at this event?<textarea className="input w-full mt-1 min-h-20" value={prep.personal_goal||""} onChange={e=>setPrep({...prep,personal_goal:e.target.value})} placeholder="Example: Introduce myself to Coach Anderson after the hitting session."/></label>
            <div className="flex flex-wrap items-center gap-3 mt-5"><button className="btn btn-red" disabled={prepSaving} onClick={savePrep}>{prepSaving?"Saving...":"Save Event Prep"}</button>{prepMessage&&<span className="text-sm font-bold text-slate-700">{prepMessage}</span>}</div>
            </>}
          </section>
          <section className="card p-5"><div className="rr-eyebrow">RELATIONSHIP CONTEXT</div><div className="text-3xl font-black">{history.length}</div><div className="muted text-sm">recent recorded interactions</div>{school?.id&&<Link href={`/colleges/${school.id}`} className="btn w-full mt-5"><School size={16}/>Open Playbook</Link>}</section>
        </div>}
        {past && <>
        <section id="follow-up-action" className="card p-5 mt-5 scroll-mt-6">
          <div className="rr-eyebrow">FOLLOW-UP</div>
          <h2 className="font-black text-xl">{followupReminder?.status==="completed"?"Follow-up complete":"Close the loop"}</h2>
          <p className="text-sm mt-2">{debrief?.follow_up_notes ? <><b>Next step:</b> {debrief.follow_up_notes}</> : "Review your debrief and decide what follow-up is needed."}</p>
          {debrief?.follow_up_needed && followupReminder?.status!=="completed" && <button className="btn btn-red mt-4" onClick={async()=>{if(!followupReminder?.id)return;setSaving(true);setSaveMessage("");const {error}=await c.from("reminders").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",followupReminder.id);if(error){setSaveMessage("Follow-up could not be completed. Please try again.");setSaving(false);return;}setEventReminders(v=>v.map((r:any)=>r.id===followupReminder.id?{...r,status:"completed"}:r));setSaveMessage("Follow-up completed.");setSaved(true);setSaving(false)}} disabled={saving}><CheckCircle2 size={17}/>Mark Follow-Up Complete</button>}
        </section>
        {debrief ? <details className="card mt-5">
          <summary className="p-5 cursor-pointer font-black flex items-center justify-between gap-3">
            <span>▸&nbsp; View / Edit Debrief</span>
            <span className="text-sm font-semibold text-slate-500">Saved</span>
          </summary>
          <div className="px-5 pb-5">
<section id="debrief" className="card p-5 scroll-mt-6">
          <div className="rr-eyebrow">AFTER THE EVENT</div>
          <h2 className="font-black text-xl">
            Capture what happened, then close the loop
          </h2>
          <p className="muted text-sm mt-1">
            Your first saved debrief adds an dated Journey entry. If follow-up
            is needed, Rebels Recruit creates a Next Step for the next day
            instead of leaving the event as a dead-end calendar item.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <label className="text-sm font-bold">
              Coaches you spoke with
              <input
                className="input w-full mt-1"
                value={form.coaches_spoken_to}
                onChange={(e) =>
                  setForm({ ...form, coaches_spoken_to: e.target.value })
                }
              />
            </label>
            <label className="text-sm font-bold">
              Interest signal
              <select
                className="input w-full mt-1"
                value={form.interest_signal}
                onChange={(e) =>
                  setForm({ ...form, interest_signal: e.target.value })
                }
              >
                <option value="strong">Strong</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="unclear">Unclear</option>
                <option value="negative">Negative</option>
              </select>
            </label>
          </div>
          <label className="text-sm font-bold block mt-4">
            What happened?
            <textarea
              className="input w-full mt-1 min-h-28"
              value={form.what_happened}
              onChange={(e) =>
                setForm({ ...form, what_happened: e.target.value })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold mt-4">
            <input
              type="checkbox"
              checked={form.follow_up_needed}
              onChange={(e) =>
                setForm({ ...form, follow_up_needed: e.target.checked })
              }
            />
            Follow-up needed
          </label>
          {form.follow_up_needed && (
            <label className="text-sm font-bold block mt-3">
              Follow-up plan
              <input
                className="input w-full mt-1"
                value={form.follow_up_notes}
                onChange={(e) =>
                  setForm({ ...form, follow_up_notes: e.target.value })
                }
                placeholder="Thank coach, send video, answer a question..."
              />
            </label>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
            <button onClick={save} disabled={saving} className="btn btn-red">
              <MessageSquare size={17} />
              {saving ? "Saving..." : "Save Debrief & Next Step"}
            </button>
            {saveMessage && (
              <span
                className={`text-sm font-bold ${saved ? "text-slate-700" : "text-red-700"}`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </section>

          </div>
        </details> : <>
        <section id="debrief" className="card p-5 scroll-mt-6">
          <div className="rr-eyebrow">AFTER THE EVENT</div>
          <h2 className="font-black text-xl">
            Capture what happened, then close the loop
          </h2>
          <p className="muted text-sm mt-1">
            Your first saved debrief adds an dated Journey entry. If follow-up
            is needed, Rebels Recruit creates a Next Step for the next day
            instead of leaving the event as a dead-end calendar item.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <label className="text-sm font-bold">
              Coaches you spoke with
              <input
                className="input w-full mt-1"
                value={form.coaches_spoken_to}
                onChange={(e) =>
                  setForm({ ...form, coaches_spoken_to: e.target.value })
                }
              />
            </label>
            <label className="text-sm font-bold">
              Interest signal
              <select
                className="input w-full mt-1"
                value={form.interest_signal}
                onChange={(e) =>
                  setForm({ ...form, interest_signal: e.target.value })
                }
              >
                <option value="strong">Strong</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="unclear">Unclear</option>
                <option value="negative">Negative</option>
              </select>
            </label>
          </div>
          <label className="text-sm font-bold block mt-4">
            What happened?
            <textarea
              className="input w-full mt-1 min-h-28"
              value={form.what_happened}
              onChange={(e) =>
                setForm({ ...form, what_happened: e.target.value })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold mt-4">
            <input
              type="checkbox"
              checked={form.follow_up_needed}
              onChange={(e) =>
                setForm({ ...form, follow_up_needed: e.target.checked })
              }
            />
            Follow-up needed
          </label>
          {form.follow_up_needed && (
            <label className="text-sm font-bold block mt-3">
              Follow-up plan
              <input
                className="input w-full mt-1"
                value={form.follow_up_notes}
                onChange={(e) =>
                  setForm({ ...form, follow_up_notes: e.target.value })
                }
                placeholder="Thank coach, send video, answer a question..."
              />
            </label>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
            <button onClick={save} disabled={saving} className="btn btn-red">
              <MessageSquare size={17} />
              {saving ? "Saving..." : "Save Debrief & Next Step"}
            </button>
            {saveMessage && (
              <span
                className={`text-sm font-bold ${saved ? "text-slate-700" : "text-red-700"}`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </section>

        </>}
        </>}
      </div>
    </AppShell>
  );
}
