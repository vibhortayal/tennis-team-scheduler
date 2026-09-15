import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminConfigured, verifyAdminPassword, isAdminSession } from '../app/lib/admin.ts';
import { adminIdentity, identityValue } from '../app/teams.ts';
import { defaultTeamForGroupTab } from '../app/lib/teamScope.ts';
import { canUpdateMatch } from '../app/lib/matches.ts';
import type { Match } from '../app/lib/matches.ts';

const TEST_HASH = 'c638833f69bbfb3c267afa0a74434812436b8f08a81fd263c6be6871de4f1265'; // sha256('test-password')

test('isAdminConfigured is false when the env var is missing', () => {
  const saved = process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256;
  delete process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256;
  assert.equal(isAdminConfigured(), false);
  if (saved !== undefined) process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256 = saved;
});

test('verifyAdminPassword accepts the correct password', async () => {
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256 = TEST_HASH;
  assert.equal(await verifyAdminPassword('test-password'), true);
});

test('verifyAdminPassword rejects a wrong password', async () => {
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256 = TEST_HASH;
  assert.equal(await verifyAdminPassword('wrong-password'), false);
});

test('verifyAdminPassword rejects when not configured', async () => {
  delete process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256;
  assert.equal(await verifyAdminPassword('test-password'), false);
});

test('isAdminSession is false outside a browser', () => {
  assert.equal(isAdminSession(), false);
});

test('adminIdentity has a stable identity value for the picker', () => {
  assert.equal(identityValue(adminIdentity), 'admin');
  assert.equal(adminIdentity.admin, true);
});

test('defaultTeamForGroupTab resets the scope for the admin identity', () => {
  assert.equal(defaultTeamForGroupTab(adminIdentity, 'Group A'), '');
  assert.equal(defaultTeamForGroupTab(adminIdentity, 'Group B'), '');
});

const otherTeamMatch: Match = {
  id: '1',
  matchup: 'Team #2 vs Team #5',
  match_date: '2026-09-20',
  match_time: '10:00',
  court: 'Court 1',
  status: 'Scheduled',
  league_group: 'Group A',
};

test('canUpdateMatch lets the admin update matches they are not on', () => {
  assert.equal(canUpdateMatch(otherTeamMatch, adminIdentity), true);
});

test('canUpdateMatch still scopes regular players to their own matches', () => {
  const player = { name: 'Sudharssun', teamId: '2', group: 'Group A' as const };
  const stranger = { name: 'Amit', teamId: '4', group: 'Group B' as const };
  assert.equal(canUpdateMatch(otherTeamMatch, player), true);
  assert.equal(canUpdateMatch(otherTeamMatch, stranger), false);
});
