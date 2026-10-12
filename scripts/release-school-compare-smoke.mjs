import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const athlete = read('app/discover/page.tsx');
const parent = read('app/parent/discover/page.tsx');
const advisor = read('app/advisors/discover/page.tsx');
const compare = read('components/SchoolCompare.tsx');
const legacy = read('app/compare/page.tsx');
const fitEngine = read('lib/college-fit.ts');
const programHook = read('lib/use-college-fit-programs.ts');

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
assert.match(compare,/\.from\('college_programs'\)/, 'Comparison uses populated reported academic programs');
assert.doesNotMatch(compare,/\.from\('college_majors'\)/, 'Comparison must not rely on the empty legacy college_majors table');
assert.match(compare,/Verified cost data isn’t available/, 'Missing costs are explained without a large notice');
assert.match(compare,/return r.percent\+'% Match';/, 'Comparison shows only the match percentage');
assert.doesNotMatch(compare,/factors checked/, 'Comparison omits evaluated-factor count from the visible score');
assert.match(compare,/<Info size=\{17\}/, 'Comparison provides a clickable circled info icon');
assert.match(compare,/onShowFitInfo\(s.id,e.currentTarget\)/, 'Match icon opens details for its school');
assert.match(compare,/fitInfo.factors.map/, 'Details show only factors actually used in the match');
assert.doesNotMatch(compare,/fitInfo.unavailable/, 'Details do not list factors excluded from scoring');
assert.match(compare,/role="dialog" aria-modal="true" aria-labelledby="fit-info-title"/, 'Match details are in an accessible dialog');
assert.doesNotMatch(compare,/Fit percentages are based only on evaluated survey preferences/, 'No long methodology footer');
assert.doesNotMatch(athlete,/Match percentages use the College Fit Survey/, 'No long methodology paragraph');
assert.doesNotMatch(compare,/title=\{r.hint/, 'No hover list of excluded criteria');
assert.match(compare,/Academic interests/, 'Comparison uses academic interests');
assert.match(compare,/Climate preference/, 'Comparison uses climate');
assert.doesNotMatch(compare,/label:'Distance preference'/, 'No redundant distance row');
assert.match(compare,/hasCostData/, 'Cost section only appears when verified data exists');
assert.match(compare,/hasReviews/, 'Review section only appears when reviews exist');
assert.match(compare,/Cost preferences aren’t included yet/, 'Unverified affordability is explicitly excluded');
assert.match(compare,/rows\.filter/, 'Comparison filters unavailable and duplicate rows');
assert.match(athlete,/% Match/, 'Percentage labels restored');
assert.match(athlete,/fitById/, 'Directory and recommendations share fit engine');
assert.match(fitEngine,/academicSearchTerms/, 'Academic interests evaluated');
assert.match(fitEngine,/weather_preferences/, 'Climate preferences evaluated');
assert.match(fitEngine,/top_priorities/, 'Top priorities weighted');
assert.match(programHook,/\.range\(from,from\+999\)/, 'Program lookup paginated');
for(const page of [athlete,parent,advisor])assert.match(page,/useCollegeFitPrograms/, 'All roles use shared program lookup');
assert.match(compare,/rltnl-compare-school/, 'School cards can send selections to the comparison');
assert.doesNotMatch(athlete,/advised\.length>0\?'xl:grid/, 'Comparison should use full available desktop width');
assert.match(athlete,/aria-label="Support Team recommendations"/, 'Support Team recommendations remain accessible above the directory');
for(const [role,page] of [['athlete',athlete],['parent',parent],['advisor',advisor]]){
  assert.match(page,/Add to Compare/,role+' school cards can add to comparison');
}

assert.doesNotMatch(compare,/\.from\('athlete_colleges'\)/, 'Comparing must never alter athlete Connections');
assert.match(legacy,/redirect\('\/discover#compare-schools'\)/, 'Legacy compare route must use the canonical Find Schools comparison');
console.log('Find Schools directory, comparison and recommendation regression checks passed.');
