import { supabase } from "@/src/lib/supabase";
import { getCurrentAppUser } from "@/src/lib/auth/get-current-app-user";
import type { CurrentUserPermissionState } from "@/src/types/auth";

type UserPermissionRow = {
  user_id: number;
  auth_user_id: string | null;
  full_name: string;
  email: string | null;
  role_id: number;
  role_code: string;
  role_name: string;
  permission_id: number;
  permission_code: string;
  permission_name: string;
  module: string;
};

export async function getCurrentUserPermissions(): Promise<CurrentUserPermissionState> {
  const user = await getCurrentAppUser();

  if (!user) {
    return {
      user: null,
      roles: [],
      permissions: [],
      permissionSet: new Set<string>(),
    };
  }

  const response = await supabase
    .from("v_user_permissions")
    .select(`
      user_id,
      auth_user_id,
      full_name,
      email,
      role_id,
      role_code,
      role_name,
      permission_id,
      permission_code,
      permission_name,
      module
    `)
    .eq("user_id", user.id);

  if (response.error) {
    console.error("getCurrentUserPermissions db error:", response.error.message);

    return {
      user,
      roles: [],
      permissions: [],
      permissionSet: new Set<string>(),
    };
  }

  const rows: UserPermissionRow[] = Array.isArray(response.data)
    ? response.data.map((row) => ({
        user_id: Number(row.user_id),
        auth_user_id: row.auth_user_id ?? null,
        full_name: String(row.full_name ?? ""),
        email: row.email ?? null,
        role_id: Number(row.role_id),
        role_code: String(row.role_code ?? ""),
        role_name: String(row.role_name ?? ""),
        permission_id: Number(row.permission_id),
        permission_code: String(row.permission_code ?? ""),
        permission_name: String(row.permission_name ?? ""),
        module: String(row.module ?? ""),
      }))
    : [];

  const roles = Array.from(
    new Set(rows.map((row) => row.role_code).filter(Boolean))
  ).sort();

  const permissions = Array.from(
    new Set(rows.map((row) => row.permission_code).filter(Boolean))
  ).sort();

  return {
    user,
    roles,
    permissions,
    permissionSet: new Set<string>(permissions),
  };
}