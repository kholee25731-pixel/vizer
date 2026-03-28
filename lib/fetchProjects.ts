import { supabase } from "./supabase";

/** 로그인 없음 */
const NO_USER = null;

/**
 * `getUser()`로 현재 유저를 확인한 뒤, 해당 `user_id`의 projects 행만 조회합니다.
 * @returns null = 비로그인 → 호출부에서 로컬 복원 등 처리. 빈 배열 = 로그인했으나 행 없음 또는 오류.
 */
export async function selectProjectsForCurrentUser(): Promise<
  Record<string, unknown>[] | typeof NO_USER
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NO_USER;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error("[projects] select 실패:", error.message);
    return [];
  }

  return data ?? [];
}
