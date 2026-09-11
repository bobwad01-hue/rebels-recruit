import fs from 'node:fs';

const files=['app/import/page.tsx','app/import/team/page.tsx','app/exports/page.tsx','app/api/export/route.ts'];
for(const file of files){
  let s=fs.readFileSync(file,'utf8');
  s=s.replaceAll("from 'exceljs'","from 'exceljs-hardened'").replaceAll("import('exceljs')","import('exceljs-hardened')");
  if((file==='app/import/page.tsx'||file==='app/import/team/page.tsx')&&!s.includes('MAX_SPREADSHEET_BYTES')){
    s=s.replace("type Row=Record<string,any>;","type Row=Record<string,any>;\nconst MAX_SPREADSHEET_BYTES=10*1024*1024;");
    s=s.replace("async function readFile(file:File){","async function readFile(file:File){if(file.size>MAX_SPREADSHEET_BYTES){setRows([]);setHeaders([]);setReview([]);setFileName(file.name);setMsg('This spreadsheet is larger than 10 MB. Reduce the file size or export only the recruiting-history rows you need, then try again.');return}");
  }
  fs.writeFileSync(file,s);
}
console.log('Spreadsheet hardening migration applied.');
