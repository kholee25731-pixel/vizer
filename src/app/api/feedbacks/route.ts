import { analyzeDesign } from "@/lib/ai/analyzeDesign";
import { encodeFeedbackContent } from "@/lib/db/codec";
import { insertFeedbackWithClient } from "@/lib/db/feedbacks";
import { createSupabaseForBearer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token) {
      return Response.json(
        { error: "Authorization Bearer 토큰이 필요합니다." },
        { status: 401 },
      );
    }

    const supabase = createSupabaseForBearer(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: "인증에 실패했습니다." },
        { status: 401 },
      );
    }

    let body: {
      project_id?: unknown;
      image_url?: unknown;
      description?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "JSON 본문이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const project_id =
      typeof body.project_id === "string" ? body.project_id.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const image_url =
      typeof body.image_url === "string" ? body.image_url.trim() : "";

    if (!project_id) {
      return Response.json(
        { error: "project_id가 필요합니다." },
        { status: 400 },
      );
    }
    if (!image_url && !description) {
      return Response.json(
        { error: "image_url 또는 description 중 하나는 필요합니다." },
        { status: 400 },
      );
    }

    const ai = await analyzeDesign({ image_url, description });

    const content = encodeFeedbackContent({
      output_type: "design",
      status: "Approved",
      reason: "",
      description: description || "(시안 업로드)",
      tags: [],
      copy_text: undefined,
    });

    const result = await insertFeedbackWithClient(supabase, {
      project_id,
      content,
      image_url: image_url || "",
      ai_background: ai.background,
      ai_typography: ai.typography,
      ai_copywriting: ai.copywriting,
      ai_layout: ai.layout,
      ai_key_visual: ai.key_visual,
      ai_summary: ai.summary,
    });

    if (!result.ok) {
      return Response.json(
        { error: "피드백 저장에 실패했습니다.", detail: result.message },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      id: String((result.row as { id?: string }).id ?? ""),
      row: result.row,
    });
  } catch (e) {
    console.error("[api/feedbacks] POST", e);
    const message =
      e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
