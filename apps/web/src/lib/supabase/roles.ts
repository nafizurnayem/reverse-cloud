import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  noStaffAccess,
  permissionKeys,
  type Permission,
  type StaffAccess,
  type StaffRole,
} from "@/lib/auth/permissions";

type PermissionRelation = { permission_key?: unknown };
type RoleRelation = {
  key?: unknown;
  name?: unknown;
  role_permissions?: PermissionRelation | PermissionRelation[] | null;
};
type StaffRoleRow = { roles?: RoleRelation | RoleRelation[] | null };

const knownPermissions = new Set<string>(permissionKeys);

function many<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function staffAccessFromRows(value: unknown): StaffAccess {
  if (!Array.isArray(value) || value.length === 0) return noStaffAccess;

  const roles = new Map<string, StaffRole>();
  const permissions = new Set<Permission>();

  for (const row of value as StaffRoleRow[]) {
    for (const role of many(row.roles)) {
      if (typeof role.key !== "string" || typeof role.name !== "string") continue;
      roles.set(role.key, { key: role.key, name: role.name });

      for (const relation of many(role.role_permissions)) {
        if (
          typeof relation.permission_key === "string" &&
          knownPermissions.has(relation.permission_key)
        ) {
          permissions.add(relation.permission_key as Permission);
        }
      }
    }
  }

  const roleList = [...roles.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    isStaff: roleList.length > 0,
    isAdmin: roleList.some((role) => role.key === "admin"),
    roles: roleList,
    permissions: [...permissions].sort(),
  };
}

export async function getStaffAccess(supabase: SupabaseClient, userId: string) {
  try {
    const { data, error } = await supabase
      .from("staff_roles")
      .select("roles!inner(key,name,role_permissions(permission_key))")
      .eq("user_id", userId)
      .eq("is_active", true);

    return error ? noStaffAccess : staffAccessFromRows(data);
  } catch {
    return noStaffAccess;
  }
}

export async function isActiveStaff(supabase: SupabaseClient, userId: string) {
  try {
    const { data, error } = await supabase
      .from("staff_roles")
      .select("role_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function isActiveAdmin(supabase: SupabaseClient, userId: string) {
  const access = await getStaffAccess(supabase, userId);
  return access.isAdmin;
}
