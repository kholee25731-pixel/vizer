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

function normalizeParsed(parsed: unknown): DesignAnalysisResult {
  if (!parsed || typeof parsed !== "object") {
    return emptyResult();
  }
  const o = parsed as Record<string, unknown>;
  return {
    background: toNullableString(o.background),
    typography: toNullableString(o.typography),
    copywriting: toNullableString(o.copywriting),
    layout: toNullableString(o.layout),
    key_visual: toNullableString(o.key_visual),
    summary: toNullableString(o.summary),
  };
}

type AnalyzeDesignInput = {
  image_url: string;
  description: string;
};

/**
 * 이미지 URL + 설명으로 OpenAI Chat Completions(fetch) 호출 후 분석 JSON을 반환합니다.
 * 파싱 실패·HTTP 오류·API 키 없음 → `null` (호출부에서 DB null 처리).
 */
export async function analyzeDesign({
  image_url,
  description,
}: AnalyzeDesignInput): Promise<DesignAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return null;
  }

  const desc = String(description ?? "");
  const img = String(image_url ?? "").trim();

  const userText = `
Analyze this design:

Description: ${desc}

Return JSON:
{
  "background": "",
  "typography": "",
  "copywriting": "",
  "layout": "",
  "key_visual": "",
  "summary": ""
}`;

  const userContent = img
    ? ([
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: img } },
      ] as const)
    : userText;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "You are a professional design critic.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });
  } catch (e) {
    console.error("[analyzeDesign] fetch 실패:", e);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[analyzeDesign] 응답 JSON 파싱 실패");
    return null;
  }

  if (!res.ok) {
    console.error("[analyzeDesign] OpenAI HTTP 오류:", res.status, data);
    return null;
  }

  const rec = data as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = rec.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(content);
    return normalizeParsed(parsed);
  } catch {
    try {
      const stripped = content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "");
      const parsed: unknown = JSON.parse(stripped);
      return normalizeParsed(parsed);
    } catch {
      return null;
    }
  }
}
