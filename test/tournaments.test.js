import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTournament, transitionTournament, validateRegistration, scoreBattleRoyale } from '../src/domain/tournaments.js';

const event = { game: 'ffmax', mode: 'clash_squad', teamSize: 1, format: 'knockout', capacity: 16, entryFee: 0, status: 'registration_open', registrationOpensAt: '2026-11-10T09:00:00Z', registrationClosesAt: '2026-11-10T12:00:00Z', checkInDeadline: '2026-11-10T12:30:00Z', startsAt: '2026-11-10T13:00:00Z' };
const player = { id: 'player-1', emailVerified: true, eligible: true };
test('accepts configured formats and rejects disabled or incompatible modes', () => {
  assert.equal(validateTournament(event), true);
  for (const patch of [{mode:'battle_royale'}, {teamSize:5}, {entryFee:100}, {format:'multi_match'}, {status:'invented'}, {capacity:1}, {startsAt:'2026-11-10T08:00:00Z'}]) {
    assert.throws(() => validateTournament({...event, ...patch}));
  }
  assert.equal(validateTournament({...event, game:'codm', mode:'hardpoint', teamSize:5}), true);
  assert.equal(validateTournament({...event, game:'bgmi', mode:'battle_royale', teamSize:4, format:'multi_match'}), true);
});
test('lifecycle prevents direct completion and reopening terminal states', () => {
  assert.equal(transitionTournament(event, 'registration_closed').status, 'registration_closed');
  assert.throws(() => transitionTournament(event, 'completed'));
  assert.throws(() => transitionTournament({...event, status:'cancelled'}, 'registration_open'));
});
test('registration checks exact closing boundary, capacity, identity and eligibility', () => {
  const join = (patch = {}, roster = [player], existing = [], used = 0, now = '2026-11-10T09:00:00Z') => validateRegistration({...event,...patch}, roster, existing, used, now);
  assert.equal(join(), true);
  assert.throws(() => join({}, [player], [], 16));
  assert.throws(() => join({}, [player], ['player-1']));
  assert.throws(() => join({}, [{...player,emailVerified:false}]));
  assert.throws(() => join({}, [player], [], 0, event.registrationClosesAt));
  assert.throws(() => join({teamSize:2}, [player,player]));
  assert.throws(() => join({status:'registration_closed'}));
});
test('only verified finite configurable BR scores are published', () => {
  const rules = {placementPoints:[15,12,10], eliminationPoints:2};
  assert.equal(scoreBattleRoyale({status:'verified',placement:2,eliminations:3},rules),18);
  assert.throws(() => scoreBattleRoyale({status:'pending',placement:1,eliminations:4},rules));
  assert.throws(() => scoreBattleRoyale({status:'verified',placement:0,eliminations:4},rules));
  assert.throws(() => scoreBattleRoyale({status:'verified',placement:1,eliminations:4},{...rules,eliminationPoints:Infinity}));
});
