import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { appUrl } from "@/lib/tracking";

export async function POST() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(appUrl("/login"), { status: 303 });
}
