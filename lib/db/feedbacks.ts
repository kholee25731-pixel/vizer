import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import {
  decodeFeedbackContent,
  encodeFeedbackContent,
} from "./codec";
import type { CreativeOutput } from "@/src/app/providers";

export type InsertFeedbackFields = {
  project_id: string;
  content: string;
  image_url: string;
  /** 시안 설명(평문). DB `description` 컬럼과 동기화 */
  description?: string | null;
  ai_background?: string | null;
  ai_typography?: string | null;
  ai_copywriting?: string | null;
  ai_layout?: string | null;
  ai_key_visual?: string | null;
  ai_summary?: string | null;
};

export async function selectFeedbacksForProjectIds(
  projectIds: string[],
): Promise<Record<string, unknown>[]> {
  if (projectIds.length === 0) return [];
  /** 리스트 부하 완화: AI 컬럼 제외(status는 content JSON에 있음) */
  const { data, error } = await supabase
    .from("feedbacks")
    .select(
      "id, project_id, content, image_url, description, created_at, deleted, deleted_at",
    )
    .in("project_id", projectIds);
  if (error) {
    console.error("[feedbacks] select 실패:", error.message);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

/** DB `ai_*` text 컬럼 → 누락·공백은 null */
function rowAiNullable(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function mapFeedbackRow(row: Record<string, unknown>): CreativeOutput {
  const meta = decodeFeedbackContent(String(row.content ?? ""));
  const deletedAtRaw = row.deleted_at;
  const a = row.image_url;
  const b = row.design_image_data_url;
  const picked =
    (a != null && String(a).trim() !== "" ? String(a).trim() : "") ||
    (b != null && String(b).trim() !== "" ? String(b).trim() : "") ||
    null;
  const o: CreativeOutput = {
    id: String(row.id ?? ""),
    projectId: String(row.project_id ?? ""),
    ...meta,
    image_url: picked,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
    deleted: Boolean(row.deleted),
    deletedAt:
      typeof deletedAtRaw === "string" ? deletedAtRaw : undefined,
    ai_background: rowAiNullable(row, "ai_background"),
    ai_typography: rowAiNullable(row, "ai_typography"),
    ai_copywriting: rowAiNullable(row, "ai_copywriting"),
    ai_layout: rowAiNullable(row, "ai_layout"),
    ai_key_visual: rowAiNullable(row, "ai_key_visual"),
    ai_summary: rowAiNullable(row, "ai_summary"),
  };
  return o;
}

export async function insertFeedbackWithClient(
  client: SupabaseClient,
  payload: InsertFeedbackFields,
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; message?: string }
> {
  const { data, error } = await client
    .from("feedbacks")
    .insert({
      project_id: payload.project_id,
      content: payload.content,
      image_url: payload.image_url ?? "",
      description: payload.description ?? null,
      deleted: false,
      ai_background: payload.ai_background ?? null,
      ai_typography: payload.ai_typography ?? null,
      ai_copywriting: payload.ai_copywriting ?? null,
      ai_layout: payload.ai_layout ?? null,
      ai_key_visual: payload.ai_key_visual ?? null,
      ai_summary: payload.ai_summary ?? null,
    })
    .select()
    .single();
  if (error || !data?.id) {
    console.error("[feedbacks] insert 실패:", error?.message);
    return { ok: false, message: error?.message };
  }
  return { ok: true, row: data as Record<string, unknown> };
}

export async function insertFeedbackRow(
  payload: InsertFeedbackFields,
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; message?: string }
> {
  return insertFeedbackWithClient(supabase, payload);
}

/** 프로젝트 휴지통/복구 시 해당 프로젝트의 모든 feedbacks 일괄 반영 */
export async function updateFeedbacksTrashForProject(
  projectId: string,
  deleted: boolean,
  deleted_at: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("feedbacks")
    .update({ deleted, deleted_at })
    .eq("project_id", projectId);
  if (error) {
    console.error("[feedbacks] 프로젝트 단위 삭제 상태 갱신 실패:", error.message);
    return false;
  }
  return true;
}

export async function updateFeedbackRow(
  feedbackId: string,
  patch: Partial<{
    project_id: string;
    content: string;
    image_url: string;
    deleted: boolean;
    deleted_at: string | null;
    description: string | null;
    ai_background: string | null;
    ai_typography: string | null;
    ai_copywriting: string | null;
    ai_layout: string | null;
    ai_key_visual: string | null;
    ai_summary: string | null;
  }>,
): Promise<boolean> {
  const { error } = await supabase
    .from("feedbacks")
    .update(patch)
    .eq("id", feedbackId);
  if (error) {
    console.error("[feedbacks] update 실패:", error.message);
    return false;
  }
  return true;
}

/** Bearer 클라이언트(RLS)로 AI 분석 컬럼만 갱신 후 행을 반환합니다. */
export async function updateFeedbackAiWithClient(
  client: SupabaseClient,
  feedbackId: string,
  patch: {
    ai_background: string | null;
    ai_typography: string | null;
    ai_copywriting: string | null;
    ai_layout: string | null;
    ai_key_visual: string | null;
    ai_summary: string | null;
  },
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; message?: string }
> {
  const { data, error } = await client
    .from("feedbacks")
    .update(patch)
    .eq("id", feedbackId)
    .select()
    .single();
  if (error || !data?.id) {
    console.error("[feedbacks] AI 컬럼 update 실패:", error?.message);
    return { ok: false, message: error?.message };
  }
  return { ok: true, row: data as Record<string, unknown> };
}

export async function deleteFeedbackRow(feedbackId: string): Promise<boolean> {
  const { error } = await supabase.from("feedbacks").delete().eq("id", feedbackId);
  if (error) {
    console.error("[feedbacks] delete 실패:", error.message);
    return false;
  }
  return true;
}

export { encodeFeedbackContent };
