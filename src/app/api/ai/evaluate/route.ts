import {
  evaluateDesignApproval,
  type AiEvaluateApiSuccessBody,
  type SimilarPastCase,
} from "@/lib/ai/evaluateDesignApproval";
import {
  decodeFeedbackContent,
  plainTextFromStoredAiSummary,
  type OutputStatus,
} from "@/lib/db/codec";
import { createSupabaseForBearer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/** DB에서 가져온 전역 피드백 풀 최소 개수 (NOT_ENOUGH_DATA) */
const TOTAL_MIN_REQUIRED = 10;
/** 전역 피드백 풀 조회 상한 (최신순) */
const FETCH_LIMIT = 100;
/** 프롬프트에 넣는 과거 사례 최대 개수 */
const FINAL_CASES_MAX = 100;

export type PastCaseJsonRow = {
  id: string;
  description: string;
  result: OutputStatus;
  reason: string;
  tags?: string[];
};

function buildPastCasesJson(rows: Record<string, unknown>[]): string {
  const cases: PastCaseJsonRow[] = [];
  for (const row of rows) {
    const meta = decodeFeedbackContent(String(row.content ?? ""));
    const plainDesc =
      row.description != null && String(row.description).trim() !== ""
        ? String(row.description).trim()
        : meta.description.trim();
    const reason =
      meta.reason?.trim() ||
      plainTextFromStoredAiSummary(
        row.ai_summary != null ? String(row.ai_summary) : null,
      );
    const tags =
      meta.tags && meta.tags.length > 0
        ? meta.tags.map((t) => String(t).trim()).filter(Boolean)
        : undefined;
    const rec: PastCaseJsonRow = {
      id: String(row.id ?? ""),
      description: plainDesc || "(설명 없음)",
      result: meta.status,
      reason: reason || "(사유 없음)",
    };
    if (tags && tags.length > 0) rec.tags = tags;
    cases.push(rec);
  }
  return JSON.stringify(cases, null, 2);
}

function effectiveDescription(row: Record<string, unknown>): string {
  const meta = decodeFeedbackContent(String(row.content ?? ""));
  if (row.description != null && String(row.description).trim() !== "") {
    return String(row.description).trim();
  }
  return meta.description.trim();
}

function effectiveTags(row: Record<string, unknown>): string[] {
  const meta = decodeFeedbackContent(String(row.content ?? ""));
  if (!meta.tags?.length) return [];
  return meta.tags
    .map((t) => String(t).toLowerCase().trim())
    .filter((t) => t.length > 0);
}

function mergeCasesDedup(
  primary: Record<string, unknown>[],
  secondary: Record<string, unknown>[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const r of [...primary, ...secondary]) {
    const id = String(r.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

function rowSimilarToQuery(
  row: Record<string, unknown>,
  queryRaw: string,
): boolean {
  const queryLower = queryRaw.toLowerCase().trim();
  const queryWords = queryLower
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const rowDesc = effectiveDescription(row).toLowerCase();
  const tags = effectiveTags(row);

  if (queryWords.length === 0 && queryLower.length === 0) return false;

  if (rowDesc && queryWords.some((word) => rowDesc.includes(word))) {
    return true;
  }

  for (const tag of tags) {
    if (queryLower.includes(tag)) return true;
    if (
      tag.split(/[\s,./]+/).some(
        (tw) => tw.length > 0 && queryWords.includes(tw),
      )
    ) {
      return true;
    }
    if (queryWords.some((w) => w.length > 0 && tag.includes(w))) return true;
  }

  return false;
}

function rowPublicImageUrl(row: Record<string, unknown>): string | null {
  const a = row.image_url;
  if (a != null && String(a).trim() !== "") return String(a).trim();
  return null;
}

function normMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function feedbackRowMatchesCase(
  row: Record<string, unknown>,
  c: Pick<SimilarPastCase, "description" | "reason">,
): boolean {
  const meta = decodeFeedbackContent(String(row.content ?? ""));
  const plainDesc =
    row.description != null && String(row.description).trim() !== ""
      ? String(row.description).trim()
      : meta.description.trim();
  const reason =
    meta.reason?.trim() ||
    plainTextFromStoredAiSummary(
      row.ai_summary != null ? String(row.ai_summary) : null,
    );
  const dRow = normMatch(plainDesc || "(설명 없음)");
  const rRow = normMatch(reason || "(사유 없음)");
  const dC = normMatch(c.description);
  const rC = normMatch(c.reason);
  if (dRow === dC && rRow === rC) return true;
  if (dRow.length >= 8 && dC.length >= 8 && (dRow.includes(dC) || dC.includes(dRow))) {
    return rRow === rC || rRow.includes(rC) || rC.includes(rRow);
  }
  return false;
}

function enrichSimilarCasesFromRows(
  cases: SimilarPastCase[],
  rows: Record<string, unknown>[],
): SimilarPastCase[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const id = String(r.id ?? "").trim();
    if (id) byId.set(id, r);
  }
  return cases.map((c) => {
    let row: Record<string, unknown> | undefined;
    if (c.feedback_id && byId.has(c.feedback_id)) {
      row = byId.get(c.feedback_id);
    }
    if (!row) {
      row = rows.find((r) => feedbackRowMatchesCase(r, c));
    }
    if (!row) {
      return { ...c, image_url: c.image_url ?? null };
    }
    const id = String(row.id ?? "").trim();
    return {
      ...c,
      feedback_id: id || c.feedback_id,
      image_url: rowPublicImageUrl(row) ?? c.image_url ?? null,
    };
  });
}

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

    const { data: feedbackRows, error: fbError } = await supabase
      .from("feedbacks")
      .select(
        "id, content, description, ai_summary, created_at, deleted, project_id, image_url",
      )
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);

    if (fbError) {
      console.error("[api/ai/evaluate] feedbacks 조회:", fbError.message);
      return Response.json(
        { error: "피드백 조회에 실패했습니다.", detail: fbError.message },
        { status: 500 },
      );
    }

    if (!feedbackRows || feedbackRows.length < TOTAL_MIN_REQUIRED) {
      return Response.json(
        {
          error: "NOT_ENOUGH_DATA",
          message: `AI 평가를 사용하시려면, 최소 ${TOTAL_MIN_REQUIRED}개의 피드백 아카이브가 필요합니다.`,
          current: feedbackRows?.length ?? 0,
        },
        { status: 400 },
      );
    }

    const pool = (feedbackRows ?? []) as Record<string, unknown>[];

    const sameProject = pool.filter(
      (f) => String(f.project_id ?? "") === project_id,
    );

    const similar =
      description.trim() !== ""
        ? pool.filter((f) => rowSimilarToQuery(f, description))
        : [];

    const finalCases = mergeCasesDedup(sameProject, similar).slice(
      0,
      FINAL_CASES_MAX,
    );

    const past_cases_json = buildPastCasesJson(finalCases);

    const evaluated = await evaluateDesignApproval({
      image_url,
      description,
      past_cases_json,
    });

    if (!evaluated) {
      const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
      return Response.json(
        {
          error: hasKey
            ? "AI 평가에 실패했습니다."
            : "서버에 OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        { status: hasKey ? 502 : 500 },
      );
    }

    const similarWithThumbs = enrichSimilarCasesFromRows(
      evaluated.similar_cases,
      finalCases,
    );

    const successBody: AiEvaluateApiSuccessBody = {
      approval_score: Math.round(evaluated.approval_score),
      prediction: evaluated.prediction,
      reasoning: evaluated.reasoning,
      risks: evaluated.risks,
      similar_cases: similarWithThumbs,
    };
    return Response.json(successBody);
  } catch (e) {
    console.error("[api/ai/evaluate]", e);
    const message =
      e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
