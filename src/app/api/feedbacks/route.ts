import { analyzeDesign } from "@/lib/ai/analyzeDesign";
import { decodeFeedbackContent } from "@/lib/db/codec";
import { createSupabaseForBearer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  console.log("API ROUTE HIT");
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
      output_id?: unknown;
      status?: unknown;
      reason?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "JSON 본문이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    console.log("BODY:", body);

    const project_id =
      typeof body.project_id === "string" ? body.project_id.trim() : "";
    const output_id =
      typeof body.output_id === "string" ? body.output_id.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const image_url =
      typeof body.image_url === "string" ? body.image_url.trim() : "";

    console.log("PROJECT ID:", project_id);
    if (!project_id) {
      return Response.json(
        { error: "project_id가 필요합니다." },
        { status: 400 },
      );
    }
    console.log("OUTPUT ID:", output_id);
    if (!output_id) {
      return Response.json(
        { error: "output_id가 필요합니다." },
        { status: 400 },
      );
    }
    console.log("IMAGE / DESC:", image_url, description);
    if (!image_url && !description) {
      return Response.json(
        { error: "image_url 또는 description 중 하나는 필요합니다." },
        { status: 400 },
      );
    }

    const { data: existing, error: existingErr } = await supabase
      .from("feedbacks")
      .select("id, project_id, content, description")
      .eq("id", output_id)
      .maybeSingle();

    console.log("EXISTING:", existing);
    if (existingErr || !existing) {
      return Response.json(
        { error: "피드백을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (String(existing.project_id ?? "") !== project_id) {
      return Response.json(
        { error: "project_id가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    const row = existing as Record<string, unknown>;
    const meta = decodeFeedbackContent(String(row.content ?? ""));
    let evalStatus: "Approved" | "Rejected" = meta.status;
    if (body.status === "Approved" || body.status === "Rejected") {
      evalStatus = body.status;
    }
    let evalReason = String(meta.reason ?? "").trim();
    if (typeof body.reason === "string" && body.reason.trim() !== "") {
      evalReason = body.reason.trim();
    }
    const rowDesc =
      row.description != null && String(row.description).trim() !== ""
        ? String(row.description).trim()
        : "";
    const designDescription =
      description !== "" ? description : rowDesc || meta.description.trim();

    // 클라이언트에서 feedback 행 insert 직후 호출 → 항상 analyzeDesign 실행
    console.log("BEFORE ANALYZE DESIGN");
    const result = await analyzeDesign({
      image_url,
      description: designDescription,
      status: evalStatus,
      reason: evalReason,
    });
    console.log("AI RAW RESULT:", result);

    if (result) {
      const { error: updateError } = await supabase
        .from("feedbacks")
        .update({
          ai_background: JSON.stringify(result.background),
          ai_typography: JSON.stringify(result.typography),
          ai_layout: JSON.stringify(result.layout),
          ai_copywriting: JSON.stringify(result.copywriting),
          ai_key_visual: JSON.stringify(result.key_visual),
          ai_summary: JSON.stringify({
            concept: result.concept,
            feedback_alignment: result.feedback_alignment,
          }),
        })
        .eq("id", output_id);

      if (updateError) {
        return Response.json(
          {
            error: "피드백 AI 갱신에 실패했습니다.",
            detail: updateError.message,
          },
          { status: 500 },
        );
      }
    }

    const { data: feedbackRow, error: selectError } = await supabase
      .from("feedbacks")
      .select()
      .eq("id", output_id)
      .single();

    if (selectError || !feedbackRow) {
      return Response.json(
        {
          error: "피드백 조회에 실패했습니다.",
          detail: selectError?.message,
        },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      id: String((feedbackRow as { id?: string }).id ?? ""),
      row: feedbackRow,
    });
  } catch (e) {
    console.error("[api/feedbacks] POST", e);
    const message =
      e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
