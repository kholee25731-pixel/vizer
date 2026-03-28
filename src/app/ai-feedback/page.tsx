"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CustomDropdown } from "../../components/CustomDropdown";
import {
  type AiFeedbackHistoryEntry,
  type AiSimilarPastCase,
  useStore,
} from "../providers";

/** AI 피드백 설명(본문) — 분석 패널과 히스토리 카드에서 동일 문구 사용 */
const AI_FEEDBACK_EXPLANATION_PARAGRAPHS = [
  "이 시안은 기존 승인된 디자인과 유사한 구조를 가지고 있습니다. CTA 버튼의 위치가 명확하며 정보 계층 구조가 잘 드러납니다.",
  "다만 텍스트 밀도가 높은 영역이 있어 가독성이 일부 떨어질 수 있습니다.",
] as const;

const MIN_FEEDBACK_FOR_AI = 20;

function historyExplanationText(entry: AiFeedbackHistoryEntry): string {
  const t = entry.aiExplanation?.trim();
  if (t) return t;
  return AI_FEEDBACK_EXPLANATION_PARAGRAPHS.join(" ");
}

/** 점수 0–100 환산: ≤33 low, 34–66 mid, ≥67 high */
function approvalProbabilityTier(
  p: number,
): "low" | "mid" | "high" {
  const pct = Math.round(p * 100);
  if (pct <= 33) return "low";
  if (pct <= 66) return "mid";
  return "high";
}

function historyTier(entry: AiFeedbackHistoryEntry): "low" | "mid" | "high" {
  if (entry.prediction) return entry.prediction;
  return approvalProbabilityTier(entry.approvalProbability);
}

