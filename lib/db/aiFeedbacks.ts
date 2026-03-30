import { supabase } from "../supabase";
import {
  decodeAiFeedbackContent,
  encodeAiFeedbackContent,
} from "./codec";
import type { AiFeedbackHistoryEntry } from "@/lib/types/aiFeedbackHistory";

export type AiFeedbackRow = {
  id: string;
  project_id: string;
  content: string;
  created_at: string;
  image_url?: string | null;
};

export async function selectAiFeedbacksForProjectIds(
  projectIds: string[],
): Promise<AiFeedbackRow[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("ai_feedbacks")
    .select("id, project_id, content, created_at, image_url")
    .in("project_id", projectIds);
  if (error) {
    console.error("[ai_feedbacks] select 실패:", error.message);
    return [];
  }
  const rows = data ?? [];
  return rows.map((raw: unknown) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      project_id: String(r.project_id ?? ""),
      content: String(r.content ?? ""),
      created_at: String(r.created_at ?? ""),
      image_url: r.image_url != null ? String(r.image_url) : null,
    } satisfies AiFeedbackRow;
  });
}

export function mapAiFeedbackRow(row: AiFeedbackRow): AiFeedbackHistoryEntry {
  const meta = decodeAiFeedbackContent(String(row.content ?? ""));
  const img =
    row.image_url != null && String(row.image_url).trim() !== ""
      ? String(row.image_url).trim()
      : null;
  if (!meta) {
    return {
      id: String(row.id),
      projectId: String(row.project_id ?? ""),
      projectName: "",
      fileName: "",
      description: String(row.content ?? ""),
      image_url: img,
      summaryReason: "",
      status: "Approved",
      approvalProbability: 0,
      createdAt:
        typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
    };
  }
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    projectName: meta.projectName,
    fileName: meta.fileName,
    description: "",
    image_url: img,
    summaryReason: meta.summaryReason,
    aiExplanation: meta.aiExplanation,
    status: meta.status,
    approvalProbability: meta.approvalProbability,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
  };
}

export async function insertAiFeedbackRow(payload: {
  project_id: string;
  user_id: string;
  content: string;
  image_url?: string;
}): Promise<{ ok: true; id: string } | { ok: false; message?: string }> {
  const { data, error } = await supabase
    .from("ai_feedbacks")
    .insert({
      project_id: payload.project_id,
      user_id: payload.user_id,
      content: payload.content,
      image_url: payload.image_url ?? "",
    })
    .select()
    .single();
  if (error || !data?.id) {
    console.error("[ai_feedbacks] insert 실패:", error?.message);
    return { ok: false, message: error?.message };
  }
  return { ok: true, id: String(data.id) };
}

export { encodeAiFeedbackContent };
