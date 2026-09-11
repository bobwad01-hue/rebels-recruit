import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,s)=>fs.writeFileSync(file,s);
function replaceRequired(source,from,to,label){if(!source.includes(from))throw new Error(`Could not find ${label}`);return source.replace(from,to)}

const excelDateHelpers=`const excelSerialDate=(serial:number)=>{if(!Number.isFinite(serial))return null;const d=new Date(Math.round((serial-25569)*86400000));if(Number.isNaN(d.getTime()))return null;return{y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate()}};`;
const parserHelpers=`function parseCsv(text:string){const out:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\\n'||ch==='\\r')&&!quoted){if(ch==='\\r'&&text[i+1]==='\\n')i++;row.push(cell);if(row.some(v=>v!==''))out.push(row);row=[];cell=''}else cell+=ch}row.push(cell);if(row.some(v=>v!==''))out.push(row);return out}\nfunction excelValue(v:any):any{if(v===null||v===undefined)return'';if(v instanceof Date)return v;if(typeof v!=='object')return v;if('result' in v)return excelValue(v.result);if(Array.isArray(v.richText))return v.richText.map((x:any)=>x.text||'').join('');if('text' in v)return v.text||'';if('hyperlink' in v)return v.text||v.hyperlink||'';return String(v)}`;

// Personal recruiting-history import.
{
 const file='app/import/page.tsx';let s=read(file);
 if(s.includes("from 'xlsx'")){
  s=s.replace("import * as XLSX from 'xlsx';","import ExcelJS from 'exceljs';");
  const old="const dateInfo=(v:any)=>{if(v===null||v===undefined||v==='')return{date:null,precision:'unknown',year:null,month:null,label:'Unknown date'};if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return{date:`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`,precision:'exact',year:d.y,month:d.m,label:`${d.m}/${d.d}/${d.y}`}}const s=String(v).trim();";
  const neu=`${excelDateHelpers}\nconst dateInfo=(v:any)=>{if(v===null||v===undefined||v==='')return{date:null,precision:'unknown',year:null,month:null,label:'Unknown date'};if(v instanceof Date&&!Number.isNaN(v.getTime())){const y=v.getFullYear(),m=v.getMonth()+1,d=v.getDate();return{date:\`${'${y}'}-${'${String(m).padStart(2,\'0\')}'}-${'${String(d).padStart(2,\'0\')}'}\`,precision:'exact',year:y,month:m,label:\`${'${m}'}/${'${d}'}/${'${y}'}\`}}if(typeof v==='number'){const d=excelSerialDate(v);if(d)return{date:\`${'${d.y}'}-${'${String(d.m).padStart(2,\'0\')}'}-${'${String(d.d).padStart(2,\'0\')}'}\`,precision:'exact',year:d.y,month:d.m,label:\`${'${d.m}'}/${'${d.d}'}/${'${d.y}'}\`}}const s=String(v).trim();`;
  s=replaceRequired(s,old,neu,'personal import date parser');
  const oldRead=" async function readFile(file:File){setResult(null);setReview([]);setMsg('');setFileName(file.name);try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw new Error('No worksheet');const json=XLSX.utils.sheet_to_json<Row>(ws,{defval:''});const hs=json.length?Object.keys(json[0]):[];setRows(json);setHeaders(hs);setMapping(autoMap(hs));if(!json.length)setMsg('The spreadsheet opened successfully, but no data rows were found.')}catch{setRows([]);setHeaders([]);setMsg('This spreadsheet could not be read. Confirm it is a valid Excel or CSV file and try again.')}}";
  const newRead=` ${parserHelpers}\n async function readFile(file:File){setResult(null);setReview([]);setMsg('');setFileName(file.name);try{let json:Row[]=[];if(file.name.toLowerCase().endsWith('.csv')){const matrix=parseCsv(await file.text());const hs=(matrix[0]||[]).map(x=>String(x).trim());json=matrix.slice(1).filter(r=>r.some(v=>String(v).trim()!=='' )).map(r=>Object.fromEntries(hs.map((h,i)=>[h,r[i]??''])))}else if(file.name.toLowerCase().endsWith('.xlsx')){const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer() as any);const ws=wb.worksheets[0];if(!ws)throw new Error('No worksheet');const hs=(ws.getRow(1).values as any[]).slice(1).map(v=>String(excelValue(v)).trim());ws.eachRow((row,rowNumber)=>{if(rowNumber===1)return;const vals=(row.values as any[]).slice(1).map(excelValue);if(vals.some(v=>String(v??'').trim()!==''))json.push(Object.fromEntries(hs.map((h,i)=>[h,vals[i]??''])))});}else throw new Error('Unsupported file type');const hs=json.length?Object.keys(json[0]):[];setRows(json);setHeaders(hs);setMapping(autoMap(hs));if(!json.length)setMsg('The spreadsheet opened successfully, but no data rows were found.')}catch{setRows([]);setHeaders([]);setMsg('This spreadsheet could not be read. Use an .xlsx or .csv file and try again.')}}`;
  s=replaceRequired(s,oldRead,newRead,'personal spreadsheet reader');
 }
 s=s.replace('accept=".xlsx,.xls,.csv"','accept=".xlsx,.csv"').replace('Upload an Excel or CSV file','Upload an Excel (.xlsx) or CSV file');write(file,s);
}

