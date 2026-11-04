import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,randomToken,digest,equalHash} from '../web/lib/password.mjs';
test('passwords are salted and peppered and do not appear in stored hashes',async()=>{
  const password=randomToken(),salt=randomToken(),pepper=randomToken();
  const hash=await passwordHash(password,salt,pepper);
  assert.equal(hash.length,64);assert.equal(hash.includes(password),false);
  assert.ok(equalHash(hash,await passwordHash(password,salt,pepper)));
  assert.ok(!equalHash(hash,await passwordHash(password,randomToken(),pepper)));
  assert.ok(!equalHash(hash,await passwordHash(password,salt,randomToken())));
  assert.ok(!equalHash(hash,await passwordHash(password+'x',salt,pepper)));
});
test('session tokens have 256 bits of randomness and only their digest is stored',async()=>{
  const first=randomToken(),second=randomToken();assert.equal(first.length,64);assert.notEqual(first,second);
  assert.notEqual(await digest(first),first);assert.equal((await digest(first)).length,64);
  assert.equal(equalHash('a','aa'),false);assert.equal(equalHash(null,'a'),false);
});
