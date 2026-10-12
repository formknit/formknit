/** Roles from least to most access. Each one can do everything the ones before it can. */
export const ROLES = ['viewer', 'reviewer', 'editor', 'admin', 'owner'] as const
export type Role = (typeof ROLES)[number]

export const rank = (role: Role) => ROLES.indexOf(role)
export const atLeast = (role: Role, minimum: Role) => rank(role) >= rank(minimum)
export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role)

/**
 * What each role adds:
 * - viewer: see forms, submissions and reports; export
 * - reviewer: set a submission's status and add notes
 * - editor: create, edit and publish forms; edit and delete submissions; manage webhooks
 * - admin: delete forms; invite, change and remove members below admin
 * - owner: manage admins; rename the workspace
 */
export const NEEDS = {
  read: 'viewer',
  review: 'reviewer',
  edit: 'editor',
  manage: 'admin',
  own: 'owner',
} as const satisfies Record<string, Role>
