import { emailFontCss, emailSizeCss, safeEmailFontStyle } from './email-fonts';

// Keep the message's visible line breaks when turning the rich-text editor into email HTML.
// In particular, contentEditable may mix literal newlines with <div>/<br> markup.
function escapeHtml(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function hasIntentionalFormatting(value:string){return /<(?:strong|b|em|i|u|a|ul|ol|li|font|span)\b/i.test(value)}

function attribute(attrs: string, name: string): string {
  const match = attrs.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\\'([^\\']*)\\'|([^\\s>]+))', 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function normalizeFontTags(value: string): string {
  return value.replace(/<font\b([^>]*)>/gi, (_, attrs: string) => {
    const family = emailFontCss(attribute(attrs, 'face'));
    const size = emailSizeCss(attribute(attrs, 'size'));
    const styles = [family ? `font-family:${family}` : '', size ? `font-size:${size}` : ''].filter(Boolean).join(';');
    return styles ? `<span style="${styles}">` : '<span>';
  }).replace(/<\/font\s*>/gi, '</span>');
}
function sanitizeHtml(value:string){
  let x=normalizeFontTags(value);
  x=x.replace(/<\/?(?:script|style|iframe|object|embed|form|input|button|meta|link)[^>]*>/gi,'');
  // Preserve only known-safe typography in spans; no arbitrary CSS or attributes.
  x=x.replace(/<span\b([^>]*)>/gi, (_tag, attrs: string) => {
    const safeStyle = safeEmailFontStyle(attribute(attrs, 'style'));
    return safeStyle ? `<span style="${safeStyle}">` : '<span>';
  });
  // Remove all other inline styles, including pasted CSS.
  x=x.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (tag: string, name: string) =>
    name.toLowerCase()==='span' ? tag : tag.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'')
  );
  x=x.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
  x=x.replace(/href\s*=\s*(["'])\s*(?:javascript|data):[^"']*\1/gi,'href="#"');
  return x;
}
function linkifyText(value:string){
  return value.replace(/(https?:\/\/[^\s<>]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,(match)=>{
    const decoded=match.replace(/&amp;/g,'&');
    const href=/^https?:\/\//i.test(decoded)?decoded:'mailto:'+decoded;
    return '<a href="'+escapeHtml(href)+'">'+match+'</a>';
  });
}
function textToHtml(body:string){
  return body.replace(/\r\n?/g,'\n').split('\n').map(line=>{
    const linked=linkifyText(escapeHtml(line));
    return / Profile Summary$/.test(line.trim())?'<strong>'+linked+'</strong>':linked||'&nbsp;';
  }).join('<br>');
}
function editorToHtml(value:string){
  let x=sanitizeHtml(value);
  // Never collapse consecutive <br> tags: each one is intentional vertical spacing.
  x=x.replace(/<div(?:\s[^>]*)?>\s*<br\s*\/?>(?:\s|&nbsp;)*<\/div>/gi,'<br>');
  x=x.replace(/<div(?:\s[^>]*)?>/gi,'<br>').replace(/<\/div>/gi,'');
  x=x.replace(/<p(?:\s[^>]*)?>/gi,'').replace(/<\/p>/gi,'<br><br>');
  let insideAnchor=false;
  return x.split(/(<[^>]+>)/g).map(part=>{
    if(part.startsWith('<')){
      if(/^<a\b/i.test(part))insideAnchor=true;
      else if(/^<\/a\b/i.test(part))insideAnchor=false;
      return part;
    }
    // Literal newlines otherwise collapse to spaces in Gmail's HTML rendering.
    const withBreaks=part.replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
    return insideAnchor?withBreaks:linkifyText(withBreaks);
  }).join('');
}
export function renderEmailHtml(body:string,editorHtml?:string){
  return editorHtml&&hasIntentionalFormatting(editorHtml)?editorToHtml(editorHtml):textToHtml(body);
}
