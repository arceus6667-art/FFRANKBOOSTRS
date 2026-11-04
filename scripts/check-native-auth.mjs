// Disposable loopback D1 fixtures only. Never accepts a remote base URL.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const web=fileURLToPath(new URL('../web/',import.meta.url)),base='http://127.0.0.1:5173';
mkdirSync(web+'/work',{recursive:true});
writeFileSync(web+'/work/auth-fixture.sql',"DELETE FROM settings WHERE key='admin_bootstrapped'; DELETE FROM credentials WHERE email='qa-admin@example.test';");
execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file','work/auth-fixture.sql'],{cwd:web,stdio:'pipe'});
const password=randomBytes(20).toString('base64url'),nextPassword=randomBytes(20).toString('base64url'),email='qa-admin@example.test';let cookie='',checks=0;
async function post(action,body,status=200,authorization){const response=await fetch(`${base}/api/v1/${action}`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie,...authorization?{Authorization:authorization}:{}},body:JSON.stringify(body)});const b=await response.json();assert.equal(response.status,status,JSON.stringify({action,b}));checks++;return {response,b};}
await post('auth/bootstrap',{email,password},403,'Bearer invalid');
await post('auth/bootstrap',{email,password},200,'Bearer qa-bootstrap-local-only');
await post('auth/bootstrap',{email,password},409,'Bearer qa-bootstrap-local-only');
await post('auth/login',{email,password:'incorrect-password'},401);
const signed=await post('auth/login',{email,password});cookie=signed.response.headers.getSetCookie().find(c=>c.startsWith('rf_session=')).split(';')[0];
assert.ok(signed.response.headers.getSetCookie().find(c=>c.startsWith('rf_session=')).includes('HttpOnly'));checks++;
const me=await fetch(base+'/api/v1/me',{headers:{Cookie:cookie}});assert.equal(me.status,200);const profile=await me.json();assert.equal(profile.user.role,'admin');assert.equal(JSON.stringify(profile).includes(password),false);checks++;
const admin=await fetch(base+'/api/v1/admin',{headers:{Cookie:cookie}});assert.equal(admin.status,200);checks++;
await post('auth/change-password',{currentPassword:'incorrect-current',password:nextPassword},403);
const previous=cookie;const changed=await post('auth/change-password',{currentPassword:password,password:nextPassword});cookie=changed.response.headers.getSetCookie().find(c=>c.startsWith('rf_session=')).split(';')[0];
assert.equal((await fetch(base+'/api/v1/me',{headers:{Cookie:previous}})).status,401);checks++;
await post('auth/logout',{});cookie='';await post('auth/login',{email,password:nextPassword});
console.log(JSON.stringify({checks,status:'PASS',credentialsPrinted:false,productionDataCreated:false}));
