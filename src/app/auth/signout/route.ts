import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  const dest = new URL("/login", request.url);
  if (dest.hostname === "pingpong-ai.netlify.app") {
    dest.protocol = "https:";
    dest.host = "ai-promotion-service.netlify.app";
  }
  return NextResponse.redirect(dest, { status: 303 });
}
