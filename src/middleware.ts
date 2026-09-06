import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesToSet = Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0];

const PROTECTED = ["/dashboard", "/onboarding"];

/**
 * ミドルウェアはほぼ全リクエストを通るため、ここで例外を投げると
 * サイト全体が 500 (MIDDLEWARE_INVOCATION_FAILED) になる。
 * 認証はレイアウト・ページ・APIルート側でも必ず検証しているので、
 * ここでの失敗は「素通し」にして全体停止だけは避ける。
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 環境変数が無い場合、createServerClient は例外を投げる。
  // デプロイ先に未設定でもサイトが落ちないよう、ここで抜ける。
  if (!url || !anonKey) {
    console.error(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。" +
        "セッション確認をスキップします (認証はページ側で検証されます)。",
    );
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    if (!user && PROTECTED.some((p) => path.startsWith(p))) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }

    if (user && (path === "/login" || path === "/signup")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (err) {
    // Supabaseへの到達不可・トークン不正などでサイト全体を止めない
    console.error("[middleware] セッション確認に失敗しました:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    // 静的アセットと、独自に認証するAPI・計測エンドポイントは通さない。
    // (APIルートは requireOrg() / 署名検証で個別に認証しているため、
    //  ここを通さないことで障害の影響範囲とレイテンシを減らす)
    "/((?!api/|_next/static|_next/image|favicon.ico|t/|c/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
