'use client';

import {useEffect} from 'react';

const INTERACTIVE='a,button,input,select,textarea,summary,[role="button"],[contenteditable="true"]';
const SURFACE='.card,[data-navigable]';
const MUTATION_WORDS=/\b(add|save|send|delete|remove|edit|update|complete|mark|log|upload|import|connect|disconnect|assign|archive|stop pursuing|pass|going|not going|create|invite|approve|reject|suspend|pause)\b/i;

function currentPreview(){
  if(typeof window==='undefined')return null;
  const p=new URLSearchParams(window.location.search),role=p.get('previewRole'),athlete=p.get('previewAthlete');
  return role?{role,athlete}:null;
}
function preservePreview(href:string){
  const preview=currentPreview();
  if(!preview||!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('sms:'))return href;
  try{
    const u=new URL(href,window.location.origin);
    if(u.origin!==window.location.origin)return href;
    u.searchParams.set('previewRole',preview.role);
    if(preview.athlete)u.searchParams.set('previewAthlete',preview.athlete);
    return `${u.pathname}${u.search}${u.hash}`;
  }catch{return href}
}
function destination(surface:Element){
  const links=Array.from(surface.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a=>!a.hasAttribute('data-secondary-link'));
  const hrefs=[...new Set(links.map(a=>a.href).filter(Boolean))];
  if(hrefs.length!==1)return null;
  return links.find(a=>a.href===hrefs[0])||null;
}
function decorate(root:ParentNode=document){
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a=>{
    const next=preservePreview(a.getAttribute('href')||'');
    if(next&&next!==a.getAttribute('href'))a.setAttribute('href',next);
  });
  root.querySelectorAll<HTMLElement>(SURFACE).forEach(surface=>{
    if(surface.matches('a,button')||surface.hasAttribute('data-no-auto-navigate'))return;
    const link=destination(surface);
    if(!link)return;
    surface.dataset.autoNavigable='true';
    surface.classList.add('cursor-pointer');
    if(!surface.hasAttribute('tabindex'))surface.tabIndex=0;
    if(!surface.hasAttribute('role'))surface.setAttribute('role','link');
    if(!surface.hasAttribute('aria-label')){
      const label=(surface.querySelector('h1,h2,h3,h4,[data-card-title]')?.textContent||link.textContent||'Open details').trim();
      if(label)surface.setAttribute('aria-label',label);
    }
  });
}
function isPreviewMutation(target:HTMLElement){
  if(!currentPreview())return false;
  const control=target.closest<HTMLElement>('button,input[type="submit"],input[type="button"],[role="button"]');
  if(!control||control.hasAttribute('data-preview-allowed'))return false;
  if(control.closest('[data-preview-controls]'))return false;
  const text=(control.getAttribute('aria-label')||control.textContent||'').trim();
  return MUTATION_WORDS.test(text);
}
export default function NavigationEnhancer(){
  useEffect(()=>{
    decorate();
    const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof HTMLElement)decorate(n.matches(SURFACE)?n.parentElement||document:n)})));
    observer.observe(document.body,{childList:true,subtree:true});
    const click=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target)return;
      if(isPreviewMutation(target)){
        event.preventDefault();event.stopPropagation();
        window.dispatchEvent(new CustomEvent('rr-preview-blocked'));
        return;
      }
      if(target.closest(INTERACTIVE))return;
      const surface=target.closest<HTMLElement>(SURFACE);
      if(!surface||surface.dataset.autoNavigable!=='true')return;
      const link=destination(surface);if(link)link.click();
    };
    const submit=(event:SubmitEvent)=>{if(currentPreview()){event.preventDefault();window.dispatchEvent(new CustomEvent('rr-preview-blocked'))}};
    const keydown=(event:KeyboardEvent)=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const target=event.target as HTMLElement|null;
      if(!target||!target.matches(SURFACE)||target.dataset.autoNavigable!=='true')return;
      const link=destination(target);if(link){event.preventDefault();link.click()}
    };
    document.addEventListener('click',click,true);document.addEventListener('submit',submit,true);document.addEventListener('keydown',keydown);
    return()=>{observer.disconnect();document.removeEventListener('click',click,true);document.removeEventListener('submit',submit,true);document.removeEventListener('keydown',keydown)};
  },[]);
  return null;
}
