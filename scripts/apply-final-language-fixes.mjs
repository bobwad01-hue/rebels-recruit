import fs from 'node:fs';

for(const file of ['app/intelligence/page.tsx','components/CollegesCoachesBoard.tsx']){
  const before=fs.readFileSync(file,'utf8');
  let after=before.replace(/\bnext moves\b/gi,'Next Steps').replace(/\bnext move\b/gi,'Next Step');
  if(file==='app/intelligence/page.tsx'){
    after=after
      .replace(/Open relationship/g,'Review relationship')
      .replace(/No exact last-contact date is available\./g,'No recorded contact date is available.')
      .replace(/Last exact contact/g,'Last recorded contact')
      .replace(/last exact contact/g,'last recorded contact')
      .replace(/dated relationships/g,'relationships with recorded contact dates');
  }
  if(after!==before){fs.writeFileSync(file,after);console.log(`updated ${file}`)}
}
