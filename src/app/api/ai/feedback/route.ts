import OpenAI from "openai";
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
      description?: unknown;
      image_url?: unknown;
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
    if (!description && !image_url) {
      return Response.json(
        { error: "description 또는 image_url 중 하나는 필요합니다." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey });

    const userMessageContent: OpenAI.Chat.ChatCompletionUserMessageParam["content"] =
      image_url
        ? [
            {
              type: "text",
              text:
                description ||
                "첨부한 디자인 시안에 대해 구체적인 피드백을 한국어로 작성해 주세요.",
            },
            { type: "image_url", image_url: { url: image_url } },
          ]
        : description;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "디자인 피드백을 해주는 전문가",
        },
        {
          role: "user",
          content: userMessageContent,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (content == null || String(content).trim() === "") {
      return Response.json(
        { error: "AI 응답이 비어 있습니다." },
        { status: 502 },
      );
    }

    const { data: inserted, error: insertAuthError } = await supabase
      .from("ai_feedbacks")
      .insert({
        project_id,
        content,
        user_id: user.id,
        image_url: image_url || "",
      })
      .select("id, created_at")
      .single();

    if (insertAuthError || !inserted?.id) {
      console.error("[api/ai/feedback] insert:", insertAuthError?.message);
      return Response.json(
        {
          error: "DB 저장에 실패했습니다.",
          detail: insertAuthError?.message,
        },
        { status: 500 },
      );
    }

    return Response.json({
      content,
      id: String(inserted.id),
      created_at:
        typeof inserted.created_at === "string"
          ? inserted.created_at
          : new Date().toISOString(),
    });
  } catch (e) {
    console.error("[api/ai/feedback]", e);
    const message =
      e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
