import fs from 'node:fs';

for(const file of ['app/intelligence/page.tsx','components/CollegesCoachesBoard.tsx']){
  const before=fs.readFileSync(file,'utf8');
  const after=before.split('Next Moves').join('Next Steps').split('Next Move').join('Next Step');
  if(after!==before){fs.writeFileSync(file,after);console.log(`updated ${file}`)}
}
