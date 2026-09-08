'use client';
import {useEffect} from 'react';
import {normalizeEventUrl} from '@/lib/event-links';

export default function EventLinkNormalizer(){useEffect(()=>{const fix=()=>{document.querySelectorAll<HTMLAnchorElement>('a').forEach(a=>{if(!/event info\s*\/\s*registration/i.test(a.textContent||''))return;const raw=a.getAttribute('href');const normalized=normalizeEventUrl(raw);if(normalized&&raw!==normalized)a.setAttribute('href',normalized)})};fix();const observer=new MutationObserver(fix);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);return null}
