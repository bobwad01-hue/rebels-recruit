'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

type Props={relationshipId?:string|null;autoScore:number;autoLabel:string;reasons:string[];manualScore?:number|null;};

export default function RelationshipStrengthCard({relationshipId,autoScore,autoLabel,reasons,manualScore}:Props){
 const c=createClient();
 const [override,setOverride]=useState(manualScore?String(manualScore):'auto');
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const shown=override==='auto'?autoScore:Number(override);
 const label=override==='auto'?autoLabel:['','Early','Developing','Engaged','Strong','Very Strong'][shown];
 async function change(value:string){
  setOverride(value);setMessage('');
  if(!relationshipId)return;
  setSaving(true);
  const {error}=await c.from('athlete_coaches').update({relationship_rating:value==='auto'?null:Number(value)}).eq('id',relationshipId);
  setSaving(false);
  setMessage(error?error.message:value==='auto'?'Automatic strength restored.':'Manual override saved.');
 }
 return <section className="card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-lg">Relationship Strength</h2><p className="muted text-xs mt-1">{override==='auto'?'Calculated automatically from recruiting activity.':'Manual override is active.'}</p></div><span className="text-3xl font-black">{shown}/5</span></div><div className="mt-3 font-black">{label}</div><div className="mt-4 flex flex-wrap gap-2">{reasons.slice(0,4).map(r=><span key={r} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{r}</span>)}</div>{relationshipId&&<label className="block mt-5"><span className="text-xs uppercase font-bold muted">Strength setting</span><select className="input mt-1" value={override} disabled={saving} onChange={e=>change(e.target.value)}><option value="auto">Automatic</option><option value="1">1 — Early</option><option value="2">2 — Developing</option><option value="3">3 — Engaged</option><option value="4">4 — Strong</option><option value="5">5 — Very Strong</option></select></label>}{message&&<div className="text-xs font-semibold mt-2">{message}</div>}</section>
}
