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

/**
 * Whether the dashboard shows the "Action required" section for past-due
 * scheduled matches. Only when a signed-in (non-viewing) user has their own
 * team selected in the team dropdown and that team has overdue matches.
 * Everyone else sees those matches as regular Scheduled entries.
 */
export function shouldShowActionRequired(
  identity: Identity,
  team: string,
  overdueCount: number
): boolean {
  return (
    !identity.viewing && identity.teamId !== '' && team === identity.teamId && overdueCount > 0
  );
}
