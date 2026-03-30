export type OutputType = "design" | "copy";
export type OutputStatus = "Approved" | "Rejected";

export type CreativeOutputFields = {
  output_type: OutputType;
  status: OutputStatus;
  reason: string;
  description: string;
  tags?: string[];
  copy_text?: string;
};

const FB_VER = 1 as const;

export type FeedbackMeta = CreativeOutputFields & { v: typeof FB_VER };

export function encodeFeedbackContent(o: CreativeOutputFields): string {
  const meta: FeedbackMeta = {
    v: FB_VER,
    output_type: o.output_type,
    status: o.status,
    reason: o.reason,
    description: o.description,
    tags: o.tags,
    copy_text: o.copy_text,
  };
  return JSON.stringify(meta);
}

/**
 * `ai_summary` 컬럼 값: 레거시(concept만) 또는 `{ concept, feedback_alignment }`.
 * 검색·과거 사례 프롬프트 등에서 사람이 읽을 한 덩어리 텍스트로 평탄화.
 */
export function plainTextFromStoredAiSummary(
  raw: string | null | undefined,
): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  try {
    const p = JSON.parse(s) as Record<string, unknown>;
    if (
      p &&
      typeof p.concept === "object" &&
      p.concept !== null &&
      !Array.isArray(p.concept)
    ) {
      const c = p.concept as Record<string, unknown>;
      const parts = [
        String(c.main ?? "").trim(),
        String(c.summary ?? "").trim(),
        ...(Array.isArray(c.keywords)
          ? c.keywords.map((x) => String(x ?? "").trim()).filter(Boolean)
          : []),
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(" ");
    }
    if (
      p &&
      typeof p === "object" &&
      ("main" in p || "summary" in p || "keywords" in p)
    ) {
      const main = String((p as { main?: unknown }).main ?? "").trim();
      const summary = String((p as { summary?: unknown }).summary ?? "").trim();
      const kws = Array.isArray((p as { keywords?: unknown }).keywords)
        ? ((p as { keywords: unknown[] }).keywords ?? [])
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        : [];
      const out = [main, summary, ...kws].filter(Boolean).join(" ");
      if (out) return out;
    }
  } catch {
    /* 본문이 JSON이 아니면 그대로 */
  }
  return s;
}

export function decodeFeedbackContent(content: string): CreativeOutputFields {
  try {
    const p = JSON.parse(content) as Partial<FeedbackMeta> & {
      description?: string;
      reason?: string;
    };
    if (p && p.v === FB_VER) {
      return {
        output_type: p.output_type === "copy" ? "copy" : "design",
        status: p.status === "Rejected" ? "Rejected" : "Approved",
        reason: String(p.reason ?? ""),
        description: String(p.description ?? ""),
        tags: Array.isArray(p.tags) ? p.tags.map(String) : undefined,
        copy_text:
          p.copy_text != null ? String(p.copy_text) : undefined,
      };
    }
  } catch {
    /* fallthrough */
  }
  return {
    output_type: "design",
    status: "Approved",
    reason: "",
    description: content || "",
  };
}

const AI_VER = 1 as const;

export type AiHistoryPayload = {
  v: typeof AI_VER;
  projectName: string;
  fileName: string;
  summaryReason: string;
  aiExplanation?: string;
  status: OutputStatus;
  approvalProbability: number;
};

export type AiHistoryEncodeInput = Omit<
  AiHistoryPayload,
  "v"
>;

export function encodeAiFeedbackContent(
  input: AiHistoryEncodeInput,
): string {
  const payload: AiHistoryPayload = {
    v: AI_VER,
    projectName: input.projectName,
    fileName: input.fileName,
    summaryReason: input.summaryReason,
    aiExplanation: input.aiExplanation,
    status: input.status,
    approvalProbability: input.approvalProbability,
  };
  return JSON.stringify(payload);
}

export function decodeAiFeedbackContent(
  raw: string,
): Omit<AiHistoryPayload, "v"> | null {
  try {
    const p = JSON.parse(raw) as Partial<AiHistoryPayload> & { v?: number };
    if (p && p.v === AI_VER) {
      return {
        projectName: String(p.projectName ?? ""),
        fileName: String(p.fileName ?? ""),
        summaryReason: String(p.summaryReason ?? ""),
        aiExplanation:
          p.aiExplanation != null ? String(p.aiExplanation) : undefined,
        status: p.status === "Rejected" ? "Rejected" : "Approved",
        approvalProbability: Number(p.approvalProbability ?? 0),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}
