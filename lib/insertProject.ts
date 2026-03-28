import { supabase } from "./supabase";

export type InsertProjectResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_authenticated" | "insert_failed"; message?: string };

/**
 * 현재 로그인한 유저의 user_id로 Supabase `projects` 행을 추가합니다.
 * MVP: name + user_id만 전송 (테이블에 다른 NOT NULL 컬럼이 있으면 Supabase에서 스키마 맞춰 주세요).
 */
export async function insertProjectForCurrentUser(payload: {
  name: string;
}): Promise<InsertProjectResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const uid = user?.id != null ? String(user.id).trim() : "";
  if (userError || !uid) {
    console.warn("[projects] 로그인된 사용자 없음 — DB insert 생략");
    return { ok: false, reason: "not_authenticated" };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: payload.name,
      user_id: uid,
    })
    .select()
    .single();

  if (error || !data || data.id == null) {
    console.error("[projects] insert 실패:", error?.message ?? "no row");
    return {
      ok: false,
      reason: "insert_failed",
      message: error?.message,
    };
  }

  return { ok: true, id: String(data.id) };
}
