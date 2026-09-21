import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStoredSessionExpired, PLAYER_SESSION_MS, type StoredIdentity } from '../app/teams.ts';

const player = (loggedInAt?: number): StoredIdentity => ({
  name: 'Test Player',
  teamId: '10',
  group: 'Group B',
  ...(loggedInAt === undefined ? {} : { loggedInAt }),
});

test('PLAYER_SESSION_MS is 5 minutes', () => {
  assert.equal(PLAYER_SESSION_MS, 5 * 60 * 1000);
});

test('legacy rows without loggedInAt are treated as expired', () => {
  assert.equal(isStoredSessionExpired(player()), true);
});

test('fresh login is not expired', () => {
  assert.equal(isStoredSessionExpired(player(Date.now())), false);
});

test('login 4 minutes ago is not expired', () => {
  assert.equal(isStoredSessionExpired(player(Date.now() - 4 * 60 * 1000)), false);
});

test('login 6 minutes ago is expired', () => {
  assert.equal(isStoredSessionExpired(player(Date.now() - 6 * 60 * 1000)), true);
});

test('exactly at the boundary is not expired; 1ms past is', () => {
  const now = Date.now();
  assert.equal(isStoredSessionExpired(player(now - PLAYER_SESSION_MS)), false);
  assert.equal(isStoredSessionExpired(player(now - PLAYER_SESSION_MS - 1)), true);
});
