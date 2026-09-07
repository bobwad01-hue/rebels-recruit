import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'crypto';

function key(){
  const secret=process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if(!secret)throw new Error('Google token encryption key is not configured.');
  return createHash('sha256').update(secret).digest();
}

export function encryptGoogleToken(value:string){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return {ciphertext:encrypted.toString('base64url'),iv:iv.toString('base64url'),tag:tag.toString('base64url')};
}

export function decryptGoogleToken(ciphertext:string,iv:string,tag:string){
  const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64url')),decipher.final()]).toString('utf8');
}
