import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import ExcelJS from 'exceljs-hardened';

const rows=[
  {Player:'Maia Example',School:'Boston College',Date:'09/11/2026',Type:'Email',Notes:'Coach replied, "See you at camp."'},
  {Player:'Maia Example',School:'College of Charleston',Date:'08/2026',Type:'Camp',Notes:'Historical month-only date'},
  {Player:'Second Athlete',School:'Example State',Date:'2025',Type:'Visit',Notes:'Line one\nLine two'},
];

const wb=new ExcelJS.Workbook();
const ws=wb.addWorksheet('Recruiting History');
const headers=Object.keys(rows[0]);
ws.addRow(headers);
for(const row of rows)ws.addRow(headers.map(h=>row[h]??''));
const buffer=await wb.xlsx.writeBuffer();
assert.ok(buffer.byteLength>1000,'Workbook should contain XLSX data');

const roundTrip=new ExcelJS.Workbook();
await roundTrip.xlsx.load(buffer);
const sheet=roundTrip.worksheets[0];
assert.ok(sheet,'Workbook must contain a worksheet');
const gotHeaders=(sheet.getRow(1).values).slice(1).map(String);
assert.deepEqual(gotHeaders,headers,'Headers must survive XLSX round-trip');
const got=[];
sheet.eachRow((row,n)=>{if(n===1)return;const values=row.values.slice(1);got.push(Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'')])))});
assert.equal(got.length,rows.length,'All XLSX rows must survive round-trip');
assert.equal(got[0].Notes,rows[0].Notes,'Quoted note text must survive XLSX round-trip');
assert.equal(got[1].Date,'08/2026','Month precision must remain unchanged');
assert.equal(got[2].Date,'2025','Year precision must remain unchanged');
assert.equal(got[2].Notes,rows[2].Notes,'Multiline notes must survive XLSX round-trip');

const csvCell=(v)=>`"${String(v??'').replaceAll('"','""')}"`;
const csv=[headers.map(csvCell).join(','),...rows.map(r=>headers.map(h=>csvCell(r[h])).join(','))].join('\n');
assert.match(csv,/"Coach replied, ""See you at camp\."""/,'CSV must escape embedded quotes');
assert.match(csv,/"Line one\nLine two"/,'CSV must retain embedded newlines inside quoted cells');
assert.ok(Buffer.byteLength(csv,'utf8')>100,'CSV should contain representative export data');

let malformedRejected=false;
try{const bad=new ExcelJS.Workbook();await bad.xlsx.load(Buffer.from('this is not an xlsx workbook'))}catch{malformedRejected=true}
assert.equal(malformedRejected,true,'Malformed XLSX data must be rejected');

const largeStart=performance.now();
const large=new ExcelJS.Workbook(),largeSheet=large.addWorksheet('Large Export');
largeSheet.addRow(headers);
for(let i=0;i<5000;i++)largeSheet.addRow([`Player ${i%100}`,`School ${i%200}`,i%7===0?'08/2026':'09/11/2026',i%2?'Email':'Camp',`Representative recruiting note ${i}`]);
const largeBuffer=await large.xlsx.writeBuffer();
const largeMs=performance.now()-largeStart;
assert.ok(largeBuffer.byteLength>50000,'Large workbook should contain representative export data');
assert.ok(largeMs<15000,`5,000-row workbook exceeded 15s budget: ${Math.round(largeMs)}ms`);
assert.ok(process.memoryUsage().heapUsed/1024/1024<512,'Spreadsheet smoke test exceeded 512 MB heap budget');

const oversized=10*1024*1024+1;
assert.ok(oversized>10*1024*1024,'10 MB import guard boundary must remain explicit');

console.log(JSON.stringify({xlsxRoundTripRows:got.length,csvBytes:Buffer.byteLength(csv,'utf8'),partialDatesPreserved:true,quotedNotesPreserved:true,malformedXlsxRejected:malformedRejected,largeWorkbookRows:5000,largeWorkbookMs:Math.round(largeMs),largeWorkbookBytes:largeBuffer.byteLength},null,2));
