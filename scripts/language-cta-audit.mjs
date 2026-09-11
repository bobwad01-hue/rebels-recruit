import fs from 'node:fs';
import path from 'node:path';

const roots=['app','components'];
const banned=[
  {text:'Next Move',reason:'Use Next Step / Next Steps in user-facing copy.'},
  {text:'Open Context',reason:'Use a specific review/action label.'},
  {text:'Take Action',reason:'Name the actual action.'},
  {text:'exact-date',reason:'Avoid implementation language in user-facing copy.'},
  {text:'exact date',reason:'Use plain recruiting language instead.'},
  {text:'Open Messages',reason:'Use Message Player(s) or Review Messages.'},
  {text:'Open Player 360°',reason:'Use Review Player 360°.'},
  {text:'Open School',reason:'Use Review School.'},
  {text:'Open Coach Relationship',reason:'Use Review Coach Relationship.'},
  {text:'View Activity Details',reason:'Use Review Activity Details.'},
  {text:'Open Recruiting Health',reason:'Use Review Recruiting Health.'},
  {text:'Open Connections',reason:'Use Review Connections.'},
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
      if(lines[i].includes(rule.text))findings.push({file,line:i+1,...rule,snippet:lines[i].trim().slice(0,220)});
    }
  }
}

if(findings.length){
  console.error('\nUser-facing language audit failed:\n');
  for(const f of findings)console.error(`${f.file}:${f.line}  "${f.text}"  ${f.reason}\n  ${f.snippet}\n`);
  process.exit(1);
}
console.log('User-facing language audit passed.');
