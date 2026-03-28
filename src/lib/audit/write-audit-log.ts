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

/**
 * Write an audit log entry for a user action.
 * Logs are important for compliance and debugging, so errors are logged but don't fail the operation.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<boolean> {
  try {
    const currentUser = await getCurrentAppUser();

    const { error } = await supabase.from("audit_logs").insert({
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

    if (error) {
      console.error("Failed to write audit log:", {
        action: input.action,
        entity_table: input.entity_table,
        errorMessage: error.message,
        errorCode: error.code,
      });

      // Send to error tracking service
      sendAuditLogError(error, input);

      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error writing audit log:", error);

    // Send unexpected errors to monitoring
    if (error instanceof Error) {
      sendAuditLogError(error, input);
    }

    return false;
  }
}

/**
 * Send audit log errors to monitoring/error tracking service
 * This is where you'd integrate with Sentry, LogRocket, etc.
 */
function sendAuditLogError(
  error: Error | { message: string; code?: string },
  input: AuditLogInput
) {
  // Example: Send to error tracking service
  // In production, replace with actual error reporting service
  const errorData = {
    type: "AUDIT_LOG_WRITE_FAILURE",
    timestamp: new Date().toISOString(),
    action: input.action,
    entity_table: input.entity_table,
    entity_id: input.entity_id,
    error: {
      message: error.message,
      code: (error as any).code,
    },
  };

  // TODO: Integrate with error tracking service
  // logToErrorTrackingService(errorData);

  // For now, just log to console in development
  if (process.env.NODE_ENV === "development") {
    console.warn("[Audit Log Error]", errorData);
  }
}