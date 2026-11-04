import { cookies } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { all, one, run, uid, config } from './store';
import { expect, Problem, type Row } from './domain';
import { nativeSession } from './native-auth';
export async function identity():Promise<Row|null> {
  const native=await nativeSession();if(native)return native;
  const workspace=(await cookies()).get('rf_site')?.value==='1'?await getChatGPTUser():null;
  let id=workspace?`site:${workspace.userId}`:'';let email=workspace?.email??'';
  const cfg=config();
  if(!id&&cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY) {
    const token=(await cookies()).get('rf_access')?.value;
    if(token) {
      const res=await fetch(`${cfg.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}});
      if(res.ok) {const u=await res.json() as {id:string,email:string,email_confirmed_at?:string,is_anonymous?:boolean};if(u.email_confirmed_at&&!u.is_anonymous){id=`sb:${u.id}`;email=u.email;}}
    }
  }
  if(!id)return null;
  let player=await one('SELECT * FROM players WHERE id=?',[id]);
  if(!player) {
    const role=cfg.ADMIN_EMAIL&&email.toLowerCase()===cfg.ADMIN_EMAIL.toLowerCase()?'admin':'player';
    await run('INSERT OR IGNORE INTO players (id,code,email,name,role,created) VALUES (?,?,?,?,?,?)',[id,`RF-${uid().slice(0,8).toUpperCase()}`,email,'New contender',role,Date.now()]);
    player=await one('SELECT * FROM players WHERE id=?',[id]);
  }
  return player;
}
export async function requirePlayer() {const p=await identity();expect(p,'Sign in to continue.',401);return p;}
export async function requireRole(...roles:string[]) {const p=await requirePlayer();expect(roles.includes(String(p.role)),'You do not have permission for this action.',403);return p;}
export async function rateLimit(key:string,max=30) {
  const minute=Math.floor(Date.now()/60000),k=`${key}:${minute}`;
  await run('INSERT INTO limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',[k,Date.now()+120000]);
  const record=await one('SELECT count FROM limits WHERE key=?',[k]);
  if(Number(record?.count)>max)throw new Problem(429,'Too many requests. Try again in a minute.');
  if(minute%10===0)await run('DELETE FROM limits WHERE expires<?',[Date.now()]);
}
export async function currentTeams(id:string) {return all('SELECT t.*,m.player FROM teams t JOIN members m ON m.team=t.id WHERE m.player=?',[id]);}
