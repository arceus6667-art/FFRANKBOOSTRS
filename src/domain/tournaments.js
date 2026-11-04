// Pure domain guards. Persistence must enforce these again inside transactions.
const catalog = {
  ffmax: { clash_squad: { sizes: [1, 2, 4], formats: ['single', 'knockout'] } },
  bgmi: { battle_royale: { sizes: [1, 2, 4], formats: ['single', 'multi_match'] } },
  codm: Object.fromEntries(
    ['team_deathmatch', 'search_destroy', 'hardpoint', 'control', 'battle_royale'].map(mode =>
      [mode, { sizes: mode === 'battle_royale' ? [4] : [5],
        formats: mode === 'battle_royale' ? ['single', 'multi_match'] : ['single', 'knockout'] }])
  ),
};
const transitions = {
  draft: ['registration_open', 'cancelled'],
  registration_open: ['registration_closed', 'cancelled'],
  registration_closed: ['upcoming', 'cancelled'],
  upcoming: ['live', 'cancelled'],
  live: ['completed', 'cancelled'],
  completed: [], cancelled: [],
};
function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}
function time(value) {
  requireThat(typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value), 'Timestamp needs an explicit timezone');
  const result = Date.parse(value);
  requireThat(Number.isFinite(result), 'Invalid timestamp');
  return result;
}
export function validateTournament(event) {
  requireThat(event && typeof event === 'object', 'Tournament required');
  const mode = catalog[event.game]?.[event.mode];
  requireThat(mode, 'Game mode is disabled or unsupported');
  requireThat(mode.sizes.includes(event.teamSize), 'Unsupported team size');
  requireThat(mode.formats.includes(event.format), 'Unsupported format');
  requireThat(Number.isInteger(event.capacity) && event.capacity >= 2, 'Capacity must be at least two entries');
  requireThat(event.entryFee === 0, 'Only free-entry events are supported');
  requireThat(time(event.registrationOpensAt) < time(event.registrationClosesAt), 'Registration window is invalid');
  requireThat(time(event.registrationClosesAt) <= time(event.checkInDeadline), 'Check-in must follow registration');
  requireThat(time(event.checkInDeadline) <= time(event.startsAt), 'Check-in must end before start');
  requireThat(Object.hasOwn(transitions, event.status), 'Invalid tournament status');
  return true;
}
export function transitionTournament(event, nextStatus) {
  validateTournament(event);
  requireThat(transitions[event.status].includes(nextStatus), 'Invalid status transition');
  return { ...event, status: nextStatus };
}
export function validateRegistration(event, roster, existingPlayerIds, usedEntries, now) {
  validateTournament(event);
  requireThat(event.status === 'registration_open', 'Registration is not open');
  requireThat(time(now) >= time(event.registrationOpensAt) && time(now) < time(event.registrationClosesAt), 'Outside registration window');
  requireThat(Number.isInteger(usedEntries) && usedEntries >= 0 && usedEntries < event.capacity, 'Event is full or capacity usage is invalid');
  requireThat(Array.isArray(roster) && roster.length === event.teamSize, 'Complete roster required');
  const ids = roster.map(player => player?.id);
  requireThat(ids.every(id => typeof id === 'string' && id.trim()) && new Set(ids).size === ids.length, 'Roster identities must be unique');
  requireThat(roster.every(player => player.emailVerified === true && player.eligible === true), 'Verified eligible players required');
  requireThat(!ids.some(id => existingPlayerIds.includes(id)), 'Player already registered');
  return true;
}
export function scoreBattleRoyale(result, rules) {
  requireThat(result?.status === 'verified', 'Only verified results can be scored');
  requireThat(Number.isInteger(result.placement) && result.placement > 0, 'Invalid placement');
  requireThat(Number.isInteger(result.eliminations) && result.eliminations >= 0, 'Invalid eliminations');
  requireThat(Array.isArray(rules?.placementPoints) && rules.placementPoints.length > 0 && rules.placementPoints.every(n => Number.isFinite(n) && n >= 0), 'Invalid placement points');
  requireThat(Number.isFinite(rules.eliminationPoints) && rules.eliminationPoints >= 0, 'Invalid elimination points');
  const score = (rules.placementPoints[result.placement - 1] ?? 0) + result.eliminations * rules.eliminationPoints;
  requireThat(Number.isFinite(score), 'Score overflow');
  return score;
}
