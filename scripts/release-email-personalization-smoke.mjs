// Lightweight release gate: exercise the shared token resolver and verify
// both the composer and Gmail endpoint use it before any send.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('lib/email-personalization.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(js,{module,exports:module.exports});
const {emailPersonalizationKey,normalizeEmailPersonalizationTokens,resolveEmailPersonalization,hasEmailPersonalizationTokens}=module.exports;
const values={coachFirstName:'Bob',coachLastName:'Waddell',coachFullName:'Bob Waddell',collegeName:'Buena Vista University'};
assert.equal(emailPersonalizationKey("Coach's Last Name"),'coachLastName');
assert.equal(normalizeEmailPersonalizationTokens('Hi Coach {{Coach Last Name}},'),'Hi Coach {{coachLastName}},');
assert.equal(resolveEmailPersonalization('Hi Coach {{Coach Last Name}},',values).text,'Hi Coach Waddell,');
assert.equal(resolveEmailPersonalization('Hello {{coachFirstName}} {{coachLastName}} at {{collegeName}}',values).text,'Hello Bob Waddell at Buena Vista University');
assert.equal(resolveEmailPersonalization('{{coachFullName}}',values).text,'Bob Waddell');
assert.equal(resolveEmailPersonalization('Hi Coach {{coachLastName}}',{}).missing.join('|'),"Coach's Last Name");
assert.equal(resolveEmailPersonalization('Hi {{unrecognizedToken}}',values).missing.join('|'),'unrecognizedToken');
assert.equal(resolveEmailPersonalization('<b>{{coachLastName}}</b>',{coachLastName:'O<Neil & Sons'},true).text,'<b>O&lt;Neil &amp; Sons</b>');
assert.equal(hasEmailPersonalizationTokens('Hi Coach {{Coach Last Name}}'),true);
assert.equal(hasEmailPersonalizationTokens('Hi Coach Waddell'),false);
const editor=fs.readFileSync('components/RichEmailEditor.tsx','utf8');
const composer=fs.readFileSync('components/CoachActionBar.tsx','utf8');
const route=fs.readFileSync('app/api/google/gmail/send/route.ts','utf8');
assert.ok(editor.includes('Insert Personalization')&&editor.includes('createPersonalizationChip'));
assert.ok(editor.includes('emailPersonalizationToken(key)')&&editor.includes('htmlFrom(ref.current)'));
assert.ok(composer.includes('personalizationValues={personalizationValues}'));
assert.ok(composer.includes('Preview completed email')&&composer.includes('personalizationMissing.length'));
assert.ok(composer.includes('setBody(selected.body)'),'Saved templates must preserve tokens');
assert.ok(route.includes('resolvedSubject=resolveEmailPersonalization'));
assert.ok(route.includes('resolvedHtml=resolveEmailPersonalization(bodyHtml,personalizedValues,true)'));
assert.ok(route.indexOf('const missingFields=')<route.indexOf("getGoogleAccessToken(user.id,'gmail')"),'Unresolved tokens must be rejected before Gmail');
console.log('Email personalization regression checks passed.');
