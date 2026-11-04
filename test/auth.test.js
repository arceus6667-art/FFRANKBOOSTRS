import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestClient, requireVerifiedUser, requireAdmin } from '../src/server/auth.js';

test('request clients reject missing tokens, unsafe origins and privileged keys', () => {
  const config = { SUPABASE_URL:'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test' };
  for (const token of [undefined,'','Basic abc','Bearer x\r\nInjected: true']) {
    assert.throws(() => createRequestClient(token,config), error => error.status === 401);
  }
  assert.throws(() => createRequestClient('Bearer valid',{...config,SUPABASE_PUBLISHABLE_KEY:'sb_secret_hidden'}));
  assert.throws(() => createRequestClient('Bearer valid',{...config,SUPABASE_URL:'http://remote.example'}));
  assert.throws(() => createRequestClient('Bearer valid',{...config,SUPABASE_URL:'https://user:password@example.com'}));
  assert.ok(createRequestClient('Bearer valid',config));
});

function client(user, role = null, roleError = null) {
  return {
    auth: { getUser: async () => ({ data: {user}, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({data:role ? {role} : null,error:roleError}) }) }) }),
  };
}
const verified = {id:'player-1',email_confirmed_at:'2026-11-05T00:00:00Z'};
test('auth guard rejects missing, anonymous and unverified identities', async () => {
  await assert.rejects(requireVerifiedUser(client(null),'token'), error => error.status === 401);
  await assert.rejects(requireVerifiedUser(client({...verified,is_anonymous:true}),'token'), error => error.status === 401);
  await assert.rejects(requireVerifiedUser(client({id:'player-1'}),'token'), error => error.status === 403);
  assert.deepEqual(await requireVerifiedUser(client(verified),'token'),{id:'player-1'});
});
test('admin guard ignores editable metadata and fails closed when lookup fails', async () => {
  const forged = {...verified,user_metadata:{role:'admin'}};
  await assert.rejects(requireAdmin(client(forged,'player'),'token'), error => error.status === 403);
  await assert.rejects(requireAdmin(client(verified,null),'token'), error => error.status === 403);
  await assert.rejects(requireAdmin(client(verified,'admin',new Error('db unavailable')),'token'), error => error.status === 503);
  assert.deepEqual(await requireAdmin(client(verified,'admin'),'token'),{id:'player-1'});
});
