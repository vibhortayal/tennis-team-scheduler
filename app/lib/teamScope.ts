import type { Group, Identity } from '../teams';

/**
 * Team scope to apply when the group tab changes. Returning to the identity's
 * own group tab reselects the identity's team; switching to any other group
 * tab (or using a viewing-only identity) resets the scope to all teams.
 */
export function defaultTeamForGroupTab(identity: Identity, group: Group): string {
  if (identity.viewing) return '';
  return identity.group === group ? identity.teamId : '';
}
