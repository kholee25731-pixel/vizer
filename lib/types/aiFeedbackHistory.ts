import type { OutputStatus } from "@/lib/db/codec";

export type AiSimilarPastCase = {
  description: string;
  result: OutputStatus;
  reason: string;
};

export type AiFeedbackHistoryEntry = {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  description: string;
  design_image_data_url?: string;
  summaryReason: string;
  aiExplanation?: string;
  status: OutputStatus;
  approvalProbability: number;
  createdAt: string;
  prediction?: "low" | "mid" | "high";
  risks?: string[];
  similarCases?: AiSimilarPastCase[];
};
