import { supabase } from "@/src/lib/supabase";
import { getCurrentAppUser } from "@/src/lib/auth/get-current-app-user";
import type { CurrentUserPermissionState } from "@/src/types/auth";
import { UserPermissionRowsSchema, type UserPermissionRows } from "@/src/lib/schemas/validation";
import { parseAndValidate, handleSupabaseError, retryWithBackoff } from "@/src/lib/utils/error-handler";

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

  try {
    const rows = await retryWithBackoff(
      async () => {
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
        return handleSupabaseError(
          async () => response,
          "getCurrentUserPermissions"
        );
      },
      { maxRetries: 3 }
    );

    if (!rows) {
      return {
        user,
        roles: [],
        permissions: [],
        permissionSet: new Set<string>(),
      };
    }

    // Validate response data with schema
    const validatedRows = parseAndValidate<UserPermissionRows>(
      rows,
      UserPermissionRowsSchema,
      "getCurrentUserPermissions"
    );

    const roles = Array.from(
      new Set(validatedRows.map((row) => row.role_code).filter(Boolean))
    ).sort();

    const permissions = Array.from(
      new Set(validatedRows.map((row) => row.permission_code).filter(Boolean))
    ).sort();

    return {
      user,
      roles,
      permissions,
      permissionSet: new Set<string>(permissions),
    };
  } catch (error) {
    console.error("getCurrentUserPermissions error:", error);

    return {
      user,
      roles: [],
      permissions: [],
      permissionSet: new Set<string>(),
    };
  }
}