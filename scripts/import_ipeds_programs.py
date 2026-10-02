#!/usr/bin/env python3
"""Import IPEDS majors into RLTNL.

Usage:
  python scripts/import_ipeds_programs.py HD2025.csv C2025_A.csv

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
Uses only Python standard library. Matches RLTNL colleges to IPEDS institutions by
normalized school name + state, stores UNITID, then imports bachelor's-or-higher
programs with at least one completion. Re-running replaces the current IPEDS snapshot.
"""
import csv,json,os,re,sys,urllib.request
from collections import defaultdict

URL=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEAD={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=minimal"}

def req(path,method="GET",body=None):
    r=urllib.request.Request(URL+"/rest/v1/"+path,data=None if body is None else json.dumps(body).encode(),headers=HEAD,method=method)
    with urllib.request.urlopen(r) as x:
        raw=x.read()
        return json.loads(raw) if raw else None

def norm(s):
    s=(s or "").lower().replace("&","and")
    s=re.sub(r"\b(the|university|college|of|at|campus|main)\b"," ",s)
    return re.sub(r"[^a-z0-9]+"," ",s).strip()

def rows(path):
    with open(path,encoding="utf-8-sig",newline="") as f: yield from csv.DictReader(f)

if len(sys.argv)!=3:
    raise SystemExit("Pass HD20XX.csv and C20XX_A.csv")
hd,comp=sys.argv[1:]
institutions={}
for r in rows(hd):
    institutions[(norm(r.get("INSTNM")), (r.get("STABBR") or "").upper())]=int(r["UNITID"])

colleges=req("colleges?select=id,name,state&limit=5000") or []
unit_to_college={}
updates=[]
for c in colleges:
    u=institutions.get((norm(c["name"]), (c.get("state") or "").upper()))
    if u:
        unit_to_college[u]=c["id"]
        req("colleges?id=eq."+c["id"],"PATCH",{"ipeds_unitid":u})

year=int(re.search(r"(20\d{2})",os.path.basename(comp)).group(1))
programs={}
for r in rows(comp):
    unit=int(r["UNITID"])
    college_id=unit_to_college.get(unit)
    if not college_id: continue
    # Bachelor's, master's, doctoral and post-baccalaureate/post-master's levels.
    level=int(r.get("AWLEVEL") or 0)
    # Associate and bachelor's programs are the relevant recruiting filters for JUCO and four-year schools.\n    if level not in (3,5): continue
    total=int(float(r.get("CTOTALT") or 0))
    if total<=0: continue
    cip=(r.get("CIPCODE") or "").strip()
    title=(r.get("CIPTITLE") or r.get("CIPDESC") or "").strip()
    if not cip or not title: continue
    programs[(college_id,cip,level)]={"college_id":college_id,"ipeds_unitid":unit,"cip_code":cip,"cip_title":title,"award_level":level,"completions":total,"reporting_year":year,"source":"IPEDS"}

req("college_programs?source=eq.IPEDS","DELETE")
vals=list(programs.values())
for i in range(0,len(vals),500):
    req("college_programs","POST",vals[i:i+500])
print(f"Matched {len(unit_to_college)} colleges; imported {len(vals)} program records for {year}.")
