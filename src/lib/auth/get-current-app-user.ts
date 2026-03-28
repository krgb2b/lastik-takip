import { supabase } from "@/src/lib/supabase";
import type { CurrentAppUser } from "@/src/types/auth";
import { AUTH_MODE, DEV_TEST_EMAIL } from "@/src/lib/auth/auth-config";
import { AppUserSchema, type AppUser } from "@/src/lib/schemas/validation";
import { parseAndValidate, handleSupabaseError, retryWithBackoff } from "@/src/lib/utils/error-handler";

async function getDevTestUser(): Promise<CurrentAppUser | null> {
  try {
    const data = await retryWithBackoff(
      async () => {
        const response = await supabase
          .from("app_users")
          .select("id, auth_user_id, full_name, email, is_active")
          .eq("email", DEV_TEST_EMAIL)
          .eq("is_active", true)
          .limit(1);
        return handleSupabaseError(
          async () => response,
          "getDevTestUser",
          null
        );
      },
      { maxRetries: 3 }
    );

    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const appUser = parseAndValidate<AppUser>(
      data[0],
      AppUserSchema,
      "getDevTestUser"
    );

    return {
      id: appUser.id,
      authUserId: appUser.auth_user_id,
      fullName: appUser.full_name,
      email: appUser.email,
      isActive: appUser.is_active,
    };
  } catch (error) {
    console.error("getDevTestUser error:", error);
    return null;
  }
}

async function linkAuthUserToAppUser(authUserId: string, email: string | null) {
  if (!email) return;

  try {
    const existing = await supabase
      .from("app_users")
      .select("id, auth_user_id")
      .eq("email", email)
      .limit(1)
      .single();

    if (existing.error?.code === "PGRST116") {
      // No matching row found, skip linking
      return;
    }

    if (existing.error) {
      console.error("linkAuthUserToAppUser select error:", existing.error.message);
      return;
    }

    const row = existing.data as { id: number; auth_user_id: string | null } | null;

    if (!row || row.auth_user_id) return; // Already linked

    await supabase
      .from("app_users")
      .update({ auth_user_id: authUserId })
      .eq("id", row.id);
  } catch (error) {
    console.error("linkAuthUserToAppUser error:", error);
  }
}

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  if (AUTH_MODE === "dev_test") {
    return getDevTestUser();
  }

  try {
    const authResponse = await supabase.auth.getUser();

    if (authResponse.error) {
      if (authResponse.error.message === "Auth session missing!") {
        return null;
      }

      console.error("getCurrentAppUser auth error:", authResponse.error.message);
      return null;
    }

    const authUser = authResponse.data.user;

    if (!authUser?.id) {
      return null;
    }

    await linkAuthUserToAppUser(authUser.id, authUser.email ?? null);

    const appUserData = await retryWithBackoff(
      async () => {
        const response = await supabase
          .from("app_users")
          .select("id, auth_user_id, full_name, email, is_active")
          .eq("auth_user_id", authUser.id)
          .eq("is_active", true)
          .maybeSingle();
        return handleSupabaseError(
          async () => response,
          "getCurrentAppUser"
        );
      },
      { maxRetries: 3 }
    );

    if (!appUserData) {
      return null;
    }

    const appUser = parseAndValidate<AppUser>(
      appUserData,
      AppUserSchema,
      "getCurrentAppUser"
    );

    return {
      id: appUser.id,
      authUserId: appUser.auth_user_id,
      fullName: appUser.full_name,
      email: appUser.email,
      isActive: appUser.is_active,
    };
  } catch (error) {
    console.error("getCurrentAppUser unexpected error:", error);
    return null;
  }
}