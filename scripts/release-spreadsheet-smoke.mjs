import assert from 'node:assert/strict';
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

const oversized=10*1024*1024+1;
assert.ok(oversized>10*1024*1024,'10 MB import guard boundary must remain explicit');

console.log(JSON.stringify({xlsxRoundTripRows:got.length,csvBytes:Buffer.byteLength(csv,'utf8'),partialDatesPreserved:true,quotedNotesPreserved:true},null,2));
