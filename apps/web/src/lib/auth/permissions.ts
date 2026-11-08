export const permissionKeys = [
  "content.manage",
  "reviews.moderate",
  "estimator.manage",
  "leads.read",
  "leads.manage",
  "clients.manage",
  "projects.create",
  "projects.update",
  "payments.manage",
  "payments.read",
  "meetings.read",
  "staff.manage",
  "audit.read",
] as const;

export type Permission = (typeof permissionKeys)[number];

export type StaffRole = {
  key: string;
  name: string;
};

export type StaffAccess = {
  isStaff: boolean;
  isAdmin: boolean;
  roles: StaffRole[];
  permissions: Permission[];
};

export const noStaffAccess: StaffAccess = {
  isStaff: false,
  isAdmin: false,
  roles: [],
  permissions: [],
};

export const staffDashboardSegments = ["admin", "project_manager", "developer"] as const;

export type StaffDashboardSegment = (typeof staffDashboardSegments)[number];

export function staffDashboardSegmentForRoles(
  roleKeys: Iterable<string>,
): StaffDashboardSegment {
  const roles = new Set(roleKeys);
  if (roles.has("admin")) return "admin";
  if (roles.has("project_manager")) return "project_manager";
  if (roles.has("developer")) return "developer";
  return "admin";
}

export function staffDashboardPath(
  access: Pick<StaffAccess, "roles">,
  suffix = "",
) {
  const segment = staffDashboardSegmentForRoles(access.roles.map((role) => role.key));
  const normalizedSuffix = suffix && !suffix.startsWith("/") ? `/${suffix}` : suffix;
  return `/${segment}${normalizedSuffix}`;
}

export function hasAnyPermission(
  access: Pick<StaffAccess, "permissions">,
  required: Permission | readonly Permission[],
) {
  const permissions = Array.isArray(required) ? required : [required];
  return permissions.some((permission) => access.permissions.includes(permission));
}
