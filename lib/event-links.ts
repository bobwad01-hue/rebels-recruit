const DOMAIN_RE=/(?<!@)(?:https?:\/\/|www\.)[^\s<>"']+|(?<!@)\b(?:bit\.ly|tinyurl\.com|t\.co|forms\.gle|docs\.google\.com|[a-z0-9-]+\.(?:com|org|net|edu|io|co|us|ly|me|app|site|link|gg|tv))(?:\/[^\s<>"']*)?/ig;

function trimPunctuation(value:string){return value.replace(/[),.;!?]+$/,'')}

export function normalizeEventUrl(value?:string|null){const raw=trimPunctuation(String(value||'').trim());if(!raw)return null;return /^https?:\/\//i.test(raw)?raw:`https://${raw.replace(/^\/\//,'')}`}

export function extractEventUrl(...values:(string|null|undefined)[]){for(const value of values){if(!value)continue;DOMAIN_RE.lastIndex=0;const match=DOMAIN_RE.exec(String(value));if(match?.[0])return normalizeEventUrl(match[0])}return null}

export function cleanEventText(value?:string|null){if(!value)return '';DOMAIN_RE.lastIndex=0;let text=String(value).replace(DOMAIN_RE,'');text=text.split('\n').map(line=>line.replace(/\s{2,}/g,' ').replace(/^\s*(?:registration|register|event info|info|website|link)\s*[:\-]?\s*$/i,'').trimEnd()).filter(line=>line.trim()).join('\n');return text.replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim()}

export function eventInfoUrl(event:any){return extractEventUrl(event?.registration_url,event?.infoUrl,event?.description,event?.url_text)}
