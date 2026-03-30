export type SimilarPastCase = {
  /** 과거 피드백 행 id — 클라이언트/썸네일 매칭용 */
  feedback_id?: string;
  /** Supabase `feedbacks.image_url` enrich 시 설정 */
  image_url?: string | null;
  description: string;
  result: "Approved" | "Rejected";
  reason: string;
};

export type DesignApprovalEvaluation = {
  approval_score: number;
  prediction: "low" | "mid" | "high";
  reasoning: string;
  risks: string[];
  similar_cases: SimilarPastCase[];
};

/** POST `/api/ai/evaluate` 200 응답 본문 — UI·클라이언트가 이 형태만 가정하면 됩니다. */
export type AiEvaluateApiSuccessBody = DesignApprovalEvaluation;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  let x = n;
  if (x <= 1 && x >= 0) x = x * 100;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, x));
}

function predictionFromScore(score: number): "low" | "mid" | "high" {
  const s = Math.round(score);
  if (s <= 33) return "low";
  if (s <= 66) return "mid";
  return "high";
}

function normalizePrediction(
  v: unknown,
  score: number,
): "low" | "mid" | "high" {
  if (v === "low" || v === "mid" || v === "high") return v;
  return predictionFromScore(score);
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim())
    .filter((s) => s.length > 0);
}

function normalizeSimilarCases(
  v: unknown,
  maxN: number,
): SimilarPastCase[] {
  if (!Array.isArray(v)) return [];
  const out: SimilarPastCase[] = [];
  for (const item of v) {
    if (out.length >= maxN) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const description = String(o.description ?? "").trim();
    const reason = String(o.reason ?? "").trim();
    const r = o.result === "Rejected" ? "Rejected" : "Approved";
    const fid = String(o.case_id ?? o.feedback_id ?? "").trim();
    const imgRaw = o.image_url;
    const image_url =
      imgRaw != null && String(imgRaw).trim() !== ""
        ? String(imgRaw).trim()
        : null;
    if (!description && !reason) continue;
    out.push({
      ...(fid ? { feedback_id: fid } : {}),
      ...(image_url ? { image_url } : {}),
      description: description || "(설명 없음)",
      result: r,
      reason: reason || "(사유 없음)",
    });
  }
  return out;
}

function normalizeParsed(parsed: unknown): DesignApprovalEvaluation | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const reasoning = String(o.reasoning ?? "").trim();
  if (!reasoning) return null;

  const approval_score = clampScore(Number(o.approval_score));
  const prediction = normalizePrediction(o.prediction, approval_score);

  return {
    approval_score,
    prediction,
    reasoning,
    risks: toStringArray(o.risks),
    similar_cases: normalizeSimilarCases(o.similar_cases, 3),
  };
}

export type EvaluateDesignApprovalInput = {
  image_url: string;
  description: string;
  /** `Past case` 행 배열을 JSON.stringify 한 문자열 (프롬프트에 그대로 삽입) */
  past_cases_json: string;
};

function buildUserPrompt(description: string, past_cases_json: string): string {
  const desc = description.trim() || "(없음)";
  return `당신은 디자인 승인 여부를 과거 사례만 근거로 평가합니다.

일반적인 디자인 조언은 하지 마세요.

중요: JSON 안의 사람이 읽는 문자열(reasoning, risks 배열 각 항목, similar_cases[].reason)은 반드시 한국어로만 작성하세요. 영어 사용 금지.
(similar_cases[].description은 과거 사례 JSON에 적힌 그대로 복사해도 됩니다.)

---

과거 사례:
${past_cases_json}

---

새 시안:
- 설명: ${desc}

---

작업:

1. 승인 점수 0–100 예측
2. 구간 분류: low(≤33) · mid(34~66) · high(≥67)
3. 위 예측 근거를 과거 패턴에 기반해 한국어로 reasoning에 서술
4. 거절 위험이 있다면 risks에 한국어로 구체적 사유 나열
5. 가장 유사한 과거 사례 최대 3개:
   - 선택한 사례의 "id"를 case_id에 그대로 복사
   - description·result는 사례와 동일
   - reason: 해당 사례와 새 시안의 유사점·비교를 한국어로 짧게

---

오직 JSON만 반환:

{
  "approval_score": number,
  "prediction": "low" | "mid" | "high",
  "reasoning": "",
  "risks": [],
  "similar_cases": [
    {
      "case_id": "",
      "description": "",
      "result": "Approved" | "Rejected",
      "reason": ""
    }
  ]
}`;
}

/**
 * 과거 사례 JSON + 시안 설명(± 이미지)으로 승인 예측 JSON을 반환합니다.
 */
export async function evaluateDesignApproval({
  image_url,
  description,
  past_cases_json,
}: EvaluateDesignApprovalInput): Promise<DesignApprovalEvaluation | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return null;
  }

  const img = String(image_url ?? "").trim();
  const casesBlock = past_cases_json.trim() || "[]";

  let userText = buildUserPrompt(String(description ?? ""), casesBlock);
  if (img) {
    userText += `

참고: 시안 이미지가 첨부되었습니다. 과거 사례에서 드러나는 패턴과만 연결해 해석하고, 일반적인 디자인 팁은 쓰지 마세요. reasoning·risks·유사 사례 reason은 모두 한국어로 작성하세요.`;
  }

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
        model: "gpt-4o",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: [
              "You output only valid JSON objects. No markdown fences.",
              "Keys and prediction values stay as specified (e.g. Approved/Rejected, low/mid/high).",
              "Every user-facing string (reasoning, each risks[] item, similar_cases[].reason) MUST be Korean only. No English in those fields.",
            ].join(" "),
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });
  } catch (e) {
    console.error("[evaluateDesignApproval] fetch 실패:", e);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[evaluateDesignApproval] 응답 JSON 파싱 실패");
    return null;
  }

  if (!res.ok) {
    console.error("[evaluateDesignApproval] OpenAI HTTP 오류:", res.status, data);
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
