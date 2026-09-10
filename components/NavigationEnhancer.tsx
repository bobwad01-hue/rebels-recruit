'use client';

import {useEffect} from 'react';

const INTERACTIVE='a,button,input,select,textarea,summary,[role="button"],[contenteditable="true"]';
const SURFACE='.card,[data-navigable]';

function destination(surface:Element){
  const links=Array.from(surface.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(a=>!a.hasAttribute('data-secondary-link'));
  const hrefs=[...new Set(links.map(a=>a.href).filter(Boolean))];
  if(hrefs.length!==1)return null;
  return links.find(a=>a.href===hrefs[0])||null;
}

function decorate(root:ParentNode=document){
  root.querySelectorAll<HTMLElement>(SURFACE).forEach(surface=>{
    if(surface.matches('a,button')||surface.hasAttribute('data-no-auto-navigate'))return;
    const link=destination(surface);
    if(!link)return;
    surface.dataset.autoNavigable='true';
    surface.classList.add('cursor-pointer');
    if(!surface.hasAttribute('tabindex'))surface.tabIndex=0;
    if(!surface.hasAttribute('role'))surface.setAttribute('role','link');
  });
}

export default function NavigationEnhancer(){
  useEffect(()=>{
    decorate();
    const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof HTMLElement){if(n.matches(SURFACE))decorate(n.parentElement||document);else decorate(n)}})));
    observer.observe(document.body,{childList:true,subtree:true});

    const click=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target||target.closest(INTERACTIVE))return;
      const surface=target.closest<HTMLElement>(SURFACE);
      if(!surface||surface.dataset.autoNavigable!=='true')return;
      const link=destination(surface);
      if(link)link.click();
    };
    const keydown=(event:KeyboardEvent)=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const target=event.target as HTMLElement|null;
      if(!target||!target.matches(SURFACE)||target.dataset.autoNavigable!=='true')return;
      const link=destination(target);
      if(link){event.preventDefault();link.click()}
    };
    document.addEventListener('click',click);
    document.addEventListener('keydown',keydown);
    return()=>{observer.disconnect();document.removeEventListener('click',click);document.removeEventListener('keydown',keydown)};
  },[]);
  return null;
}
