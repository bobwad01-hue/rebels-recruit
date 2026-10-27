import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../lib/recruiting-intelligence.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(js,{module,exports:module.exports,Date,Math,Set,Map,console});
const {buildRecruitingIntelligence,recruitingStage}=module.exports;
const score=(input={})=>buildRecruitingIntelligence(input);
const year=new Date().getFullYear()+(new Date().getMonth()>=6?1:0);
const category=(result,id)=>result.categories.find(c=>c.id===id);

for(const [offset,stage] of [[3,'early'],[2,'building'],[1,'active'],[0,'decision']]){
 assert.equal(recruitingStage(year+offset),stage);
 const result=score({healthProfile:{classYear:year+offset}});
 assert.equal(result.stage,stage);
 assert.equal(result.categories.reduce((n,c)=>n+c.max,0),100);
 assert.equal(result.categories.reduce((n,c)=>n+c.score,0),result.score);
 assert.ok(result.score>=0&&result.score<=100);
 for(const c of result.categories)assert.ok(c.score>=0&&c.score<=c.max);
}
const empty=score();
assert.equal(category(empty,'foundation').score,0);
assert.equal(category(empty,'schools').score,0);
assert.equal(category(empty,'relationships').score,0);
assert.equal(category(empty,'activity').score,0);
assert.equal(category(empty,'follow').score,Math.round(category(empty,'follow').max*.5));
const early=score({healthProfile:{classYear:year+3}});
assert.equal(category(early,'follow').score,category(early,'follow').max);
const complete=score({healthProfile:{profileComplete:true,fitComplete:true}});
assert.equal(category(complete,'foundation').score,category(complete,'foundation').max);
const done=score({tasks:[{id:'one',status:'completed'}]});
const overdue=score({tasks:[{id:'one',status:'completed'},{id:'two',status:'open',due_date:'2000-01-01'}]});
assert.ok(category(overdue,'follow').score<category(done,'follow').score);
assert.equal(overdue.overdueNextMoves,1);
assert.ok(overdue.signals.some(s=>s.id==='overdue-two'));
const gamePlan=readFileSync(new URL('../app/game-plan/page.tsx',import.meta.url),'utf8');
assert.ok(gamePlan.includes('checks.filter(x=>x.ok).length/checks.length*100'));
const quickFill=readFileSync(new URL('../app/recruiting-quickfill/page.tsx',import.meta.url),'utf8');
assert.ok(quickFill.includes('QuickFill does not automatically fill or submit college forms.'));
console.log('Recruiting Health stage, bounds, task and QuickFill regression tests passed');
