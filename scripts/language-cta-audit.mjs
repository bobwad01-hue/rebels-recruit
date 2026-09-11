import fs from 'node:fs';
import path from 'node:path';

const roots=['app','components'];
const banned=[
  {label:'Next Move / Next Moves',pattern:/\bNext Moves?\b/i,reason:'Use Next Step / Next Steps in user-facing copy.'},
  {label:'Open Context',pattern:/\bOpen Context\b/i,reason:'Use a specific review/action label.'},
  {label:'Take Action',pattern:/\bTake Action\b/i,reason:'Name the actual action.'},
  {label:'exact-date',pattern:/\bexact-date\b/i,reason:'Avoid implementation language in user-facing copy.'},
  {label:'exact date',pattern:/\bexact date\b/i,reason:'Use plain recruiting language instead.'},
  {label:'Open Messages',pattern:/\bOpen Messages\b/i,reason:'Use Message Player(s) or Review Messages.'},
  {label:'Open Player 360°',pattern:/\bOpen Player 360°/i,reason:'Use Review Player 360°.'},
  {label:'Open School',pattern:/\bOpen School\b/i,reason:'Use Review School.'},
  {label:'Open Coach Relationship',pattern:/\bOpen Coach Relationship\b/i,reason:'Use Review Coach Relationship.'},
  {label:'View Activity Details',pattern:/\bView Activity Details\b/i,reason:'Use Review Activity Details.'},
  {label:'Open Recruiting Health',pattern:/\bOpen Recruiting Health\b/i,reason:'Use Review Recruiting Health.'},
  {label:'Open Connections',pattern:/\bOpen Connections\b/i,reason:'Use Review Connections.'},
];

function walk(dir){
  if(!fs.existsSync(dir))return [];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(p));
    else if(/\.(tsx|ts|jsx|js)$/.test(entry.name))out.push(p);
  }
  return out;
}

const findings=[];
for(const file of roots.flatMap(walk)){
  const source=fs.readFileSync(file,'utf8');
  const lines=source.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    for(const rule of banned){
      if(rule.pattern.test(lines[i]))findings.push({file,line:i+1,...rule,snippet:lines[i].trim().slice(0,220)});
    }
  }
}

if(findings.length){
  console.error('\nUser-facing language audit failed:\n');
  for(const f of findings)console.error(`${f.file}:${f.line}  "${f.label}"  ${f.reason}\n  ${f.snippet}\n`);
  process.exit(1);
}
console.log('User-facing language audit passed.');
