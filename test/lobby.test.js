import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyRelease,lobbyAvailable,LOBBY_LEAD_MS} from '../web/lib/competition.mjs';
const starts=Date.parse('2026-12-01T13:00:00+05:30');
const match={starts,status:'upcoming',release:0},event={status:'registration_open',deleted:0};
test('room credentials unlock at exactly T minus 15 minutes, never earlier',()=>{
  assert.equal(LOBBY_LEAD_MS,900000);
  assert.equal(lobbyRelease(starts),starts-900000);
  assert.equal(lobbyAvailable(match,event,starts-900001),false);
  assert.equal(lobbyAvailable(match,event,starts-900000),true);
  assert.equal(lobbyAvailable(match,event,starts),true);
  assert.equal(lobbyAvailable(match,event,starts+21600000),false);
});
test('cancelled, completed, draft and deleted events never reveal rooms',()=>{
  for(const status of ['cancelled','completed','draft'])assert.equal(lobbyAvailable(match,{...event,status},starts),false);
  for(const status of ['cancelled','completed'])assert.equal(lobbyAvailable({...match,status},event,starts),false);
  assert.equal(lobbyAvailable(match,{...event,deleted:1},starts),false);
});
