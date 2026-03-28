import { ZodSchema } from "zod";

export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Safely parse and validate Supabase responses with schema validation
 */
export function parseAndValidate<T>(
  data: unknown,
  schema: ZodSchema,
  context: string
): T {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    console.error(`Validation error in ${context}:`, error);

    let message = `Invalid data received in ${context}`;
    let details: Record<string, any> = {};

    if (error instanceof Error && error.name === "ZodError") {
      // Zod error - provide first validation error
      const zodError = error as any;
      if (zodError.errors && Array.isArray(zodError.errors)) {
        const firstError = zodError.errors[0];
        message = `${context}: ${firstError.path.join(".")}: ${firstError.message}`;
        details = {
          path: firstError.path,
          received: firstError.received,
          expected: firstError.expected,
        };
      }
    }

    throw new ValidationError("VALIDATION_FAILED", message, details);
  }
}

/**
 * Handle Supabase errors with consistent error messages
 */
export async function handleSupabaseError<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  context: string,
  fallback?: T
): Promise<T | null> {
  try {
    const { data, error } = await operation();

    if (error) {
      console.error(`${context} error:`, error.message);

      // Provide user-friendly error message
      let userMessage = "Veri yüklenirken hata oluştu";

      if (error.code === "PGRST116") {
        userMessage = "Veri bulunamadı";
      } else if (error.code === "42P01") {
        userMessage = "Veritabanı tablosu bulunamadı";
      } else if (error.message?.includes("connection")) {
        userMessage = "Sunucuya bağlanılamadı";
      }

      const err = new Error(userMessage);
      (err as any).code = error.code;
      (err as any).originalError = error;

      throw err;
    }

    return data || fallback || null;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    console.error(`Unexpected error in ${context}:`, error);
    throw error;
  }
}

/**
 * Retry async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (lastError.name === "ValidationError") {
        throw error;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffFactor, maxDelayMs);
      }
    }
  }

  throw lastError || new Error("Operation failed after retries");
}
