import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function loadTs(path, dependencies = {}) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const execute = vm.runInNewContext('(function(exports, require, module) { ' + code + '\n})');
  execute(module.exports, (name) => {
    if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name);
    return dependencies[name];
  }, module);
  return module.exports;
}
const fonts = loadTs('lib/email-fonts.ts');
const { renderEmailHtml } = loadTs('lib/email-html.ts', { './email-fonts': fonts });
const editor = read('components/RichEmailEditor.tsx');
const composer = read('components/CoachActionBar.tsx');
const gmailSend = read('app/api/google/gmail/send/route.ts');

assert.deepEqual(Array.from(fonts.EMAIL_FONTS, font => font.label), ['Arial','Georgia','Verdana','Trebuchet MS','Times New Roman']);
assert.deepEqual(Array.from(fonts.EMAIL_SIZES, size => size.label), ['Small','Normal','Large']);
assert(editor.includes('aria-label="Font family"') && editor.includes('aria-label="Text size"'), 'Font and size controls must be accessible');
assert(editor.includes("command('fontName',font)") && editor.includes("command('fontSize',size)"), 'Font controls must format editor text');
assert(editor.includes('safeDraftHtml(html)'), 'Saved HTML must be sanitized before restoration');
assert(editor.includes('onPaste={e=>{e.preventDefault()'), 'Pasted HTML must not inject unsafe markup into drafts');
assert(composer.includes('html={bodyHtml}'), 'Saved formatted HTML must be restored in the composer');
assert(composer.includes('setBodyHtml(current => current'), 'Adding video links must not erase formatting');
assert(gmailSend.includes('renderEmailHtml(body,bodyHtml)'), 'Outgoing Gmail MIME HTML must use the formatted body');
assert(gmailSend.includes('font-size:16px;line-height:1.5'), 'Default Gmail text size must match the composer');

const formatted = renderEmailHtml('Hello Coach', '<font face="Georgia" size="4">Hello Coach</font>');
assert(formatted.includes('<span style="font-family:Georgia, serif;font-size:18px">Hello Coach</span>'), 'Font and size must survive Gmail HTML rendering');
const trebuchet = renderEmailHtml('Hello', '<font face="Trebuchet MS" size="2">Hello</font>');
assert(trebuchet.includes("font-family:'Trebuchet MS', Arial, sans-serif;font-size:13px"), 'Fonts with spaces must render safely: ' + trebuchet);
const times = renderEmailHtml('Hello', "<font face='Times New Roman' size='3'>Hello</font>");
assert(times.includes("font-family:'Times New Roman', Times, serif;font-size:16px"), 'Single-quoted font attributes must be preserved safely: ' + times);
const styled = renderEmailHtml('Coach', '<span style="font-family:Verdana;font-size:16px;color:red;background-image:url(javascript:alert(1))">Coach</span>');
assert(styled.includes('font-family:Verdana, sans-serif;font-size:16px'), 'Allowlisted CSS font formatting must survive');
assert(!styled.includes('background-image') && !styled.includes('color:red') && !styled.includes('javascript:'), 'Unapproved CSS must be stripped');
const unsupported = renderEmailHtml('Coach', '<font face="Comic Sans MS" size="7">Coach</font>');
assert(!unsupported.includes('Comic Sans') && !unsupported.includes('font-size:'), 'Unsupported fonts and sizes must be stripped');
const dangerous = renderEmailHtml('Coach', '<font face="Georgia" onclick="alert(1)">Coach</font><a href="javascript:alert(1)">bad</a>');
assert(!dangerous.includes('onclick') && !dangerous.includes('javascript:'), 'Unsafe attributes and links must be stripped');
console.log('Email font controls, draft restoration, Gmail rendering, and style allowlist smoke tests passed.');
