// Bold, italic, underline, and list commands must use the user's CURRENT
// selection, never an older selection saved during a previous mouse gesture.
// Only controls that intentionally steal focus (font dropdowns and the link
// popup) may use the most recent editor selection snapshot.
export function chooseEmailEditorRange<T extends { collapsed: boolean }>(
  command: string,
  live: T | null,
  saved: T | null,
): T | null {
  const focusLeavingControl =
    command === 'fontName' || command === 'fontSize' || command === 'createLink';
  return focusLeavingControl ? (live && !live.collapsed ? live : saved || live) : live;
}
