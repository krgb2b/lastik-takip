import { supabase } from "@/src/lib/supabase";
import type { CurrentAppUser } from "@/src/types/auth";
import { AUTH_MODE, DEV_TEST_EMAIL } from "@/src/lib/auth/auth-config";

type AppUserRow = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  email: string | null;
  is_active: boolean;
};

async function getDevTestUser(): Promise<CurrentAppUser | null> {
  const response = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, email, is_active")
    .eq("email", DEV_TEST_EMAIL)
    .eq("is_active", true)
    .limit(1);

  if (response.error) {
    console.error("getCurrentAppUser dev_test db error:", response.error.message);
    return null;
  }

  const row =
    Array.isArray(response.data) && response.data.length > 0
      ? (response.data[0] as AppUserRow)
      : null;

  if (!row) return null;

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
  };
}

async function linkAuthUserToAppUser(authUserId: string, email: string | null) {
  if (!email) return;

  const existing = await supabase
    .from("app_users")
    .select("id, auth_user_id")
    .eq("email", email)
    .limit(1);

  if (existing.error) {
    console.error("linkAuthUserToAppUser select error:", existing.error.message);
    return;
  }

  const row =
    Array.isArray(existing.data) && existing.data.length > 0
      ? (existing.data[0] as { id: number; auth_user_id: string | null })
      : null;

  if (!row) return;
  if (row.auth_user_id) return;

  const updateRes = await supabase
    .from("app_users")
    .update({ auth_user_id: authUserId })
    .eq("id", row.id);

  if (updateRes.error) {
    console.error("linkAuthUserToAppUser update error:", updateRes.error.message);
  }
}

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  if (AUTH_MODE === "dev_test") {
    return getDevTestUser();
  }

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

  const { data, error } = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, email, is_active")
    .eq("auth_user_id", authUser.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("getCurrentAppUser db error:", error.message);
    return null;
  }

  const row = data as AppUserRow | null;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
  };
}