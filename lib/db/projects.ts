import { supabase } from "../supabase";

export async function insertProjectRow(payload: {
  name: string;
  user_id: string;
  leader: string | null;
  category: string;
  cycle: string;
  description: string;
}): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; message?: string }
> {
  const userId = String(payload.user_id ?? "").trim();
  if (!userId) {
    console.error("[projects] insert: user_id는 필수입니다.");
    return { ok: false, message: "user_id는 필수입니다." };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: payload.name,
      user_id: userId,
      leader: payload.leader,
      category: payload.category,
      cycle: payload.cycle,
      description: payload.description,
      deleted: false,
      deleted_at: null,
    })
    .select()
    .single();

  if (error || !data?.id) {
    console.error("[projects] insert 실패:", error?.message);
    return { ok: false, message: error?.message };
  }
  return { ok: true, row: data as Record<string, unknown> };
}

export async function updateProjectRow(
  projectId: string,
  patch: Partial<{
    name: string;
    leader: string | null;
    category: string;
    cycle: string;
    description: string;
    deleted: boolean;
    deleted_at: string | null;
  }>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select();

  if (error) {
    console.error("[projects] update 실패", error);
    return false;
  }

  if (!data || data.length === 0) {
    console.error(
      "[projects] update 0 rows (조건 불일치 — id·RLS·권한 등)",
      { projectId },
    );
    return false;
  }

  return true;
}

/** 영구 삭제: 연관 ai_feedbacks / feedbacks 먼저 제거 */
export async function deleteProjectCascade(projectId: string): Promise<boolean> {
  const { error: aErr } = await supabase
    .from("ai_feedbacks")
    .delete()
    .eq("project_id", projectId);
  if (aErr) {
    console.error("[projects] delete: ai_feedbacks 실패:", aErr.message);
    return false;
  }
  const { error: fErr } = await supabase
    .from("feedbacks")
    .delete()
    .eq("project_id", projectId);
  if (fErr) {
    console.error("[projects] delete: feedbacks 실패:", fErr.message);
    return false;
  }
  const { error: pErr } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (pErr) {
    console.error("[projects] delete 실패:", pErr.message);
    return false;
  }
  return true;
}
