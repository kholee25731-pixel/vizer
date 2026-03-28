"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useStore } from "../../providers";

export default function ProjectDetailPage() {
  const params = useParams();
  const { state } = useStore();
  const projectId = params?.id as string;

  const project = useMemo(
    () => (state.projects ?? []).find((p) => p.id === projectId),
    [state.projects, projectId],
  );

  const outputs = useMemo(() => {
    return (state.outputs ?? []).filter(
      (o) => o.projectId === projectId && !o.deleted,
    );
  }, [state.outputs, projectId]);

  const approved = outputs.filter((o) => o.status === "Approved");
  const rejected = outputs.filter((o) => o.status === "Rejected");

  if (!project) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          프로젝트를 찾을 수 없습니다.
        </h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          {project.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700">
            {project.category}
          </span>
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700">
            {project.leader}
          </span>
        </div>
        {project.description ? (
          <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">
            {project.description}
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">승인된 디자인</h2>
        {approved.length === 0 ? (
          <p className="text-xs text-zinc-500">아직 승인된 디자인 시안이 없습니다.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {approved.map((o) => (
              <article
                key={o.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="flex h-24 items-center justify-center bg-zinc-100 text-[11px] font-medium text-zinc-500">
                  thumbnail
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                      Approved
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {o.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700">{o.reason}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">거절된 디자인</h2>
        {rejected.length === 0 ? (
          <p className="text-xs text-zinc-500">아직 거절된 디자인 시안이 없습니다.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {rejected.map((o) => (
              <article
                key={o.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="flex h-24 items-center justify-center bg-zinc-100 text-[11px] font-medium text-zinc-500">
                  thumbnail
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 ring-1 ring-rose-200">
                      Rejected
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {o.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700">{o.reason}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

