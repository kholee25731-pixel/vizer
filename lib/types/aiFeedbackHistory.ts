import type { OutputStatus } from "@/lib/db/codec";

export type AiSimilarPastCase = {
  feedback_id?: string;
  image_url?: string | null;
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
  image_url: string | null;
  summaryReason: string;
  aiExplanation?: string;
  status: OutputStatus;
  approvalProbability: number;
  createdAt: string;
  prediction?: "low" | "mid" | "high";
  risks?: string[];
  similarCases?: AiSimilarPastCase[];
};
