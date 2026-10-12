import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const athlete = read('app/discover/page.tsx');
const parent = read('app/parent/discover/page.tsx');
const advisor = read('app/advisors/discover/page.tsx');
const compare = read('components/SchoolCompare.tsx');
const legacy = read('app/compare/page.tsx');

for(const [role,page] of [['athlete',athlete],['parent',parent],['advisor',advisor]]){
  assert.match(page,/\[browse,setBrowse\]=useState\(true\)/,role+' directory must open by default');
  assert.match(page,/Explore All Schools \(Directory\)/,role+' directory must be clearly labeled');
  assert.match(page,/<SchoolCompare schools=\{schools\}/,role+' must offer school comparison');
}
assert.ok(athlete.indexOf('Explore All Schools (Directory)')<athlete.indexOf('<SchoolCompare schools={schools}'),'Athlete directory comes before compare');
assert.ok(athlete.indexOf('<SchoolCompare schools={schools}')<athlete.indexOf('<div className="space-y-10">{displayGroups.map'),'Athlete recommendations remain after compare');
for(const [role,page] of [['parent',parent],['advisor',advisor]]){
  assert.match(page,/\{browse&&<section className="mt-7">/,role+' directory must not replace recommendations');
  assert.match(page,/<\/section>}<SchoolCompare schools=\{schools\}/,role+' comparison follows directory');
  assert.match(page,/<div className="space-y-9 mt-7">\{groups.map/,role+' recommendation groups must always render');
}
assert.match(compare,/\[0,1,2\]\.map/, 'Exactly three comparison slots');
assert.match(compare,/current\.length<3/, 'Never select more than three schools');
assert.match(compare,/Hide similarities/, 'Comparison must support hiding similarities');
assert.match(compare,/suggestions\.map/, 'Recommended groups must be available as quick comparisons');
assert.match(compare,/schoolHref/, 'School links must preserve role context');
assert.doesNotMatch(compare,/\.from\('athlete_colleges'\)/, 'Comparing must never alter athlete Connections');
assert.match(legacy,/redirect\('\/discover#compare-schools'\)/, 'Legacy compare route must use the canonical Find Schools comparison');
console.log('Find Schools directory, comparison and recommendation regression checks passed.');
