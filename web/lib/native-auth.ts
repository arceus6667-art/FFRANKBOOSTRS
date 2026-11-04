import { cookies } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { one, run, statement, db, config, uid, auditStatement } from './store';
import { expect, str } from './domain';
import { randomToken, digest, passwordHash, equalHash } from './password.mjs';

export async function nativeSession() {
  const token=(await cookies()).get('rf_session')?.value;
  if(!token)return null;
  return one('SELECT p.* FROM sessions s JOIN players p ON p.id=s.player JOIN credentials c ON c.player=p.id WHERE s.hash=? AND s.expires>? AND c.verified=1',[await digest(token),Date.now()]);
}
async function startSession(player:string,request:Request) {
  const token=randomToken(),expires=Date.now()+7*86400000;
  await db().batch([statement('DELETE FROM sessions WHERE expires<?',[Date.now()]),statement('INSERT INTO sessions (hash,player,expires,created) VALUES (?,?,?,?)',[await digest(token),player,expires,Date.now()])]);
  const jar=await cookies();jar.delete('rf_site');jar.delete('rf_access');
  jar.set('rf_session',token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:7*86400});
}
export async function nativeAuth(action:string,b:Record<string,unknown>,request:Request) {
  const cfg=config(),jar=await cookies();
  if(action==='auth/logout') {
    const token=jar.get('rf_session')?.value;if(token)await run('DELETE FROM sessions WHERE hash=?',[await digest(token)]);
    jar.delete('rf_session');jar.delete('rf_site');jar.delete('rf_access');return {message:'Signed out.'};
  }
  if(action==='auth/site') {
    const user=await getChatGPTUser();expect(user,'Complete secure sign-in first.',401);jar.set('rf_site','1',{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:7*86400});return {message:'Secure sign-in complete.'};
  }
  if(!['auth/bootstrap','auth/login','auth/register','auth/change-password'].includes(action))return null;
  expect(cfg.AUTH_PEPPER&&cfg.AUTH_PEPPER.length>=32,'Account authentication is temporarily unavailable.',503);
  const pepper=cfg.AUTH_PEPPER;
  if(action==='auth/bootstrap') {
    const expected=cfg.ADMIN_BOOTSTRAP_TOKEN;expect(expected&&equalHash(await digest(request.headers.get('authorization')??''),await digest(`Bearer ${expected}`)),'Access denied.',403);
    expect(!await one("SELECT value FROM settings WHERE key='admin_bootstrapped'"),'Account provisioning is already complete.',409);
  }
  const email=action==='auth/change-password'?'':str(b.email,3,254).toLowerCase();
  if(email)expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email address.');
  expect(typeof b.password==='string'&&b.password.length>=12&&b.password.length<=128,'Use a password between 12 and 128 characters.');
  if(action==='auth/login') {
    const c=await one('SELECT * FROM credentials WHERE email=?',[email]);
    const calculated=await passwordHash(b.password,String(c?.salt??'unknown-account-timing-salt'),pepper);
    expect(c&&equalHash(calculated,String(c.hash))&&c.verified===1,'Unable to sign in. Check your login ID and password.',401);
    await startSession(String(c.player),request);await auditStatement(String(c.player),'account.sign_in',String(c.player)).run();const p=await one('SELECT * FROM players WHERE id=?',[c.player]);const ready=p?.role!=='player'||p.adult&&p.consent&&await one('SELECT id FROM identities WHERE player=? AND game=?',[p.id,p.game]);return {message:'Signed in. Welcome back.',redirectTo:p?.role==='admin'?'/admin/tournaments':ready?'/dashboard':'/onboarding'};
  }
  if(action==='auth/change-password') {
    const p=await nativeSession();expect(p,'Sign in with your account first.',401);
    const c=await one('SELECT * FROM credentials WHERE player=?',[p.id]);
    expect(c&&typeof b.currentPassword==='string'&&equalHash(await passwordHash(b.currentPassword,String(c.salt),pepper),String(c.hash)),'Current password is incorrect.',403);
    const salt=randomToken();await db().batch([statement('UPDATE credentials SET salt=?,hash=? WHERE player=?',[salt,await passwordHash(b.password,salt,pepper),p.id]),statement('DELETE FROM sessions WHERE player=?',[p.id]),auditStatement(String(p.id),'account.password_changed',String(p.id))]);
    await startSession(String(p.id),request);return {message:'Password changed. Other sessions have been signed out.'};
  }
  const siteUser=await getChatGPTUser();
  if(action==='auth/register') {
    expect(b.adult===true&&b.consent===true,'Confirm age eligibility and accept the policies.');
    expect(siteUser&&siteUser.email.toLowerCase()===email,'Verify this email with secure sign-in before creating its password account.',403);
  }
  const player=action==='auth/bootstrap'?`native:${uid()}`:`site:${siteUser!.userId}`;
  const existing=await one('SELECT id FROM players WHERE id=?',[player]);const salt=randomToken();let details:null|{name:string,region:string,game:string,inGameName:string,gameUid:string}=null;if(action==='auth/register'){const game=str(b.game);expect(['ffmax','bgmi','codm'].includes(game),'Choose a supported game.');const saved=await one('SELECT name,uid FROM identities WHERE player=? AND game=?',[player,game]);details={game,name:str(b.name,2,40),region:str(b.region,2,80),inGameName:saved?String(saved.name):str(b.inGameName,1,64),gameUid:saved?String(saved.uid):str(b.gameUid,1,64)};}
  await db().batch([
    ...(!existing?[statement('INSERT INTO players (id,code,email,name,role,created) VALUES (?,?,?,?,?,?)',[player,`RF-${uid().slice(0,8).toUpperCase()}`,email,action==='auth/bootstrap'?'Platform Admin':'New contender',action==='auth/bootstrap'?'admin':'player',Date.now()])]:[]),
    ...(details?[statement("UPDATE players SET name=?,region=?,game=?,adult=1,consent='2026-11-v1' WHERE id=?",[details.name,details.region,details.game,player]),statement('INSERT INTO identities (id,player,game,name,uid) VALUES (?,?,?,?,?) ON CONFLICT(player,game) DO NOTHING',[uid(),player,details.game,details.inGameName,details.gameUid])]:[]),
    statement('INSERT INTO credentials (player,email,salt,hash,verified,created) VALUES (?,?,?,?,1,?)',[player,email,salt,await passwordHash(b.password,salt,pepper),Date.now()]),
    ...(action==='auth/bootstrap'?[statement("INSERT INTO settings (key,value) VALUES ('admin_bootstrapped','complete')")]:[]),
    auditStatement(player,action==='auth/bootstrap'?'account.admin_provisioned':'account.created',player),
  ]);
  if(action==='auth/register')await startSession(player,request);
  return {message:action==='auth/bootstrap'?'Administrator account provisioned.':'Your verified account and saved game identity are ready.',redirectTo:'/dashboard'};
}
