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
