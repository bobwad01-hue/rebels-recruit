export function cleanDisplayNote(note:string|null|undefined){
  if(!note)return '';
  return note
    .replace(/\s*\[Historical import key:[^\]]+\]/gi,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}
