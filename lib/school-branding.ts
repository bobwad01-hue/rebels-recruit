export function schoolAbbreviation(name:string){
 const raw=String(name||'School').trim();
 const words=raw.split(/\s+/).map(w=>w.replace(/[^A-Za-z0-9–—-]/g,'')).filter(Boolean);
 const out=words.map(word=>word.split(/([–—-])/).map(part=>{
  if(part==='-'||part==='–'||part==='—')return '-';
  return /^[A-Z0-9]/.test(part)?part[0].toUpperCase():'';
 }).join('')).join('').replace(/-+/g,'-').replace(/^-|-$/g,'');
 return out||raw.charAt(0).toUpperCase()||'?';
}
export function faviconForWebsite(website?:string|null,size=128){
 if(!website)return '';
 try{const host=new URL(/^https?:\/\//i.test(website)?website:'https://'+website).hostname;return 'https://www.google.com/s2/favicons?domain='+encodeURIComponent(host)+'&sz='+size}catch{return ''}
}
