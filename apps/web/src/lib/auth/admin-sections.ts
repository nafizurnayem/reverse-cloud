import type { Permission } from "./permissions";

export const adminSections = [
  { slug: "content", permissions: ["content.manage"] },
  { slug: "reviews", permissions: ["reviews.moderate"] },
  { slug: "estimator", permissions: ["estimator.manage"] },
  { slug: "leads", permissions: ["leads.read", "leads.manage"] },
  { slug: "clients", permissions: ["clients.manage"] },
  { slug: "projects", permissions: ["projects.create", "projects.update"] },
  { slug: "payments", permissions: ["payments.read", "payments.manage"] },
  { slug: "meetings", permissions: ["meetings.read"] },
  { slug: "staff", permissions: ["staff.manage"] },
  { slug: "audit", permissions: ["audit.read"] },
] as const satisfies readonly {
  slug: string;
  permissions: readonly Permission[];
}[];

export type AdminSection = (typeof adminSections)[number];

export function findAdminSection(value: string) {
  return adminSections.find((section) => section.slug === value);
}

export function visibleAdminSections(permissions: readonly Permission[]) {
  return adminSections.filter((section) =>
    section.permissions.some((permission) => permissions.includes(permission)),
  );
}
