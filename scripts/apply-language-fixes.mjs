import fs from 'node:fs';
import path from 'node:path';

const replacements=[
  ['Next Moves','Next Steps'],
  ['Next Move','Next Step'],
  ['Open Player 360°','Review Player 360°'],
  ['Open Messages','Review Messages'],
  ['Open School','Review School'],
  ['Open Coach Relationship','Review Coach Relationship'],
  ['View Activity Details','Review Activity Details'],
  ['Open Recruiting Health','Review Recruiting Health'],
  ['Open Connections','Review Connections'],
  ['Take Action','Choose an Action'],
  ['exact-date','dated'],
  ['Exact date','Specific date'],
  ['exact date','specific date'],
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

let changed=0;
for(const file of ['app','components'].flatMap(walk)){
  const before=fs.readFileSync(file,'utf8');
  let after=before;
  for(const [from,to] of replacements)after=after.split(from).join(to);
  if(after!==before){fs.writeFileSync(file,after);changed++;console.log(`updated ${file}`)}
}
console.log(`Language migration updated ${changed} file(s).`);
