export const AUTH_MODE =
  (process.env.NEXT_PUBLIC_AUTH_MODE as "dev_test" | "supabase_auth") ||
  "dev_test";

export const DEV_TEST_EMAIL =
  process.env.NEXT_PUBLIC_DEV_TEST_EMAIL || "ornek@firma.com";