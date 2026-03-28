import type { OutputStatus } from "@/lib/db/codec";

export type ParsedAiFeedbackJson = {
  approvalProbability: number;
  status: OutputStatus;
  summaryReason: string;
  aiExplanation: string;
};

const SYSTEM = `You are an expert design reviewer. The user submits a design draft (optional image) and optional description.
Respond with ONLY a single JSON object, no markdown, no code fences. Use this exact shape:
{"approvalProbability": number between 0 and 1 (estimated chance stakeholders approve),
 "status": "Approved" or "Rejected" (your overall recommendation),
 "summaryReason": string (one short line combining verdict + key signal),
 "aiExplanation": string (2-4 short paragraphs in Korean, separated by \\n\\n, about layout, hierarchy, readability, CTA, risks)}`;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function parseAiFeedbackModelJson(raw: string): ParsedAiFeedbackJson | null {
  const trimmed = raw.trim();
  const jsonStr = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  try {
    const p = JSON.parse(jsonStr) as Record<string, unknown>;
    const approvalProbability = clamp01(Number(p.approvalProbability));
    const status: OutputStatus =
      p.status === "Rejected" ? "Rejected" : "Approved";
    return {
      approvalProbability,
      status,
      summaryReason: String(p.summaryReason ?? "").trim() || "AI 분석 요약",
      aiExplanation: String(p.aiExplanation ?? "").trim() || "상세 설명이 없습니다.",
    };
  } catch {
    return null;
  }
}

export function buildFallbackParsed(): ParsedAiFeedbackJson {
  return {
    approvalProbability: 0.55,
    status: "Approved",
    summaryReason: "AI 응답을 가져오지 못해 예시 분석을 표시합니다.",
    aiExplanation: [
      "이 시안은 기존 승인된 디자인과 유사한 구조를 가지고 있습니다. CTA 버튼의 위치가 명확하며 정보 계층 구조가 잘 드러납니다.",
      "다만 텍스트 밀도가 높은 영역이 있어 가독성이 일부 떨어질 수 있습니다.",
    ].join("\n\n"),
  };
}

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function requestDesignFeedbackFromOpenAI(input: {
  description: string;
  imageUrl: string | null;
}): Promise<{ text: string; ok: true } | { ok: false; error: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (typeof key !== "string" || !key.length) {
    return { ok: false, error: "OPENAI_API_KEY missing" };
  }

  const userParts: OpenAiContentPart[] = [];
  const desc = input.description.trim();
  userParts.push({
    type: "text",
    text:
      (desc
        ? `시안 설명:\n${desc}\n\n위 내용과 이미지(있다면)를 바탕으로 JSON만 출력하세요.`
        : "이미지와 설명이 제한적입니다. 보이는 범위에서 JSON만 출력하세요.") +
      (input.imageUrl
        ? ""
        : "\n(이미지는 제공되지 않았습니다. 설명만으로 판단하세요.)"),
  });
  if (input.imageUrl && input.imageUrl.length > 0) {
    userParts.push({
      type: "image_url",
      image_url: { url: input.imageUrl },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userParts },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      error: `OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`,
    };
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = String(body.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    return { ok: false, error: "Empty OpenAI response" };
  }
  return { text, ok: true };
}
