import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';

test('deployed D1 schema enforces atomic capacity and roster rules', async t => {
  const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(await readFile(new URL('../web/drizzle/0000_safe_hitman.sql',import.meta.url),'utf8'));
  const now=Date.now();
  for(const id of ['captain','second','third','ineligible']) {
    db.prepare("INSERT INTO players (id,code,email,name,adult,consent,created) VALUES (?,?,?,?,?,?,?)").run(id,id,`${id}@example.test`,id,id==='ineligible'?0:1,'2026-11-v1',now);
    db.prepare("INSERT INTO identities VALUES (?,?,?,?,?)").run(`${id}-game`,id,'ffmax',id,`${id}-uid`);
  }
  db.prepare("INSERT INTO tournaments (id,title,game,mode,format,size,capacity,description,rules,status,opens,closes,starts,checkin,organizer,created) VALUES ('event','Test','ffmax','clash_squad','single',1,2,'Test rules','{}','registration_open',?,?,?,?,?,?)").run(now-60000,now+3600000,now+7200000,now+7000000,'captain',now);
  function register(id,player) {
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO registrations (id,tournament,captain,roster,created) VALUES (?,?,?,?,?)').run(id,'event',player,JSON.stringify([player]),now);
      db.prepare('INSERT INTO entrants VALUES (?,?,?,?)').run(`${id}-entrant`,id,'event',player);
      db.exec('COMMIT');
    } catch(e) {db.exec('ROLLBACK');throw e;}
  }
  await t.test('eligibility cannot be bypassed in a direct database insert',()=>assert.throws(()=>register('bad','ineligible'),/player_ineligible/));
  await t.test('one player cannot occupy two roster slots in the same event',()=>{
    register('r1','captain');
    assert.throws(()=>register('duplicate','captain'),/UNIQUE constraint/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM registrations').get().n,1);
  });
  await t.test('capacity is checked inside the insertion transaction',()=>{
    register('r2','second');assert.throws(()=>register('full','third'),/event_full/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM registrations').get().n,2);
  });
  await t.test('roster snapshot cannot gain an unlisted player',()=>{
    assert.throws(()=>db.prepare('INSERT INTO entrants VALUES (?,?,?,?)').run('fake','r1','event','third'),/roster_invalid/);
  });
  await t.test('closed and archived tournaments reject registration',()=>{
    db.exec("UPDATE tournaments SET status='registration_closed'");assert.throws(()=>register('closed','third'),/registration_closed/);
    db.exec("UPDATE tournaments SET status='registration_open',archived=1");assert.throws(()=>register('archived','third'),/registration_closed/);
  });
  await t.test('team captain, membership, compatible game and exact size are enforced',()=>{
    db.exec("UPDATE tournaments SET archived=0,size=2,capacity=10");
    db.prepare('INSERT INTO teams VALUES (?,?,?,?,?)').run('team','Squad','ffmax','captain',now);
    db.prepare('INSERT INTO members VALUES (?,?,?,?)').run('m1','team','captain',now);
    const insert=db.prepare('INSERT INTO registrations (id,tournament,captain,team,roster,created) VALUES (?,?,?,?,?,?)');
    assert.throws(()=>insert.run('wrong-size','event','captain','team','["captain"]',now),/roster_invalid/);
    assert.throws(()=>insert.run('nonmember','event','captain','team','["captain","third"]',now),/roster_invalid/);
    db.prepare('INSERT INTO members VALUES (?,?,?,?)').run('m2','team','third',now);
    insert.run('valid-team','event','captain','team','["captain","third"]',now);
    assert.throws(()=>insert.run('wrong-captain','event','third','team','["captain","third"]',now),/roster_invalid/);
  });
  db.close();
});
