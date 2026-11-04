const encoder=new TextEncoder();
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function digest(value) {const b=await crypto.subtle.digest('SHA-256',encoder.encode(value));return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password,salt,pepper) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password+pepper),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:encoder.encode(salt)},key,256);
  return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');
}
export function equalHash(a,b) {if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
