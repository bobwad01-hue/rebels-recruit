import Link from 'next/link';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import AppShell from '@/components/AppShell';
import OfferSchoolPicker from '@/components/OfferSchoolPicker';
import {PageFrame} from '@/components/ProductUI';
import {createClient} from '@/lib/supabase-server';

const fields=['tuition_fees','housing_meals','other_costs','academic_aid','athletic_aid','other_grants'] as const;
const labels=['Tuition & fees','Housing & meals','Other costs','Academic scholarships','Athletic scholarships','Other grants'];
const currency=(v:number|null|undefined)=>v==null?'Not entered':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const numeric=(v:unknown)=>v==null?'':String(v);
const safeMoney=(value:FormDataEntryValue|null)=>{if(value==null||String(value).trim()==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>10000000)throw Error('Enter a valid nonnegative amount');return Math.round(n*100)/100;};
const safeDate=(v:FormDataEntryValue|null)=>{const s=String(v||'');if(!s)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s)))throw Error('Invalid date');return s;};
const textValue=(v:FormDataEntryValue|null,max=1500)=>String(v||'').trim().slice(0,max);

async function saveOffer(form:FormData){
 'use server';
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const collegeId=String(form.get('college_id')||'');
 const {data:college}=await supabase.from('colleges').select('id').eq('id',collegeId).maybeSingle();
 if(!college)throw Error('Choose a valid school');
 const values:Record<string,unknown>={athlete_user_id:user.id,college_id:collegeId,offer_date:safeDate(form.get('offer_date')),decision_deadline:safeDate(form.get('decision_deadline')),status:'considering',notes:textValue(form.get('notes')),renewal_terms:textValue(form.get('renewal_terms')),athletic_opportunity:textValue(form.get('athletic_opportunity')),academic_notes:textValue(form.get('academic_notes')),updated_at:new Date().toISOString()};
 for(const field of fields)values[field]=safeMoney(form.get(field));
 const {data:existing,error:lookupError}=await supabase.from('athlete_school_offers').select('status').eq('athlete_user_id',user.id).eq('college_id',collegeId).maybeSingle();
 if(lookupError)throw Error('Unable to verify existing offer');
 if(existing)values.status=existing.status;
 const {error}=await supabase.from('athlete_school_offers').upsert(values,{onConflict:'athlete_user_id,college_id'});
 if(error)throw Error('Could not save offer');
 revalidatePath('/offers');redirect('/offers?saved=1');
}
async function updateStatus(form:FormData){
 'use server';
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('id')||'');const status=String(form.get('status')||'');
 if(!['received','considering','accepted','declined','withdrawn'].includes(status))throw Error('Invalid status');
 const {error}=await supabase.from('athlete_school_offers').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('athlete_user_id',user.id);
 if(error)throw Error('Could not update status');
 revalidatePath('/offers');redirect('/offers');
}
async function deleteOffer(form:FormData){
 'use server';
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const id=String(form.get('id')||'');
 if(form.get('confirm_delete')!=='yes')throw Error('Confirm deletion before continuing');
 const {data:removed,error}=await supabase.from('athlete_school_offers').delete().eq('id',id).eq('athlete_user_id',user.id).select('id').maybeSingle();
 if(error||!removed)throw Error('Could not delete this offer');
 revalidatePath('/offers');revalidatePath('/dashboard');
 redirect('/offers?deleted=1');
}
export default async function Offers({searchParams}:{searchParams:Promise<{school?:string;saved?:string;deleted?:string}>}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const sp=await searchParams;
 const [offersResult,schoolsResult]=await Promise.all([
 supabase.from('athlete_school_offers').select('*,colleges(id,name,division,state)').eq('athlete_user_id',user.id).order('created_at',{ascending:false}),
 supabase.from('athlete_colleges').select('college_id,colleges(id,name,division,state)').eq('athlete_user_id',user.id).is('archived_at',null)
 ]);
 const offers=(offersResult.data||[]) as any[];
 const tracked=(schoolsResult.data||[]).map((x:any)=>Array.isArray(x.colleges)?x.colleges[0]:x.colleges).filter(Boolean);
 const schoolIds=new Set(tracked.map((x:any)=>x.id));
 const selected=schoolIds.has(sp.school)?sp.school:tracked[0]?.id;
 const existing=offers.find(x=>x.college_id===selected);
 const totals=(o:any)=>{const costs=['tuition_fees','housing_meals','other_costs'];const aids=['academic_aid','athletic_aid','other_grants'];const complete=costs.every(k=>o[k]!=null);return {complete,total:complete?costs.reduce((n,k)=>n+Number(o[k]),0):null,aid:aids.reduce((n,k)=>n+Number(o[k]||0),0),net:complete?Math.max(0,costs.reduce((n,k)=>n+Number(o[k]),0)-aids.reduce((n,k)=>n+Number(o[k]||0),0)):null};};
 return <AppShell><PageFrame size="6xl"><div className="space-y-6">
 <div><Link href="/connections" className="text-sm font-semibold text-slate-600 hover:underline">← Connections</Link><p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-500">DECIDE · RECRUITING OPPORTUNITIES</p><h1 className="text-3xl font-black">Compare Offers</h1><p className="mt-2 text-sm text-slate-600">Compare the real cost, athletic opportunity, academics, and deadlines. Amounts are entered by you, not verified by RLTNL.</p></div>
 {sp.deleted==='1'&&<div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">Offer deleted. Your school relationship and recruiting history are unchanged.</div>}
 {sp.saved==='1'&&<div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">Offer saved.</div>}
 {offersResult.error&&<div className="rounded-xl border border-red-200 p-4 text-red-700">Offers could not be loaded. Try again later.</div>}
 {offers.length>0&&<section className="card p-5"><h2 className="text-lg font-black">Your offers</h2><p className="mt-1 text-xs text-slate-500">Estimated annual costs; no inflation or renewal changes included.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">School</th><th className="p-3">Status</th><th className="p-3">Annual cost</th><th className="p-3">Grants & scholarships</th><th className="p-3">Estimated net / year</th><th className="p-3">Deadline</th><th className="p-3">Manage</th></tr></thead><tbody>{offers.map(o=>{const t=totals(o);const c=Array.isArray(o.colleges)?o.colleges[0]:o.colleges;return <tr key={o.id} className="border-b align-top"><td className="p-3 font-bold">{c?.name||'School'}</td><td className="p-3"><form action={updateStatus} className="flex gap-1"><input type="hidden" name="id" value={o.id}/><select name="status" defaultValue={o.status} aria-label="Offer status" className="rounded border p-1 text-xs">{['received','considering','accepted','declined','withdrawn'].map(s=><option key={s} value={s}>{s}</option>)}</select><button className="rounded border px-2 text-xs" type="submit">Save</button></form></td><td className="p-3">{currency(t.total)}</td><td className="p-3">{currency(t.aid)}</td><td className="p-3 font-black">{currency(t.net)}</td><td className="p-3">{o.decision_deadline||'Not entered'}</td><td className="p-3"><div className="flex flex-col items-start gap-2"><Link href={`/offers?school=${o.college_id}#offer-editor`} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-bold hover:bg-slate-50">Edit all details</Link><details className="group"><summary className="cursor-pointer text-xs font-bold text-red-700 hover:underline">Delete offer</summary><form action={deleteOffer} className="mt-2 w-56 rounded-lg border border-red-200 bg-red-50 p-3"><input type="hidden" name="id" value={o.id}/><p className="text-xs font-bold text-red-900">Permanently delete this offer?</p><p className="mt-1 text-xs text-red-800">The school and recruiting history will remain.</p><label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" name="confirm_delete" value="yes" required/>Yes, delete this offer</label><button type="submit" className="mt-3 rounded bg-red-700 px-3 py-2 text-xs font-bold text-white">Confirm delete</button></form></details></div></td></tr>})}</tbody></table></div><div className="mt-4 grid gap-3 md:grid-cols-2">{offers.map(o=>{const c=Array.isArray(o.colleges)?o.colleges[0]:o.colleges;const t=totals(o);return <div key={o.id} className="rounded-xl border p-4"><h3 className="font-black">{c?.name}</h3><p className="mt-1 text-sm">4-year simple estimate: <strong>{currency(t.net==null?null:t.net*4)}</strong></p><p className="mt-2 text-xs text-slate-600">Athletic opportunity: {o.athletic_opportunity||'Not entered'}</p><p className="mt-1 text-xs text-slate-600">Academic fit: {o.academic_notes||'Not entered'}</p><p className="mt-1 text-xs text-slate-600">Renewal terms: {o.renewal_terms||'Not entered'}</p><p className="mt-1 text-xs text-slate-600">Notes: {o.notes||'Not entered'}</p></div>})}</div></section>}
 <section id="offer-editor" className="card scroll-mt-6 p-5"><h2 className="text-lg font-black">{existing?'Edit offer':'Record an offer'}</h2><p className="mt-1 text-sm text-slate-600">Only tracked schools appear here. Add a school in Connections first. Enter annual amounts; use 0 only when the amount is confirmed as zero.</p>
 {tracked.length===0?<Link href="/colleges/new" className="mt-4 inline-block font-bold text-red-600">Find Schools</Link>:<>
 <div className="mt-4"><OfferSchoolPicker key={selected} selected={selected} schools={tracked.map((s:any)=>({id:s.id,name:s.name}))}/></div>
 <form key={selected} action={saveOffer} className="mt-5 space-y-4"><input type="hidden" name="college_id" value={selected}/><div className="grid gap-4 sm:grid-cols-2">{[['offer_date','Offer date'],['decision_deadline','Decision deadline']].map(([k,l])=><label key={k} className="block text-sm font-bold">{l}<input name={k} type="date" defaultValue={existing?.[k]||''} className="input mt-1 w-full"/></label>)}</div><div className="grid gap-4 sm:grid-cols-2">{fields.map((k,i)=><label key={k} className="block text-sm font-bold">{labels[i]} ($ / year)<input name={k} type="number" min="0" max="10000000" step=".01" defaultValue={numeric(existing?.[k])} placeholder="Unknown" className="input mt-1 w-full"/></label>)}</div><p className="text-xs text-slate-500">Scholarships and grants only. Do not enter student loans as aid. Leave unknown amounts blank.</p><div className="grid gap-4 sm:grid-cols-2">{[['athletic_opportunity','Athletic opportunity'],['academic_notes','Academic and campus fit'],['renewal_terms','Scholarship renewal conditions'],['notes','Other notes or questions']].map(([k,l])=><label key={k} className="block text-sm font-bold">{l}<textarea name={k} rows={3} maxLength={1500} defaultValue={existing?.[k]||''} className="input mt-1 w-full"/></label>)}</div><div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn btn-red">{existing?'Save changes':'Save offer'}</button>{existing&&<Link href="/offers#offer-editor" className="text-sm font-bold text-slate-600 hover:underline">Cancel editing</Link>}</div></form></>}
 </section></div></PageFrame></AppShell>;
}
