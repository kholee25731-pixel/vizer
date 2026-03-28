import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a professional design critic.

Analyze the given design based on:

1. Background (color, texture, pattern)
2. Typography (font, size, alignment)
3. Copywriting (tone, clarity)
4. Layout (structure, visual flow)
5. Key Visual (main attention element)

Return JSON only, no markdown code fences:

{
  "background": "",
  "typography": "",
  "copywriting": "",
  "layout": "",
  "key_visual": "",
  "summary": ""
}

Use Korean for the string values where natural. "summary" is an optional short overall assessment.`;

export type DesignAnalysisResult = {
  background: string | null;
  typography: string | null;
  copywriting: string | null;
  layout: string | null;
  key_visual: string | null;
  summary: string | null;
};

function emptyResult(): DesignAnalysisResult {
  return {
    background: null,
    typography: null,
    copywriting: null,
    layout: null,
    key_visual: null,
    summary: null,
  };
}

function toNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseModelJson(raw: string): DesignAnalysisResult {
  try {
    const trimmed = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "");
    const p = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      background: toNullableString(p.background),
      typography: toNullableString(p.typography),
      copywriting: toNullableString(p.copywriting),
      layout: toNullableString(p.layout),
      key_visual: toNullableString(p.key_visual),
      summary: toNullableString(p.summary),
    };
  } catch {
    return emptyResult();
  }
}

type AnalyzeDesignInput = {
  image_url: string;
  description: string;
};

/**
 * 디자인 이미지(선택) + 설명을 받아 OpenAI로 분석하고 JSON 필드를 반환합니다.
 * 실패 시 모든 필드는 null입니다.
 */
export async function analyzeDesign({
  image_url,
  description,
}: AnalyzeDesignInput): Promise<DesignAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return emptyResult();
  }

  const openai = new OpenAI({ apiKey });

  const desc = String(description ?? "").trim();
  const img = String(image_url ?? "").trim();

  const userMessageContent: OpenAI.Chat.ChatCompletionUserMessageParam["content"] =
    img
      ? [
          {
            type: "text",
            text:
              desc
                ? `Designer notes:\n${desc}\n\nReturn the JSON as specified.`
                : "No extra notes. Analyze the image and return the JSON as specified.",
          },
          { type: "image_url", image_url: { url: img } },
        ]
      : desc || "Return empty-string fields in JSON if there is no design to analyze.";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessageContent },
      ],
    });

    const text = String(response.choices[0]?.message?.content ?? "").trim();
    if (!text) return emptyResult();
    return parseModelJson(text);
  } catch (e) {
    console.error("[analyzeDesign] OpenAI 실패:", e);
    return emptyResult();
  }
}
