'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {Bold,Italic,Underline,Link as LinkIcon,List,ListOrdered,Paperclip,X} from 'lucide-react';
import { EMAIL_FONTS, EMAIL_SIZES, emailFontCss, emailSizeCss, safeEmailFontStyle } from '@/lib/email-fonts';
import { chooseEmailEditorRange } from '@/lib/email-editor-selection';
export type EmailAttachment={name:string;type:string;data:string;size:number};
type Props={value:string;html?:string;onChange:(plain:string,html:string)=>void;attachments:EmailAttachment[];onAttachmentsChange:(files:EmailAttachment[])=>void;disabled?:boolean};
export type RichEmailEditorHandle={insertVideo:(video:{title:string;url:string})=>void};
function plainFrom(el:HTMLElement){return (el.innerText||'').replace(/\u00a0/g,' ').replace(/\r\n?/g,'\n')}
// Drafts are stored in the browser. Sanitize before putting any stored HTML
// back into a contentEditable element; pasted rich HTML is sanitized before insertion.
const EDITOR_TAGS=new Set(['b','strong','i','em','u','a','ul','ol','li','br','div','p','span','font']);
const DROP_TAGS=new Set(['script','style','iframe','object','embed','form','input','button','svg','math','img','video','audio']);
function safeDraftHtml(html:string):string {
  const parsed=new DOMParser().parseFromString(html,'text/html');
  const output=document.createElement('div');
  function clean(node:Node):Node|null {
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent||'');
    if(node.nodeType!==Node.ELEMENT_NODE)return null;
    const source=node as HTMLElement,tag=source.tagName.toLowerCase();
    if(DROP_TAGS.has(tag))return null;
    const el=document.createElement(EDITOR_TAGS.has(tag)?tag:'span');
    if(tag==='a'){
      const href=source.getAttribute('href')||'';
      if(/^(https?:\/\/|mailto:)/i.test(href))el.setAttribute('href',href);
    }else if(tag==='font'){
      const family=source.getAttribute('face')||'',size=source.getAttribute('size')||'';
      if(emailFontCss(family)){
        const found=EMAIL_FONTS.find(f=>f.css===emailFontCss(family));
        if(found)el.setAttribute('face',found.value);
      }
      if(emailSizeCss(size)){
        const found=EMAIL_SIZES.find(s=>s.css===emailSizeCss(size));
        if(found)el.setAttribute('size',found.value);
      }
    }else if(tag==='span'){
      const style=safeEmailFontStyle(source.getAttribute('style')||'');
      if(style)el.setAttribute('style',style);
    }
    for(const child of Array.from(source.childNodes)){
      const next=clean(child);
      if(next)el.appendChild(next);
    }
    return el;
  }
  for(const child of Array.from(parsed.body.childNodes)){
    const next=clean(child);
    if(next)output.appendChild(next);
  }
  return output.innerHTML;
}
// The live browser selection is authoritative for toolbar buttons. A saved Range can
// become stale when the user makes a new selection and releases the mouse outside
// the editor. Restoring that stale range would format unrelated paragraphs.
function rangeIsInEditor(editor: HTMLElement, range: Range | null): range is Range {
  return !!range && editor.contains(range.startContainer) && editor.contains(range.endContainer);
}
function currentEditorRange(editor: HTMLElement): Range | null {
  const selection=window.getSelection();
  if(!selection?.rangeCount)return null;
  const range=selection.getRangeAt(0);
  return rangeIsInEditor(editor,range)?range.cloneRange():null;
}
const RichEmailEditor=forwardRef<RichEmailEditorHandle,Props>(function RichEmailEditor({value,html='',onChange,attachments,onAttachmentsChange,disabled},forwardedRef){const ref=useRef<HTMLDivElement>(null),fileRef=useRef<HTMLInputElement>(null),lastValue=useRef(''),lastHtml=useRef(''),savedRange=useRef<Range|null>(null);const [linkOpen,setLinkOpen]=useState(false),[linkUrl,setLinkUrl]=useState(''),[selectedFont,setSelectedFont]=useState('Arial'),[selectedSize,setSelectedSize]=useState('3');
 useEffect(()=>{
   const editor=ref.current;
   if(!editor||(value===lastValue.current&&html===lastHtml.current))return;
   if(html.trim())editor.innerHTML=safeDraftHtml(html);
   else editor.innerText=value;
   lastValue.current=value;
   lastHtml.current=html;
 },[value,html]);
 function emit(){if(!ref.current)return;const plain=plainFrom(ref.current);const markup=ref.current.innerHTML;lastValue.current=plain;lastHtml.current=markup;onChange(plain,markup)}
 function rememberSelection(){const editor=ref.current;if(!editor)return;savedRange.current=currentEditorRange(editor)}
 // Insert the chosen video at the saved cursor, even after the picker steals focus.
 function insertVideoAtCaret(video:{title:string;url:string}){
  const editor=ref.current;
  if(!editor||disabled||!/^https?:\/\//i.test(video.url))return;
  const range=currentEditorRange(editor)||(rangeIsInEditor(editor,savedRange.current)?savedRange.current.cloneRange():null)||document.createRange();
  if(!rangeIsInEditor(editor,range)){range.selectNodeContents(editor);range.collapse(false)}
  range.deleteContents();
  const fragment=document.createDocumentFragment();
  fragment.appendChild(document.createTextNode('\n'+video.title+': '));
  const link=document.createElement('a');link.href=video.url;link.textContent=video.url;fragment.appendChild(link);
  const after=document.createTextNode('\n');fragment.appendChild(after);
  range.insertNode(fragment);range.setStartAfter(after);range.collapse(true);
  editor.focus();
  const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);
  savedRange.current=range.cloneRange();emit();
 }
 useImperativeHandle(forwardedRef,()=>({insertVideo:insertVideoAtCaret}));
 function command(cmd:string,value?:string){
   const editor=ref.current;
   if(!editor)return;
   // Buttons keep focus with preventDefault on mousedown, so read the CURRENT
   // selection instead of blindly restoring an older selection snapshot.
   const live=currentEditorRange(editor);
   const saved=rangeIsInEditor(editor,savedRange.current)?savedRange.current.cloneRange():null;
   // Dropdowns and the link popup can move focus away from the editor; only
   // those actions are allowed to fall back to the last captured selection.
   const target=chooseEmailEditorRange(cmd,live,saved);
   editor.focus();
   const selection=window.getSelection();
   if(target){
     selection?.removeAllRanges();
     selection?.addRange(target);
   }else{
     // No current selection: place the caret at the end. Never select the
     // entire message or apply a stale multi-paragraph selection.
     const range=document.createRange();
     range.selectNodeContents(editor);
     range.collapse(false);
     selection?.removeAllRanges();
     selection?.addRange(range);
   }
   // Font commands should create standard <font> markup, not arbitrary CSS.
   if(cmd==='fontName'||cmd==='fontSize')document.execCommand('styleWithCSS',false,'false');
   document.execCommand(cmd,false,value);
   rememberSelection();
   emit();
 }
 function openLink(){rememberSelection();setLinkOpen(v=>!v)}
 function addLink(){let url=linkUrl.trim();if(!url)return;if(!/^https?:\/\//i.test(url)&&!/^mailto:/i.test(url))url='https://'+url;command('createLink',url);setLinkUrl('');setLinkOpen(false)}
 async function addFiles(list:FileList|null){if(!list)return;const next=[...attachments];let total=next.reduce((n,a)=>n+a.size,0);for(const file of Array.from(list)){if(next.length>=5){alert('You can attach up to 5 files.');break}if(file.size>2_500_000){alert(`${file.name} is too large. Keep each attachment under 2.5 MB.`);continue}if(total+file.size>3_000_000){alert('Keep the combined attachment size under 3 MB.');break}const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error);r.readAsDataURL(file)});next.push({name:file.name,type:file.type||'application/octet-stream',data,size:file.size});total+=file.size}onAttachmentsChange(next);if(fileRef.current)fileRef.current.value=''}
 const tool='h-11 min-w-11 sm:h-9 sm:min-w-9 px-2 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-40';
 return <div className="mt-1 rounded-xl border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-red-100 focus-within:border-red-300"><div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 p-2">
 <select aria-label="Font family" title="Font family" disabled={disabled} className="h-11 sm:h-9 min-w-[120px] max-w-[160px] rounded-lg border bg-white px-2 text-sm font-semibold disabled:opacity-40" value={selectedFont} onMouseDown={rememberSelection} onTouchStart={rememberSelection} onChange={e=>{const font=e.target.value;command('fontName',font);setSelectedFont(font)}}>
  {EMAIL_FONTS.map(font=><option key={font.value} value={font.value}>{font.label}</option>)}
 </select>
 <select aria-label="Text size" title="Text size" disabled={disabled} className="h-11 sm:h-9 min-w-[94px] rounded-lg border bg-white px-2 text-sm font-semibold disabled:opacity-40" value={selectedSize} onMouseDown={rememberSelection} onTouchStart={rememberSelection} onChange={e=>{const size=e.target.value;command('fontSize',size);setSelectedSize(size)}}>
  {EMAIL_SIZES.map(size=><option key={size.value} value={size.value}>{size.label}</option>)}
 </select>
 <span className="mx-1 h-6 border-l"/>
 <button type="button" className={tool} title="Bold" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('bold')}><Bold size={16}/></button><button type="button" className={tool} title="Italic" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('italic')}><Italic size={16}/></button><button type="button" className={tool} title="Underline" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('underline')}><Underline size={16}/></button><span className="mx-1 h-6 border-l"/><button type="button" className={tool} title="Insert link" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={openLink}><LinkIcon size={16}/></button><button type="button" className={tool} title="Bulleted list" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertUnorderedList')}><List size={17}/></button><button type="button" className={tool} title="Numbered list" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertOrderedList')}><ListOrdered size={17}/></button><span className="mx-1 h-6 border-l"/><button type="button" className={tool+' gap-1.5 text-xs font-bold'} disabled={disabled} onClick={()=>fileRef.current?.click()}><Paperclip size={16}/> Attach</button><input ref={fileRef} type="file" multiple className="hidden" onChange={e=>addFiles(e.target.files)}/></div>{linkOpen&&<div className="flex flex-col sm:flex-row gap-2 border-b bg-white p-2"><input className="input py-1.5 text-sm" autoFocus placeholder="Paste a URL" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addLink()}}}/><button type="button" className="btn btn-red py-1.5 text-xs" onClick={addLink}>Add link</button><button type="button" className="btn py-1.5 text-xs" onClick={()=>setLinkOpen(false)}>Cancel</button></div>}<div ref={ref} aria-label="Email message" contentEditable={!disabled} suppressContentEditableWarning onInput={()=>{rememberSelection();emit()}} onPaste={e=>{e.preventDefault();const pastedHtml=e.clipboardData.getData("text/html");const pastedText=e.clipboardData.getData("text/plain");if(pastedHtml){const cleaned=safeDraftHtml(pastedHtml);if(cleaned.trim()){document.execCommand("insertHTML",false,cleaned);emit();return}}document.execCommand("insertText",false,pastedText);emit()}} onDrop={e=>{e.preventDefault();document.execCommand("insertText",false,e.dataTransfer.getData("text/plain"));emit()}} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={()=>{emit()}} className="min-h-[240px] sm:min-h-[260px] lg:min-h-[300px] p-3 text-[16px] leading-6 outline-none whitespace-pre-wrap break-words [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-7 [&_ol]:pl-7 [&_li]:list-item [&_li]:my-0.5" style={{fontFamily:"Arial, Helvetica, sans-serif"}} data-placeholder="Write your email…"/>{attachments.length>0&&<div className="border-t bg-slate-50 p-3"><div className="text-xs font-black uppercase text-slate-500 mb-2">Attachments</div><div className="flex flex-wrap gap-2">{attachments.map((a,i)=><div key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs"><Paperclip size={13}/><span className="font-semibold max-w-[220px] truncate">{a.name}</span><span className="text-slate-500">{(a.size/1024/1024).toFixed(1)} MB</span><button type="button" title="Remove attachment" onClick={()=>onAttachmentsChange(attachments.filter((_,x)=>x!==i))}><X size={13}/></button></div>)}</div></div>}</div>});
export default RichEmailEditor;
