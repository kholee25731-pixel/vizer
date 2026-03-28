"use client";

import { useMemo } from "react";
import { useStore } from "../providers";

function toDate(iso?: string) {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default function TrashPage() {
  const {
    state,
    restoreProject,
    deleteProjectPermanently,
    restoreOutput,
    deleteOutputPermanently,
  } = useStore();

  const deletedProjects = useMemo(
    () => (state.projects ?? []).filter((p) => p.deleted),
    [state.projects],
  );
  const deletedOutputs = useMemo(
    () => (state.outputs ?? []).filter((o) => o.deleted),
    [state.outputs],
  );

  const rows = useMemo(() => {
    const projectRows = deletedProjects.map((p) => ({
      id: p.id,
      name: p.name,
      type: "프로젝트" as const,
      deletedAt: p.deletedAt,
    }));
    const outputRows = deletedOutputs.map((o) => ({
      id: o.id,
      name: o.description || `디자인 시안 #${o.id}`,
      type: "시안" as const,
      deletedAt: o.deletedAt,
    }));
    return [...projectRows, ...outputRows].sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }, [deletedProjects, deletedOutputs]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          휴지통
        </h1>
        <p className="text-sm text-zinc-500">
          삭제된 프로젝트와 시안은 이곳에서 복구하거나 영구 삭제할 수 있습니다.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center gap-1 px-1 pb-1 text-xs font-medium text-zinc-500">
            <div>이름</div>
            <div>유형</div>
            <div>삭제 날짜</div>
            <div className="text-center">복구</div>
            <div className="text-center">영구 삭제</div>
          </div>
          <div className="border-t border-zinc-200/60">
            {rows.length === 0 ? (
              <div className="px-1 py-6 text-sm text-zinc-500">
                휴지통이 비어있습니다.
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={`${row.type}-${row.id}`}
                  className="grid grid-cols-[minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center border-b border-zinc-200/60 px-1 py-2"
                >
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {row.name}
                  </div>
                  <div className="text-xs text-zinc-700">{row.type}</div>
                  <div className="text-xs text-zinc-500">
                    {toDate(row.deletedAt)}
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (row.type === "프로젝트") restoreProject(row.id);
                        else restoreOutput(row.id);
                      }}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      복구
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (row.type === "프로젝트")
                          deleteProjectPermanently(row.id);
                        else deleteOutputPermanently(row.id);
                      }}
                      className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700"
                    >
                      영구 삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

