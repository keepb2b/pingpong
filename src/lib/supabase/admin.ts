import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role client — bypasses RLS.
 * Only use in route handlers / cron jobs / webhooks, never in the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
