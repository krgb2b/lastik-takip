import { supabase } from "@/src/lib/supabase";
import { getCurrentAppUser } from "@/src/lib/auth/get-current-app-user";

type AuditLogInput = {
  action: string;
  entity_table: string;
  entity_id?: number | null;
  description?: string | null;
  payload?: Record<string, unknown> | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
};

export async function writeAuditLog(input: AuditLogInput) {
  try {
    const currentUser = await getCurrentAppUser();

    await supabase.from("audit_logs").insert({
      app_user_id: currentUser?.id ?? null,
      user_id: currentUser?.id ?? null,
      action_code: input.action,
      entity_type: input.entity_table,
      entity_id: input.entity_id ?? null,
      old_data: input.old_data ?? null,
      new_data: input.new_data ?? null,
      payload_json: {
        ...(input.payload ?? {}),
        description: input.description ?? null,
      },
    });
  } catch (error) {
    console.error("writeAuditLog error:", error);
  }
}