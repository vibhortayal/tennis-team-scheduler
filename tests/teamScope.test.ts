import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTeamForGroupTab } from '../app/lib/teamScope.ts';
import type { Identity } from '../app/teams.ts';

const identity: Identity = { name: 'Vibhor', teamId: '2', group: 'Group A' };
const viewing: Identity = {
  name: 'Viewer',
  teamId: '',
  group: 'Group A',
  viewing: true,
};

test('reselects the identity team when switching back to the identity group', () => {
  assert.equal(defaultTeamForGroupTab(identity, 'Group A'), '2');
});

test('resets the scope when switching to a different group', () => {
  assert.equal(defaultTeamForGroupTab(identity, 'Group B'), '');
});

test('resets the scope for viewing-only identities on their own group tab', () => {
  assert.equal(defaultTeamForGroupTab(viewing, 'Group A'), '');
});

test('resets the scope for viewing-only identities on the other group tab', () => {
  assert.equal(defaultTeamForGroupTab(viewing, 'Group B'), '');
});

test('handles an identity with an empty team id', () => {
  assert.equal(defaultTeamForGroupTab({ ...identity, teamId: '' }, 'Group A'), '');
});
