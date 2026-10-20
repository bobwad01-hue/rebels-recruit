// Common, broadly supported email-safe font families and sizes.
// These are the only typography values the Gmail renderer is allowed to retain.
export const EMAIL_FONTS = [
  { label: 'Arial', value: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia', css: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana', css: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS', css: "'Trebuchet MS', Arial, sans-serif" },
  { label: 'Times New Roman', value: 'Times New Roman', css: "'Times New Roman', Times, serif" },
] as const;

export const EMAIL_SIZES = [
  { label: 'Small', value: '2', css: '13px' },
  { label: 'Normal', value: '3', css: '16px' },
  { label: 'Large', value: '4', css: '18px' },
] as const;

export function emailFontCss(input: string): string | null {
  const name = input.trim().replace(/["']/g, '').split(',')[0].trim().toLowerCase();
  return EMAIL_FONTS.find(font => font.value.toLowerCase() === name)?.css ?? null;
}

export function emailSizeCss(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  const byName: Record<string, string> = { small: '2', medium: '3', normal: '3', large: '4' };
  const mapped = byName[normalized] ?? normalized;
  return EMAIL_SIZES.find(size => size.value === mapped || size.css === mapped)?.css ?? null;
}

export function safeEmailFontStyle(style: string): string {
  // Discard every CSS property except allowlisted font-family and font-size.
  const family = style.match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i);
  const size = style.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
  const fontCss = family ? emailFontCss(family[1]) : null;
  const sizeCss = size ? emailSizeCss(size[1]) : null;
  return [fontCss ? `font-family:${fontCss}` : '', sizeCss ? `font-size:${sizeCss}` : ''].filter(Boolean).join(';');
}
