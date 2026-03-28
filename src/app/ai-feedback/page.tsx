"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { CustomDropdown } from "../../components/CustomDropdown";
import { type AiFeedbackHistoryEntry, useStore } from "../providers";

/** AI 피드백 설명(본문) — 분석 패널과 히스토리 카드에서 동일 문구 사용 */
const AI_FEEDBACK_EXPLANATION_PARAGRAPHS = [
  "이 시안은 기존 승인된 디자인과 유사한 구조를 가지고 있습니다. CTA 버튼의 위치가 명확하며 정보 계층 구조가 잘 드러납니다.",
  "다만 텍스트 밀도가 높은 영역이 있어 가독성이 일부 떨어질 수 있습니다.",
] as const;

const AI_FEEDBACK_EXPLANATION_FULL =
  AI_FEEDBACK_EXPLANATION_PARAGRAPHS.join("\n\n");

function historyExplanationText(entry: AiFeedbackHistoryEntry): string {
  const t = entry.aiExplanation?.trim();
  if (t) return t;
  return AI_FEEDBACK_EXPLANATION_PARAGRAPHS.join(" ");
}

/** 0~1 확률 → 구간: ≤33% 거절톤, 33~66% 주의, ≥66% 승인톤 */
function approvalProbabilityTier(
  p: number,
): "low" | "mid" | "high" {
  const pct = p * 100;
  if (pct <= 33) return "low";
  if (pct < 66) return "mid";
  return "high";
}

type PredictionLevel = "high" | "medium" | "risk";

function levelFromProbability(p: number): PredictionLevel {
  if (p >= 0.7) return "high";
  if (p >= 0.45) return "medium";
  return "risk";
}

function predictionLabelFromProbability(p: number): string {
  if (p >= 0.7) return "승인 가능성: 높음";
  if (p >= 0.45) return "승인 가능성: 보통";
  return "거절 위험: 높음";
}

export default function AiFeedbackPage() {
  const { state, createProject, addAiFeedbackHistory } = useStore();
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
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const selectedFileName = selectedFile?.name ?? null;
  const [preview, setPreview] = useState<string | null>(null);
  const [designDescription, setDesignDescription] = useState("");
  const [feedbackRequested, setFeedbackRequested] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) setFeedbackRequested(false);
  }, [selectedFile]);

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

  // Mock prediction result for now.
  const approvalProbability = 0.72;
  const level = useMemo(
    () => levelFromProbability(approvalProbability),
    [approvalProbability],
  );
  const hasUpload = Boolean(selectedFileName);
  const showAiPanels = hasUpload && feedbackRequested;

  const recentAiFeedback = useMemo(() => {
    const all = state.aiFeedbackHistory ?? [];
    return [...all]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
  }, [state.aiFeedbackHistory]);

  const indicator = useMemo(() => {
    if (level === "high") {
      return {
        label: "승인 가능성: 높음",
        tone: "emerald",
        icon: CheckCircle2,
      } as const;
    }
    if (level === "medium") {
      return {
        label: "승인 가능성: 보통",
        tone: "amber",
        icon: AlertTriangle,
      } as const;
    }
    return {
      label: "거절 위험: 높음",
      tone: "rose",
      icon: XCircle,
    } as const;
  }, [level]);

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
                    onCreateNew={(name) => {
                      const p = createProject({
                        name,
                        description: "",
                        category: "미분류",
                        leader: "미선택",
                      });
                      setSelectedProjectId(p.id);
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
                  onClick={() => {
                    setFeedbackError(null);
                    if (!selectedProjectId) {
                      setFeedbackError("프로젝트를 선택해주세요.");
                      return;
                    }
                    if (!selectedFile) {
                      setFeedbackError("시안 이미지를 업로드해주세요.");
                      return;
                    }
                    setFeedbackRequested(true);

                    const file = selectedFile;
                    const predLabel =
                      predictionLabelFromProbability(approvalProbability);
                    const pct = Math.round(approvalProbability * 100);
                    const summaryReason = [
                      `${predLabel} (${pct}%)`,
                      designDescription.trim() || file.name,
                    ].join(" · ");

                    const payload = {
                      projectId: selectedProjectId,
                      projectName: selectedProjectName,
                      fileName: file.name,
                      description: designDescription.trim(),
                      summaryReason,
                      aiExplanation: AI_FEEDBACK_EXPLANATION_FULL,
                      status:
                        (approvalProbability >= 0.5
                          ? "Approved"
                          : "Rejected") as const,
                      approvalProbability,
                    };

                    if (preview) {
                      addAiFeedbackHistory({
                        ...payload,
                        design_image_data_url: preview,
                      });
                    } else {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        addAiFeedbackHistory({
                          ...payload,
                          design_image_data_url:
                            typeof reader.result === "string"
                              ? reader.result
                              : undefined,
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="absolute bottom-[20px] right-[20px] z-10 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-900"
                >
                  피드백 요청 →
                </button>
              </div>
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
                  최근 의사결정/피드백 패턴 기반 예측 (예시 데이터)
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                <span>분석 재실행</span>
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-medium text-zinc-500">승인될 확률</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
                  {Math.round(approvalProbability * 100)}%
                </p>
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

          {/* SECTION 3 — AI Feedback Explanation */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              AI 피드백 설명
            </h2>
            <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800">
              {AI_FEEDBACK_EXPLANATION_PARAGRAPHS.map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : undefined}>
                  {para}
                </p>
              ))}
            </div>
          </section>

          {/* SECTION 4 — Risk Signals */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">위험 신호</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-800">
              {[
                "텍스트 가독성 문제 가능성",
                "CTA 강조 부족",
                "정보 밀도 과다",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* SECTION 5 — Similar Past Cases */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              유사 과거 사례
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                {
                  id: 1,
                  status: "Rejected" as const,
                  reason: "레이아웃이 너무 복잡함",
                  project: "수상한 스튜디오 리뉴얼",
                },
                {
                  id: 2,
                  status: "Approved" as const,
                  reason: "CTA 버튼 강조",
                  project: "26 재계약식_어나더 운동회",
                },
                {
                  id: 3,
                  status: "Approved" as const,
                  reason: "정보 위계가 명확함",
                  project: "26 코엑스_K-Edu",
                },
              ].map((c) => {
                const approved = c.status === "Approved";
                return (
                  <article
                    key={c.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="flex h-28 items-center justify-center bg-zinc-100 text-[11px] font-medium text-zinc-500">
                      썸네일
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
                      <p className="text-xs text-zinc-500">프로젝트</p>
                      <p className="text-xs font-medium text-zinc-800">
                        {c.project}
                      </p>
                    </div>
                  </article>
                );
              })}
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
              const tier = approvalProbabilityTier(item.approvalProbability);
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
                          <span>승인될 확률 {pct}%</span>
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

