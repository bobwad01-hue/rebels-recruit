/**
 * Read-only, text-only formatting for saved recruiting email messages.
 * Never render email HTML. Keep the saved text untouched so an Advisor can
 * inspect it using "View saved text" if formatting removes an artifact.
 */
export type EmailAttachmentMetadata = {
  name: string;
  mimeType: string;
  size: number | null;
  inline: boolean;
};

export type EmailDisplay = {
  message: string;
  signature: string | null;
  attachmentMentioned: boolean;
  cleaned: boolean;
};

const signatureLine = /^(?:thanks(?: a bunch| so much)?[!,]?|thank you[!,]?|best(?: regards)?[!,]?|kind regards[!,]?|warm regards[!,]?|regards[!,]?|sincerely[!,]?|cheers[!,]?|all the best[!,]?|respectfully[!,]?|sent from my (?:iphone|ipad|android)|--\s*)$/i;

export function formatRecruitingEmail(saved: string): EmailDisplay {
  const original = String(saved || '');
  const attachmentMentioned = /\b(?:attach(?:ed|ment|ments)?|enclos(?:ed|ure)|included (?:a |the )?(?:file|flyer|pdf|document))\b/i.test(original);
  let value = original.replace(/\r\n?/g, '\n')
    .replace(/\[cid:[^\]\n]{1,300}\]/gi, '')
    .replace(/\[image:[^\]\n]{1,300}\]/gi, '');

  // Outlook/plain-text exports often contain "Name<URL>" or
  // "email<mailto:email>". Preserve the useful label and link, not the markup.
  value = value.replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})<mailto:\1>/gi, '$1');
  value = value.replace(/<mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>/gi, '$1');
  value = value.replace(/([^\s<>])<(https?:\/\/[^<>\s]{1,2000})>/gi, '$1 — $2');
  value = value.replace(/<(https?:\/\/[^<>\s]{1,2000})>/gi, '$1');
  value = value.replace(/(https?:\/\/[^\s<>]+)(?:\s+\1)+/gi, '$1');
  value = value.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();

  const lines = value.split('\n');
  let signatureAt = -1;
  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!signatureLine.test(line)) continue;
    if (i < Math.floor(lines.length * 0.25)) continue;
    if (!lines.slice(i + 1).some(part => part.trim())) continue;
    // Prefer a closing after a paragraph boundary, avoiding mid-body text.
    if (i > 0 && lines[i - 1].trim() && i < lines.length - 3) continue;
    signatureAt = i;
    break;
  }

  const message = (signatureAt < 0 ? value : lines.slice(0, signatureAt).join('\n')).trim();
  const signature = signatureAt < 0 ? null : lines.slice(signatureAt).join('\n').trim();
  return {
    message: message || value,
    signature: signature || null,
    attachmentMentioned,
    cleaned: value !== original.trim(),
  };
}

/** Returns safe text/link pieces. Rendering must use normal React text nodes. */
export function emailLinkParts(value: string): { text: string; href: string | null }[] {
  const result: { text: string; href: string | null }[] = [];
  const pattern = /https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  let start = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > start) result.push({ text: value.slice(start, index), href: null });
    const raw = match[0];
    const cleaned = raw.replace(/[),.;!?]+$/, '');
    const tail = raw.slice(cleaned.length);
    let href: string | null = null;
    let display = cleaned;
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      try {
        const url = new URL(cleaned);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          href = url.toString();
          display = cleaned.length > 58 ? url.hostname + (url.pathname !== '/' ? '/…' : '') : cleaned;
        }
      } catch { /* Leave malformed links as text. */ }
    } else if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(cleaned)) {
      href = 'mailto:' + cleaned;
    }
    result.push({ text: display, href });
    if (tail) result.push({ text: tail, href: null });
    start = index + raw.length;
  }
  if (start < value.length) result.push({ text: value.slice(start), href: null });
  return result;
}

export function safeAttachmentMetadata(raw: unknown): {
  checked: boolean;
  attachments: EmailAttachmentMetadata[];
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { checked: false, attachments: [] };
  const data = raw as Record<string, unknown>;
  const checked = data.attachmentMetadataChecked === true;
  const rows = Array.isArray(data.attachments) ? data.attachments.slice(0, 20) : [];
  const attachments = rows.flatMap(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.slice(0, 180).trim() : '';
    if (!name) return [];
    const mimeType = typeof item.mimeType === 'string' ? item.mimeType.slice(0, 100) : '';
    const size = typeof item.size === 'number' && Number.isFinite(item.size) && item.size >= 0 ? Math.round(item.size) : null;
    return [{ name, mimeType, size, inline: item.inline === true }];
  });
  return { checked, attachments };
}
