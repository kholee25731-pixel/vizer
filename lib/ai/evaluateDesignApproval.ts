export type SimilarPastCase = {
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
    if (!description && !reason) continue;
    out.push({
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
  const desc = description.trim() || "(none)";
  return `You are a design approval evaluator.

Your job is to predict whether a design will be approved,
based ONLY on past cases.

Do NOT give general design advice.

---

Past cases:
${past_cases_json}

---

New design:
- description: ${desc}

---

Task:

1. Predict approval score (0-100)
2. Classify:
   - low (≤33)
   - mid (34~66)
   - high (≥67)

3. Explain why (based on past patterns)

4. List risks (specific rejection reasons)

5. Select 3 most similar past cases:
   - include result (Approved / Rejected)
   - include reason

---

Return ONLY JSON:

{
  "approval_score": number,
  "prediction": "low" | "mid" | "high",
  "reasoning": "",
  "risks": [],
  "similar_cases": [
    {
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

Note: A design image is attached. Use it only to relate this draft to patterns implied by the past cases (do not give generic design tips).`;
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
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON objects. No markdown fences. Field strings may be in Korean.",
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
