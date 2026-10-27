import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/recruiting-intelligence.ts',import.meta.url),'utf8');
assert.ok(source.includes('buildRecruitingIntelligence'));
console.log('Recruiting Health source present');
