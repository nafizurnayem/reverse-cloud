const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validStaffRoleId(value: string) {
  return uuidPattern.test(value);
}

export function staffRoleStatusPayload(formData: FormData) {
  const userId = formData.get("user_id");
  const roleId = formData.get("role_id");
  const active = formData.get("is_active");
  if (
    typeof userId !== "string" || !validStaffRoleId(userId) ||
    typeof roleId !== "string" || !validStaffRoleId(roleId) ||
    (active !== "true" && active !== "false")
  ) return null;

  return { userId, roleId, isActive: active === "true" };
}
