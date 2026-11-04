// Integration fixtures are restricted to loopback and --local D1.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomToken,passwordHash} from '../web/lib/password.mjs';
const web=fileURLToPath(new URL('../web/',import.meta.url)),base='http://127.0.0.1:5173';
const vars=Object.fromEntries(readFileSync(web+'/.dev.vars','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const password=randomToken(),now=Date.now();let checks=0;
function fixture(sql){mkdirSync(web+'/work',{recursive:true});writeFileSync(web+'/work/editor-fixture.sql',sql);execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file','work/editor-fixture.sql'],{cwd:web,stdio:'pipe'});}
const sql=[];
for(const [id,role] of [['qa-editor-admin','admin'],['qa-first-player','player'],['qa-outsider','player']]){
  const salt=randomToken(),hash=await passwordHash(password,salt,vars.AUTH_PEPPER);
  sql.push(`INSERT OR IGNORE INTO players (id,code,email,name,role,created) VALUES ('${id}','RF-${id}','${id}@example.test','QA account','${role}',${now}); UPDATE players SET role='${role}',adult=0,consent='',game='ffmax' WHERE id='${id}'; DELETE FROM identities WHERE player='${id}'; INSERT OR REPLACE INTO credentials (player,email,salt,hash,verified,created) VALUES ('${id}','${id}@example.test','${salt}','${hash}',1,${now});`);
}
fixture(sql.join('\n'));
async function call(path,body,cookie='',expected=200){const response=await fetch(base+'/api/v1/'+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},...body?{body:JSON.stringify(body)}:{}});const data=await response.json();assert.equal(response.status,expected,JSON.stringify({path,data}));checks++;return {data,response};}
async function login(id){const r=await call('auth/login',{email:`${id}@example.test`,password});return {cookie:r.response.headers.getSetCookie().find(s=>s.startsWith('rf_session=')).split(';')[0],redirect:r.data.redirectTo};}
const admin=await login('qa-editor-admin'),player=await login('qa-first-player'),outsider=await login('qa-outsider');
assert.equal(admin.redirect,'/admin/tournaments');assert.equal(player.redirect,'/onboarding');checks+=2;
const blocked=await fetch(base+'/dashboard',{headers:{Cookie:player.cookie},redirect:'manual'});assert.ok([302,303,307,308].includes(blocked.status));assert.ok(blocked.headers.get('location').endsWith('/onboarding'));checks++;
const setup={name:'QA player',region:'QA region',game:'ffmax',inGameName:'QA in-game name',gameUid:'private-qa-uid',adult:true,consent:true};
await call('onboarding',{...setup,gameUid:''},player.cookie,400);
await call('onboarding',setup,player.cookie);
let work=(await call('me',null,player.cookie)).data;assert.equal(work.identities.length,1);assert.equal(work.identities[0].uid,'private-qa-uid');checks++;
await call('onboarding',{...setup,gameUid:'must-not-overwrite'},player.cookie);
work=(await call('me',null,player.cookie)).data;assert.equal(work.identities.length,1);assert.equal(work.identities[0].uid,'private-qa-uid');checks++;
assert.equal((await login('qa-first-player')).redirect,'/dashboard');checks++;
await call('admin/tournaments',{},player.cookie,403);
const event={title:'QA admin-managed event',game:'ffmax',mode:'clash_squad',format:'single',size:1,capacity:8,description:'Local-only event editor test fixture.',opens:now-60000,closes:now+1200000,checkin:now+2700000,starts:now+3600000,publish:true,room:'private-room-123',roomPassword:'private-room-password',instructions:'QA instructions',rules:{text:'Local-only rules for this test fixture.',maps:'Test map',placementPoints:[],winPoints:3}};
const created=(await call('admin/tournaments',event,admin.cookie)).data;assert.ok(created.id&&created.matchId);checks++;
const discovery=(await call('bootstrap',null,player.cookie)).data;assert.ok(discovery.tournaments.some(t=>t.id===created.id));assert.equal(JSON.stringify(discovery).includes(event.room),false);assert.equal(JSON.stringify(discovery).includes(event.roomPassword),false);checks++;
const adminHtml=await (await fetch(base+'/tournaments',{headers:{Cookie:admin.cookie}})).text(),playerHtml=await (await fetch(base+'/tournaments',{headers:{Cookie:player.cookie}})).text();assert.ok(adminHtml.includes('Add Tournament'));assert.equal(playerHtml.includes('Add Tournament'),false);checks++;
await call('tournaments/register',{id:created.id},player.cookie);
await call(`lobby/${created.matchId}`,null,player.cookie,403);
fixture(`UPDATE matches SET release=0 WHERE id='${created.matchId}';`);
await call(`lobby/${created.matchId}`,null,player.cookie,403);
fixture(`UPDATE matches SET starts=${Date.now()+14*60000},release=${Date.now()+86400000} WHERE id='${created.matchId}';`);
const room=(await call(`lobby/${created.matchId}`,null,player.cookie)).data;assert.equal(room.room,event.room);assert.equal(room.password,event.roomPassword);checks++;
await call(`lobby/${created.matchId}`,null,outsider.cookie,403);
await call(`lobby/${created.matchId}`,null,'',401);
await call('admin/edit-details',{id:created.id,title:'QA edited event',description:'Updated local-only event description.'},admin.cookie);
assert.equal((await call('bootstrap',null,player.cookie)).data.tournaments.find(t=>t.id===created.id).title,'QA edited event');checks++;
await call('admin/delete-tournament',{id:created.id,confirm:true},player.cookie,403);
await call('admin/delete-tournament',{id:created.id,confirm:false},admin.cookie,400);
await call('admin/delete-tournament',{id:created.id,confirm:true},admin.cookie);
assert.equal((await call('bootstrap',null,player.cookie)).data.tournaments.some(t=>t.id===created.id),false);checks++;
await call(`lobby/${created.matchId}`,null,player.cookie,403);
assert.equal((await call('me',null,player.cookie)).data.registrations.find(r=>r.tournament===created.id).status,'cancelled');checks++;
console.log(JSON.stringify({checks,status:'PASS',productionDataCreated:false,covered:['admin create/edit/delete','role separation','one-time UID','reused saved UID','15-minute private room release']}));
