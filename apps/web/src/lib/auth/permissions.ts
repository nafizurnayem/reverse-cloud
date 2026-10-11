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

export function hasAnyPermission(
  access: Pick<StaffAccess, "permissions">,
  required: Permission | readonly Permission[],
) {
  const permissions = Array.isArray(required) ? required : [required];
  return permissions.some((permission) => access.permissions.includes(permission));
}