export default function AiFeedbackPage() {
  const { state, createProject, prependAiFeedbackHistory } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProjects = useMemo(
    () => (state.projects ?? []).filter((p) => !p.deleted),
    [state.projects],
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "";
    return (
      activeProjects.find((p) => p.id === selectedProjectId)?.name ?? ""
    );
  }, [activeProjects, selectedProjectId]);

  const feedbackCount = useMemo(() => {
    if (!selectedProjectId) return 0;
    return (state.outputs ?? []).filter(
      (o) => o.projectId === selectedProjectId && !o.deleted,
    ).length;
  }, [state.outputs, selectedProjectId]);

  const isLocked = feedbackCount < MIN_FEEDBACK_FOR_AI;

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const selectedFileName = selectedFile?.name ?? null;
  const [preview, setPreview] = useState<string | null>(null);
  const [designDescription, setDesignDescription] = useState("");
  const [feedbackRequested, setFeedbackRequested] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [latestSessionFeedback, setLatestSessionFeedback] =
    useState<AiFeedbackHistoryEntry | null>(null);

  useEffect(() => {
    if (!selectedFile && !designDescription.trim()) {
      setFeedbackRequested(false);
      setLatestSessionFeedback(null);
    }
  }, [selectedFile, designDescription]);

  useEffect(() => {
    setFeedbackError(null);
  }, [selectedProjectId, selectedFile]);

  const setImageFile = (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const requestAiFeedback = useCallback(async () => {
    setFeedbackError(null);
    if (!selectedProjectId) {
      setFeedbackError("프로젝트를 선택해주세요.");
      return;
    }
    const countForProject = (state.outputs ?? []).filter(
      (o) => o.projectId === selectedProjectId && !o.deleted,
    ).length;
    if (countForProject < MIN_FEEDBACK_FOR_AI) {
      setFeedbackError(
        `AI 평가를 사용하시려면, 최소 ${MIN_FEEDBACK_FOR_AI}개의 피드백 아카이브가 필요합니다.`,
      );
      return;
    }
    const desc = designDescription.trim();
    const imageUrl = preview?.trim() ?? "";
    if (!desc && !imageUrl) {
      setFeedbackError("시안 이미지를 올리거나 시안 설명을 입력해주세요.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setFeedbackError("로그인이 필요합니다.");
      return;
    }

    setFeedbackRequested(true);
    setFeedbackLoading(true);
    setLatestSessionFeedback(null);

    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: selectedProjectId,
          description: desc,
          image_url: imageUrl,
        }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const rec = data as {
        approval_score?: unknown;
        prediction?: unknown;
        reasoning?: unknown;
        risks?: unknown;
        similar_cases?: unknown;
        error?: unknown;
        message?: unknown;
        detail?: unknown;
        current?: unknown;
      };

      if (!res.ok) {
        const friendly =
          typeof rec.message === "string" && rec.message.trim() !== ""
            ? rec.message
            : typeof rec.error === "string"
              ? rec.error
              : "요청에 실패했습니다.";
        const detail =
          typeof rec.detail === "string" ? ` (${rec.detail})` : "";
        const currentHint =
          typeof rec.current === "number" && rec.error === "NOT_ENOUGH_DATA"
            ? ` (현재 ${rec.current}개)`
            : "";
        setFeedbackError(friendly + currentHint + detail);
        setFeedbackRequested(false);
        return;
      }

      const reasoning =
        typeof rec.reasoning === "string" ? rec.reasoning.trim() : "";
      const scoreRaw = Number(rec.approval_score);
      const predRaw = rec.prediction;
      const prediction =
        predRaw === "low" || predRaw === "mid" || predRaw === "high"
          ? predRaw
          : undefined;
      if (!reasoning || Number.isNaN(scoreRaw)) {
        setFeedbackError("응답 형식이 올바르지 않습니다.");
        setFeedbackRequested(false);
        return;
      }

      /* API: approval_score 0–100 → UI approvalProbability = score/100 */
      const approvalProb = Math.min(
        1,
        Math.max(0, scoreRaw / 100),
      );

      const risks = Array.isArray(rec.risks)
        ? rec.risks
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        : [];

      const similarCases = Array.isArray(rec.similar_cases)
        ? rec.similar_cases
            .map((raw) => {
              if (!raw || typeof raw !== "object") return null;
              const o = raw as Record<string, unknown>;
              const d = String(o.description ?? "").trim();
              const r = String(o.reason ?? "").trim();
              const res: AiSimilarPastCase["result"] =
                o.result === "Rejected" ? "Rejected" : "Approved";
              if (!d && !r) return null;
              return {
                description: d || "(설명 없음)",
                result: res,
                reason: r || "(사유 없음)",
              } satisfies AiSimilarPastCase;
            })
            .filter((x): x is AiSimilarPastCase => x != null)
            .slice(0, 3)
        : [];

      const createdAt = new Date().toISOString();
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `eval-${Date.now()}`;

      const summaryReason =
        reasoning.length > 140 ? `${reasoning.slice(0, 137)}…` : reasoning;
      const entry: AiFeedbackHistoryEntry = {
        id,
        projectId: selectedProjectId,
        projectName: selectedProjectName,
        fileName: selectedFileName ?? "",
        description: desc,
        design_image_data_url: imageUrl || undefined,
        summaryReason,
        aiExplanation: reasoning /* API reasoning */,
        status: approvalProb >= 0.5 ? "Approved" : "Rejected",
        approvalProbability: approvalProb,
        createdAt,
        prediction,
        risks: risks.length ? risks : undefined,
        similarCases: similarCases.length ? similarCases : undefined,
      };
      prependAiFeedbackHistory(entry);
      setLatestSessionFeedback(entry);
    } catch (e) {
      console.error(e);
      setFeedbackError("네트워크 오류가 발생했습니다.");
      setFeedbackRequested(false);
    } finally {
      setFeedbackLoading(false);
    }
  }, [
    designDescription,
    prependAiFeedbackHistory,
    preview,
    selectedFileName,
    selectedProjectId,
    selectedProjectName,
    state.outputs,
  ]);

  const approvalProbability = latestSessionFeedback?.approvalProbability ?? 0.55;

  /** API `prediction` 우선, 없으면 점수 구간으로 복원 */
  const indicatorTier = useMemo((): "low" | "mid" | "high" => {
    if (latestSessionFeedback?.prediction) {
      return latestSessionFeedback.prediction;
    }
    return approvalProbabilityTier(approvalProbability);
  }, [latestSessionFeedback?.prediction, approvalProbability]);

  const showAiPanels = feedbackRequested;

  const recentAiFeedback = useMemo(() => {
    const all = state.aiFeedbackHistory ?? [];
    return [...all]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
  }, [state.aiFeedbackHistory]);

  const indicator = useMemo(() => {
    if (indicatorTier === "high") {
      return {
        label: "승인 가능성 높음",
        tone: "emerald",
        icon: CheckCircle2,
      } as const;
    }
    if (indicatorTier === "mid") {
      return {
        label: "보통",
        tone: "amber",
        icon: AlertTriangle,
      } as const;
    }
    return {
      label: "거절 위험",
      tone: "rose",
      icon: XCircle,
    } as const;
  }, [indicatorTier]);

  return (
    <div className="space-y-6">
      {/* Header — aligned with Feedback Archive */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            AI 피드백
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            디자인 시안을 업로드하고, Vizer에게 피드백 받으세요.
          </p>
        </div>
      </header>

      {/* SECTION 1 — Upload Draft (grid matches Feedback Archive) */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {/* Left: label + mt-2 + dropzone (fills column height) */}
          <div className="flex min-h-0 flex-col">
            <p className="text-xs font-medium text-zinc-500">시안 업로드</p>
            <div className="mt-2 shrink-0">
              <label
                className={`group relative block h-[280px] w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed shadow-sm transition-colors ${
                  isDragging
                    ? "border-sky-400 bg-sky-200/20"
                    : "border-zinc-300 bg-white hover:border-zinc-400"
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) setImageFile(file);
                  setIsDragging(false);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) setImageFile(file);
                  }}
                />
                <div className="relative h-full w-full">
                  {!preview ? (
                    <>
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="h-full w-full bg-sky-200/20" />
                      </div>
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                        <UploadCloud className="h-12 w-12 text-zinc-400" />
                        <p className="text-sm font-medium text-zinc-700">
                          이미지를 드래그 앤 드롭 하거나 업로드하세요
                        </p>
                        <p className="text-xs text-zinc-500">
                          {selectedFileName
                            ? `선택됨: ${selectedFileName}`
                            : "PNG, JPG 등 이미지 파일 지원"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-full w-full items-center justify-center bg-zinc-50/80">
                        <img
                          src={preview}
                          alt="미리보기"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
                        이미지 변경
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Right: full height — project + description (Archive right column pattern) */}
          <div className="flex h-full min-h-0 w-full flex-col justify-between">
            <div className="shrink-0 space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  프로젝트 선택
                </p>
                <div className="mt-2 w-full min-w-0">
                  <CustomDropdown
                    triggerType="status"
                    options={activeProjects.map((p) => p.name)}
                    optionValues={activeProjects.map((p) => p.id)}
                    value={selectedProjectId}
                    onChange={setSelectedProjectId}
                    placeholder="프로젝트를 선택해주세요."
                    onCreateNew={async (name) => {
                      try {
                        const p = await createProject({
                          name,
                          description: "",
                          category: "미분류",
                          leader: "미선택",
                        });
                        setSelectedProjectId(p.id);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <p className="text-xs font-medium text-zinc-500">시안 설명</p>
              <div className="relative mt-2 flex min-h-0 flex-1 flex-col">
                <textarea
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                  placeholder="이 시안에 대한 설명이나 의도를 기록하세요."
                  className="min-h-[180px] w-full flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pb-14 pr-32 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <button
                  type="button"
                  disabled={feedbackLoading || isLocked}
                  aria-busy={feedbackLoading}
                  title={
                    isLocked
                      ? `AI 평가를 사용하시려면, 최소 ${MIN_FEEDBACK_FOR_AI}개의 피드백 아카이브가 필요합니다.`
                      : undefined
                  }
                  onClick={() => void requestAiFeedback()}
                  className="absolute bottom-[20px] right-[20px] z-10 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {feedbackLoading ? "분석 중…" : "피드백 요청 →"}
                </button>
              </div>
              {isLocked && selectedProjectId ? (
                <p className="mt-2 text-xs font-medium text-amber-800">
                  {`AI 평가를 사용하시려면, 최소 ${MIN_FEEDBACK_FOR_AI}개의 피드백 아카이브가 필요합니다.`}
                </p>
              ) : null}
              {feedbackError ? (
                <p className="mt-2 text-xs font-medium text-rose-600">
                  {feedbackError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {showAiPanels ? (
        <>
          {/* SECTION 2 — AI Prediction Result */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  AI 분석 결과
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {latestSessionFeedback
                    ? "과거 승인·거절 사례만 근거로 예측 · gpt-4o-mini"
                    : feedbackLoading
                      ? "분석 중…"
                      : "프로젝트·시안을 보내 AI 피드백을 받습니다."}
                </p>
              </div>
              <button
                type="button"
                disabled={feedbackLoading || isLocked}
                title={
                  isLocked
                    ? `AI 평가를 사용하시려면, 최소 ${MIN_FEEDBACK_FOR_AI}개의 피드백 아카이브가 필요합니다.`
                    : undefined
                }
                onClick={() => void requestAiFeedback()}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${feedbackLoading ? "animate-spin" : ""}`}
                  aria-hidden
                />
                <span>분석 재실행</span>
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-medium text-zinc-500">승인 점수</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
                  {feedbackLoading && !latestSessionFeedback
                    ? "—"
                    : `${Math.round(approvalProbability * 100)}점`}
                </p>
                {latestSessionFeedback?.prediction ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    예측 구간:{" "}
                    {latestSessionFeedback.prediction === "high"
                      ? "높음 (67–100)"
                      : latestSessionFeedback.prediction === "mid"
                        ? "중간 (34–66)"
                        : "낮음 (0–33)"}
                  </p>
                ) : null}
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  indicator.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50"
                    : indicator.tone === "amber"
                      ? "border-amber-200 bg-amber-50"
                      : "border-rose-200 bg-rose-50"
                }`}
              >
                <p className="text-xs font-medium text-zinc-500">
                  피드백 예측
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <indicator.icon
                    className={`h-5 w-5 ${
                      indicator.tone === "emerald"
                        ? "text-emerald-700"
                        : indicator.tone === "amber"
                          ? "text-amber-700"
                          : "text-rose-700"
                    }`}
                  />
                  <p
                    className={`text-sm font-semibold ${
                      indicator.tone === "emerald"
                        ? "text-emerald-800"
                        : indicator.tone === "amber"
                          ? "text-amber-800"
                          : "text-rose-800"
                    }`}
                  >
                    {indicator.label}
                  </p>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  프로젝트: {selectedProjectName || "—"}
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 3 — reasoning (API) → aiExplanation */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              AI 피드백 설명
            </h2>
            <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
              {feedbackLoading && !latestSessionFeedback ? (
                <p className="text-zinc-500">AI가 피드백을 작성 중입니다…</p>
              ) : latestSessionFeedback?.aiExplanation ? (
                latestSessionFeedback.aiExplanation
                  .split(/\n\n+/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} className={i > 0 ? "mt-3" : undefined}>
                      {para}
                    </p>
                  ))
              ) : (
                AI_FEEDBACK_EXPLANATION_PARAGRAPHS.map((para, i) => (
                  <p key={i} className={i > 0 ? "mt-3" : undefined}>
                    {para}
                  </p>
                ))
              )}
            </div>
          </section>

          {/* SECTION 4 — risks (API) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">위험 신호</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-800">
              {feedbackLoading && !latestSessionFeedback ? (
                <li className="text-zinc-500">분석 중…</li>
              ) : latestSessionFeedback?.risks?.length ? (
                latestSessionFeedback.risks.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>{t}</span>
                  </li>
                ))
              ) : (
                <li className="flex items-center gap-2 text-zinc-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span>명시된 위험 요소 없음</span>
                </li>
              )}
            </ul>
          </section>

          {/* SECTION 5 — similar_cases (API) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">유사 사례</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {feedbackLoading && !latestSessionFeedback ? (
                <p className="col-span-full text-sm text-zinc-500">분석 중…</p>
              ) : latestSessionFeedback?.similarCases?.length ? (
                latestSessionFeedback.similarCases.map((c, idx) => {
                  const approved = c.result === "Approved";
                  return (
                    <article
                      key={`${c.description}-${c.reason}-${idx}`}
                      className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <div className="flex min-h-[4.5rem] items-center border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                        <p className="line-clamp-3 text-xs leading-relaxed text-zinc-700">
                          {c.description}
                        </p>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            approved
                              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                              : "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                          }`}
                        >
                          {approved ? "승인" : "거절"}
                        </span>
                        <p className="text-sm font-medium text-zinc-900">
                          “{c.reason}”
                        </p>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="col-span-full text-sm text-zinc-500">
                  유사하게 매칭된 과거 사례가 없습니다. 피드백 아카이브에 사례를
                  더 쌓으면 비교에 활용됩니다.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">
          최근 AI 피드백
        </h3>
        {recentAiFeedback.length > 0 ? (
          <div className="space-y-3">
            {recentAiFeedback.map((item) => {
              const tier = historyTier(item);
              const pct = Math.round(item.approvalProbability * 100);
              const blockClass =
                tier === "low"
                  ? "border-rose-200 bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                  : tier === "mid"
                    ? "border-amber-200 bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
              const iconClass =
                tier === "low"
                  ? "text-rose-600"
                  : tier === "mid"
                    ? "text-amber-700"
                    : "text-emerald-700";

              return (
                <article
                  key={item.id}
                  className="flex h-32 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="h-32 w-32 shrink-0 overflow-hidden bg-zinc-100">
                    {item.design_image_data_url ? (
                      <img
                        src={item.design_image_data_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-1 text-center text-[11px] text-zinc-400">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-y-1">
                      <div className="flex min-w-0 max-w-full items-center gap-2">
                        <div
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-semibold ${blockClass}`}
                        >
                          {tier === "low" ? (
                            <X
                              className={`h-4 w-4 shrink-0 ${iconClass}`}
                              strokeWidth={2.5}
                              aria-hidden
                            />
                          ) : tier === "mid" ? (
                            <AlertTriangle
                              className={`h-4 w-4 shrink-0 ${iconClass}`}
                              aria-hidden
                            />
                          ) : (
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 ${iconClass}`}
                              aria-hidden
                            />
                          )}
                          <span>승인 점수 {pct}점</span>
                        </div>
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                          {item.projectName}
                        </span>
                      </div>
                      <time
                        className="shrink-0 text-xs text-zinc-400"
                        dateTime={item.createdAt}
                      >
                        {item.createdAt.slice(0, 10)}
                      </time>
                    </div>
                    <p className="line-clamp-3 min-w-0 text-sm leading-relaxed text-zinc-700">
                      {historyExplanationText(item)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            아직 이 페이지에서 요청한 AI 피드백이 없습니다. 시안을 올리고
            「피드백 요청」을 누르면 여기에 쌓입니다.
          </p>
        )}
      </section>
    </div>
  );
}

