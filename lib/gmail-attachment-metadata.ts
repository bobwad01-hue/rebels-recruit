/**
 * Extracts metadata from Gmail's message.payload MIME tree.
 * Does not fetch, persist, or expose attachment bytes or Gmail attachment IDs.
 */
export type GmailMimePart = {
  mimeType?: string;
  filename?: string;
  headers?: { name?: string; value?: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailMimePart[];
};

export function extractGmailAttachmentMetadata(payload: GmailMimePart | undefined) {
  const attachments: { name: string; mimeType: string; size: number | null; inline: boolean }[] = [];
  function header(part: GmailMimePart, key: string) {
    return part.headers?.find(h => h.name?.toLowerCase() === key.toLowerCase())?.value || '';
  }
  function visit(part: GmailMimePart | undefined) {
    if (!part || attachments.length >= 20) return;
    const mimeType = String(part.mimeType || '').slice(0, 100);
    const filename = String(part.filename || '').trim().slice(0, 180);
    const disposition = header(part, 'Content-Disposition').toLowerCase();
    const inline = /\binline\b/.test(disposition) || !!header(part, 'Content-ID');
    const hasFile = !!filename || !!part.body?.attachmentId || /\battachment\b/.test(disposition);
    if (hasFile && !/^multipart\//i.test(mimeType) && !/^text\/(?:plain|html)$/i.test(mimeType)) {
      attachments.push({
        name: filename || (inline ? 'Inline image' : 'Unnamed attachment'),
        mimeType,
        size: typeof part.body?.size === 'number' && Number.isFinite(part.body.size) ? part.body.size : null,
        inline,
      });
    }
    for (const child of part.parts || []) visit(child);
  }
  visit(payload);
  return { attachmentMetadataChecked: !!payload, attachments };
}
