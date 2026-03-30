"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { ProjectTable } from "../../components/ProjectTable";
import { useStore } from "../providers";

export default function DashboardPage() {
  const { state } = useStore();
  const [visibleCount, setVisibleCount] = useState(3);
  const [feedbackVisibleCount, setFeedbackVisibleCount] = useState(5);

  const activeProjectTotal = useMemo(
    () => (state.projects ?? []).filter((p) => !p.deleted).length,
    [state.projects],
  );

  const recentFeedback = useMemo(() => {
    const outputs = state.outputs ?? [];
    return [...outputs]
      .filter((o) => !o.deleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
  }, [state.outputs]);

  const visibleFeedbackItems = recentFeedback.slice(0, feedbackVisibleCount);
  const canLoadMoreFeedback =
    feedbackVisibleCount <
    Math.min(10, recentFeedback.length);

  const canLoadMore = visibleCount < activeProjectTotal;
  const isExpanded =
    activeProjectTotal > 0 && visibleCount >= activeProjectTotal;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Welcome to Vizer
        </h1>
        <p className="text-sm text-zinc-500">
          "피드백의 복리" CEO의 피드백 한번은 100개의 자산이 된다.
        </p>
      </header>

      {/* Project List */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="whitespace-nowrap text-lg font-semibold text-zinc-900">
            프로젝트 리스트
          </h2>

          <div className="relative w-[220px] max-w-full shrink-0">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="text"
              placeholder="프로젝트를 검색하세요."
              className="w-full rounded-lg border-none bg-zinc-50 py-1.5 pl-8 pr-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        <ProjectTable
          limit={visibleCount}
          readOnly
          showDetail={false}
        />

        <div className="mt-3 space-y-2 text-xs">
          {canLoadMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 5)}
              className="flex items-center gap-1 text-xs text-zinc-500 mt-2"
            >
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
              더 불러오기
            </button>
          )}
          {isExpanded && (
            <button
              type="button"
              onClick={() => setVisibleCount(3)}
              className="flex items-center gap-1 text-xs text-zinc-500 mt-2"
            >
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
              접기
            </button>
          )}
          <div className="border-t border-zinc-200/60 pt-2">
            <div className="inline-flex cursor-pointer rounded px-1 py-0.5 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900">
              + 새 프로젝트
            </div>
          </div>
        </div>
      </section>

      {/* 피드백 통계 + 최근 피드백 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 왼쪽 카드: 피드백 통계 */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-5 text-sm leading-relaxed text-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900">피드백 통계</h2>
            <p className="mt-3 text-xs text-zinc-600">
              최근 30일간 Vizer에 기록된 피드백을 분석했습니다.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-xs font-medium text-zinc-500">
                가장 많이 거절된 이유
              </p>
              <div className="space-y-1 text-xs text-zinc-800">
                <p>레이아웃 복잡성 42%</p>
                <p>텍스트 밀도 27%</p>
                <p>CTA 강조 부족 18%</p>
              </div>
            </div>
          </div>

          {/* 오른쪽 카드: 최근 피드백 */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-5 text-sm">
            <h2 className="text-sm font-semibold text-zinc-900">최근 피드백</h2>
            <div className="mt-3 space-y-3">
              {visibleFeedbackItems.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  아직 등록된 피드백이 없습니다. 아카이브에서 시안을 업로드해 보세요.
                </p>
              ) : (
                visibleFeedbackItems.map((item) => {
                  const status =
                    item.status === "Rejected" ? "rejected" : "accepted";
                  const accepted = status === "accepted";
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-md border border-zinc-100 bg-white p-3"
                    >
                      <div className="aspect-square w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex w-full items-center justify-between gap-2">
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              accepted
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                            }`}
                          >
                            {accepted ? (
                              <>
                                <Check
                                  className="h-3 w-3 shrink-0"
                                  aria-hidden
                                />
                                승인됨
                              </>
                            ) : (
                              <>
                                <X className="h-3 w-3 shrink-0" aria-hidden />
                                거절됨
                              </>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-zinc-400">
                            {item.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <div className="mt-2 min-w-0 overflow-hidden text-sm text-zinc-700 line-clamp-2 break-words">
                          {item.reason}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {canLoadMoreFeedback && (
              <button
                type="button"
                onClick={() =>
                  setFeedbackVisibleCount((c) => Math.min(c + 5, 10))
                }
                className="mt-3 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
              >
                <span aria-hidden>↓</span>
                더 불러오기
              </button>
            )}
            <button
              type="button"
              className="mt-4 text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/archive";
                }
              }}
            >
              더 보러가기 →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