// Organization/team history import.
{
 const file='app/import/team/page.tsx';let s=read(file);
 if(s.includes("from 'xlsx'")){
  s=s.replace("import * as XLSX from 'xlsx';","import ExcelJS from 'exceljs';");
  const old="const dateInfo=(v:any)=>{if(v===null||v===undefined||v==='')return{date:null,precision:'unknown',year:null,month:null};if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return{date:`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`,precision:'exact',year:d.y,month:d.m}}const s=String(v).trim();";
  const neu=`${excelDateHelpers}\nconst dateInfo=(v:any)=>{if(v===null||v===undefined||v==='')return{date:null,precision:'unknown',year:null,month:null};if(v instanceof Date&&!Number.isNaN(v.getTime())){const y=v.getFullYear(),m=v.getMonth()+1,d=v.getDate();return{date:\`${'${y}'}-${'${String(m).padStart(2,\'0\')}'}-${'${String(d).padStart(2,\'0\')}'}\`,precision:'exact',year:y,month:m}}if(typeof v==='number'){const d=excelSerialDate(v);if(d)return{date:\`${'${d.y}'}-${'${String(d.m).padStart(2,\'0\')}'}-${'${String(d.d).padStart(2,\'0\')}'}\`,precision:'exact',year:d.y,month:d.m}}const s=String(v).trim();`;
  s=replaceRequired(s,old,neu,'team import date parser');
  const oldRead=" async function readFile(file:File){setResult(null);setReview([]);setMsg('');setFileName(file.name);const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];const json=XLSX.utils.sheet_to_json<Row>(ws,{defval:''});const hs=json.length?Object.keys(json[0]):[];setRows(json);setHeaders(hs);setMapping(autoMap(hs))}";
  const newRead=` ${parserHelpers}\n async function readFile(file:File){setResult(null);setReview([]);setMsg('');setFileName(file.name);try{let json:Row[]=[];if(file.name.toLowerCase().endsWith('.csv')){const matrix=parseCsv(await file.text());const hs=(matrix[0]||[]).map(x=>String(x).trim());json=matrix.slice(1).filter(r=>r.some(v=>String(v).trim()!=='' )).map(r=>Object.fromEntries(hs.map((h,i)=>[h,r[i]??''])))}else if(file.name.toLowerCase().endsWith('.xlsx')){const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer() as any);const ws=wb.worksheets[0];if(!ws)throw new Error('No worksheet');const hs=(ws.getRow(1).values as any[]).slice(1).map(v=>String(excelValue(v)).trim());ws.eachRow((row,rowNumber)=>{if(rowNumber===1)return;const vals=(row.values as any[]).slice(1).map(excelValue);if(vals.some(v=>String(v??'').trim()!==''))json.push(Object.fromEntries(hs.map((h,i)=>[h,vals[i]??''])))});}else throw new Error('Unsupported file type');const hs=json.length?Object.keys(json[0]):[];setRows(json);setHeaders(hs);setMapping(autoMap(hs));if(!json.length)setMsg('The spreadsheet opened successfully, but no data rows were found.')}catch{setRows([]);setHeaders([]);setMsg('This spreadsheet could not be read. Use an .xlsx or .csv file and try again.')}}`;
  s=replaceRequired(s,oldRead,newRead,'team spreadsheet reader');
 }
 s=s.replace('accept=".xlsx,.xls,.csv"','accept=".xlsx,.csv"').replace('Upload Excel or CSV','Upload Excel (.xlsx) or CSV');write(file,s);
}

