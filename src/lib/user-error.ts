/** 画面・お知らせに出す用。生の JSON / HTML / プロバイダ文言を隠す。 */
export function humanizeError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err ?? "");
  const lower = m.toLowerCase();

  if (
    /unexpected\s+token|not valid json|is not valid json|unexpected end of json|json\.parse|syntaxerror|non-json response/i.test(
      m,
    )
  ) {
    return "サーバーから正しい応答を受け取れませんでした。処理が時間切れのことがあるので、少し待ってからもう一度実行してください。";
  }
  if (/timeout|aborted|timed out|504|502|503/.test(lower)) {
    return "処理が時間内に終わりませんでした。少し待ってからもう一度実行してください。";
  }
  if (/invalid input syntax for type json|expected json/i.test(m)) {
    return "保存形式の不整合で途中の工程が失敗しました。もう一度実行してください。";
  }
  if (/invalid input value for enum/i.test(m)) {
    return "AIの出力に未対応の値があり、保存できませんでした。もう一度実行してください。";
  }
  if (/apiキー認証|401|403/.test(m)) {
    return m.slice(0, 280);
  }

  const trimmed = m.replace(/\s+/g, " ").trim();
  if (trimmed.length > 280) return `${trimmed.slice(0, 277)}…`;
  return trimmed || "処理中に問題が発生しました。もう一度実行してください。";
}

export async function readJsonSafe<T = unknown>(
  res: Response,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 504 || res.status === 502
            ? "処理が時間切れになりました。少し待ってからもう一度実行してください。"
            : `サーバーエラー (${res.status})`,
      };
    }
    return { ok: false, error: "サーバーから空の応答が返りました。" };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      error:
        res.status >= 500
          ? "処理が時間切れか、サーバーが混み合っています。少し待ってからもう一度実行してください。"
          : "サーバーから正しい応答を受け取れませんでした。",
    };
  }
}
