'use client';

import { useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { emailLinkParts, formatRecruitingEmail } from '@/lib/recruiting-email-display';
import type { EmailAttachmentMetadata } from '@/lib/recruiting-email-display';

function ReadableText({ value }: { value: string }) {
  const parts = useMemo(() => emailLinkParts(value), [value]);
  return <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
    {parts.map((part, index) => part.href
      ? <a key={index} href={part.href} target={part.href.startsWith('mailto:') ? undefined : '_blank'} rel={part.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'} className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900" title={part.href}>{part.text}</a>
      : <span key={index}>{part.text}</span>)}
  </div>;
}

function humanSize(size: number | null) {
  if (size === null) return '';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function RecruitingEmailReader({
  body, summary, attachments, attachmentMetadataChecked,
}: {
  body: string | null;
  summary: string | null;
  attachments?: EmailAttachmentMetadata[];
  attachmentMetadataChecked?: boolean;
}) {
  const [showSaved, setShowSaved] = useState(false);
  const formatted = useMemo(() => formatRecruitingEmail(body || ''), [body]);
  const files = (attachments || []).filter(file => !file.inline);
  const inline = (attachments || []).filter(file => file.inline);
  const mentioned = formatted.attachmentMentioned;
  const hasAttachmentNotice = files.length > 0 || inline.length > 0 || mentioned;

  return <div className="mt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-500">{body ? 'Email message' : 'Recorded summary'}</h4>
      {body && <button type="button" onClick={() => setShowSaved(value => !value)} aria-pressed={showSaved} className="text-xs font-bold text-slate-600 underline-offset-2 hover:text-slate-950 hover:underline">
        {showSaved ? 'Show clean view' : 'View saved text'}
      </button>}
    </div>
    {body ? <div className="mt-2 max-h-[460px] overflow-auto rounded-xl border bg-slate-50 p-4">
      {showSaved ? <>
        <p className="mb-3 text-xs text-slate-500">Text as stored by RLTNL. This is not the original Gmail HTML or MIME message.</p>
        <div className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-700">{body}</div>
      </> : <>
        <ReadableText value={formatted.message} />
        {formatted.signature && <details className="mt-5 border-t border-slate-200 pt-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900">Show email signature</summary>
          <div className="mt-3 rounded-lg bg-white p-3"><ReadableText value={formatted.signature} /></div>
        </details>}
      </>}
    </div> : <div className="mt-2 rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      {summary || 'No message text was recorded for this email.'}
      <p className="mt-3 text-xs text-slate-500">The full email body was not saved. This is a summary, not the original email.</p>
    </div>}

    {hasAttachmentNotice && <section aria-label="Email attachment information" className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-black text-slate-800"><Paperclip size={15} /> Attachments and inline images</div>
      {files.length > 0 && <div className="mt-3 space-y-2">
        {files.map((file, index) => <div key={index} className="flex min-w-0 items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <FileText size={16} className="mt-0.5 shrink-0 text-slate-500" />
          <div className="min-w-0"><p className="break-all text-sm font-semibold text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{[file.mimeType, humanSize(file.size)].filter(Boolean).join(' · ') || 'File metadata'}</p></div>
        </div>)}
      </div>}
      {inline.length > 0 && <p className="mt-3 flex items-center gap-2 text-xs text-slate-600"><ImageIcon size={14} /> {inline.length} inline image{inline.length === 1 ? '' : 's'} in the email (may include signature graphics)</p>}
      {files.length > 0 || inline.length > 0
        ? <p className="mt-3 text-xs leading-5 text-slate-600">These file details were provided by Gmail. RLTNL does not store or provide downloads of these files. The athlete can open the original email in their Gmail account.</p>
        : attachmentMetadataChecked
          ? <p className="mt-2 text-xs leading-5 text-slate-600">The email mentions an attachment, but Gmail did not identify a separate file in the saved metadata. It may be an inline image or a link. Ask the athlete to check the original email.</p>
          : <p className="mt-2 text-xs leading-5 text-slate-600">The email mentions an attachment, but RLTNL has not verified its file details. The athlete can check the original email in Gmail. File metadata may appear after their next Gmail sync.</p>}
    </section>}
  </div>;
}