// Client Report Center Excel generation.
{
 const file='app/exports/page.tsx';let s=read(file);
 if(s.includes("await import('xlsx')")){
  const old=" async function excel(kind:string,ss:Sheet[]){const XLSX=await import('xlsx'),wb=XLSX.utils.book_new();ss.forEach(s=>{const h=s.rows.length?Object.keys(s.rows[0]):['No data'],data=s.rows.length?s.rows.map(r=>h.map(k=>r[k]??'')):[['No matching data.']],aoa:any[][]=[[s.title],[`${orgName} | Generated ${new Date().toLocaleString()}`],[],h,...data],ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=h.map(k=>({wch:Math.min(44,Math.max(12,k.length+2,...s.rows.slice(0,50).map(r=>String(r[k]??'').length+2)))}));ws['!autofilter']={ref:`A4:${XLSX.utils.encode_col(Math.max(0,h.length-1))}${aoa.length}`};XLSX.utils.book_append_sheet(wb,ws,s.name.slice(0,31))});XLSX.writeFile(wb,`rebels-recruit-${safe(REPORTS.find(r=>r.id===kind)?.title||kind)}-${today()}.xlsx`,{compression:true})}";
  const neu=" const excelColumn=(n:number)=>{let s='';for(let x=n;x>0;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s};\n async function excel(kind:string,ss:Sheet[]){const ExcelJS=(await import('exceljs')).default,wb=new ExcelJS.Workbook();wb.creator='Rebels Recruit';ss.forEach(s=>{const h=s.rows.length?Object.keys(s.rows[0]):['No data'],data=s.rows.length?s.rows.map(r=>h.map(k=>r[k]??'')):[['No matching data.']],ws=wb.addWorksheet(s.name.slice(0,31));ws.addRow([s.title]);ws.addRow([`${orgName} | Generated ${new Date().toLocaleString()}`]);ws.addRow([]);ws.addRow(h);data.forEach(row=>ws.addRow(row));ws.columns=h.map(k=>({width:Math.min(44,Math.max(12,k.length+2,...s.rows.slice(0,50).map(r=>String(r[k]??'').length+2)))}));if(h.length)ws.autoFilter=`A4:${excelColumn(h.length)}4`;ws.views=[{state:'frozen',ySplit:4}];ws.getRow(4).font={bold:true}});const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`rebels-recruit-${safe(REPORTS.find(r=>r.id===kind)?.title||kind)}-${today()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}";
  s=replaceRequired(s,old,neu,'Report Center Excel generator');
 }
 write(file,s);
}

// Server-side athlete interaction export.
{
 const file='app/api/export/route.ts';let s=read(file);
 if(s.includes("from 'xlsx'")){
  s=s.replace("import {NextResponse} from 'next/server';import {createClient} from '@/lib/supabase-server';import * as XLSX from 'xlsx';","import {NextResponse} from 'next/server';import {createClient} from '@/lib/supabase-server';import ExcelJS from 'exceljs';import {cleanDisplayNote} from '@/lib/display-notes';");
  const old="const rows=(data||[]).map((r:any)=>({Date:r.date,Type:r.type,InitiatedBy:r.initiated_by,College:r.colleges?.name||'',Coach:r.college_coaches?`${r.college_coaches.first_name} ${r.college_coaches.last_name}`:'',Note:r.note||''}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Interactions');const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});return new NextResponse(new Uint8Array(buf),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=\"rebels-recruit-interactions.xlsx\"'}})";
  const neu="const rows=(data||[]).map((r:any)=>({Date:r.date,Type:r.type,InitiatedBy:r.initiated_by,School:r.colleges?.name||'',Coach:r.college_coaches?`${r.college_coaches.first_name} ${r.college_coaches.last_name}`:'',Note:cleanDisplayNote(r.note)}));const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Interactions'),headers=['Date','Type','InitiatedBy','School','Coach','Note'];ws.addRow(headers);rows.forEach((r:any)=>ws.addRow(headers.map(h=>r[h]??'')));ws.getRow(1).font={bold:true};ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter='A1:F1';ws.columns=headers.map(h=>({width:h==='Note'?44:Math.max(14,h.length+2)}));const buf=await wb.xlsx.writeBuffer();return new NextResponse(new Uint8Array(buf as any),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=\"rebels-recruit-interactions.xlsx\"'}})";
  s=replaceRequired(s,old,neu,'server export generator');
 }
 write(file,s);
}

console.log('Spreadsheet security migration applied.');
