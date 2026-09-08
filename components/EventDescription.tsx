import {ExternalLink} from 'lucide-react';
import {cleanEventText,extractEventUrl,normalizeEventUrl} from '@/lib/event-links';

export default function EventDescription({text,url}:{text?:string|null;url?:string|null}){const clean=cleanEventText(text);const href=normalizeEventUrl(url)||extractEventUrl(text);if(!clean&&!href)return null;return <div className="mt-3">{clean&&<div className="text-sm whitespace-pre-wrap leading-6">{clean}</div>}{href&&<a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 sm:py-1.5 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 mt-3"><ExternalLink size={15}/>Event Info / Registration</a>}</div>}
