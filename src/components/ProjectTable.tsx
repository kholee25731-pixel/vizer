"use client";

import { useMemo, useState } from "react";
import type { Project, ProjectCategory, ProjectCycle } from "../app/providers";
import { useStore } from "../app/providers";
import { CYCLES } from "../constants/taxonomy";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { CycleInfoModal } from "./CycleInfoModal";
import { CustomDropdown } from "./CustomDropdown";
import { LeadersManageModal } from "./LeadersManageModal";
import { Tag } from "./Tag";
import { WorkTypesManageModal } from "./WorkTypesManageModal";

type Props = {
  limit?: number;
  /** Dashboard 등: 메인 리더·워크타입·업무 방식 드롭다운 비활성, 읽기 전용 태그만 표시 */
  readOnly?: boolean;
  /** false: 상세(열기/접기) 컬럼 숨김 (대시보드 MVP) */
  showDetail?: boolean;
};

function toDate(iso: string) {
  if (iso.length >= 10) return iso.slice(0, 10);
  return iso;
}

function displayCycle(p: Project): ProjectCycle {
  return p.cycle === "루틴" || p.cycle === "단발성" ? p.cycle : "단발성";
}

export function ProjectTable({
  limit,
  readOnly = false,
  showDetail = true,
}: Props) {
  const { state, trashProject, addLeader, updateProject } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [workTypesModalOpen, setWorkTypesModalOpen] = useState(false);
  const [leadersModalOpen, setLeadersModalOpen] = useState(false);
  const [cycleInfoModalOpen, setCycleInfoModalOpen] = useState(false);

  const projects = useMemo<Project[]>(() => {
    const all = (state.projects ?? []).filter((p) => !p.deleted);
    return typeof limit === "number" ? all.slice(0, limit) : all;
  }, [state.projects, limit]);

  const leaderOptions = useMemo(
    () => ["미선택", ...state.leaders.filter((l) => l !== "미선택")],
    [state.leaders],
  );

  const grid = showDetail
    ? "grid grid-cols-[minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.55fr)]"
    : "grid grid-cols-[minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,0.55fr)]";

  const saveDescription = (projectId: string) => {
    if (editingDescId !== projectId) return;
    updateProject(projectId, { description: descDraft });
    setEditingDescId(null);
  };

  const toggleRowOpen = (project: Project) => {
    setOpenId((prev) => {
      if (prev === project.id) {
        if (editingDescId === project.id) {
          updateProject(project.id, { description: descDraft });
          setEditingDescId(null);
        }
        return null;
      }
      return project.id;
    });
  };

  return (
    <div className="mt-3 text-sm">
      <div
        className={`${grid} items-center gap-1 px-1 pb-1 text-xs font-medium text-zinc-500`}
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span>프로젝트 명</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span>메인 리더</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span>워크타입</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span>업무 방식</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span>등록일</span>
        </div>
        {showDetail ? (
          <div className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            <span>상세</span>
          </div>
        ) : null}
        <div className="flex items-center justify-center" aria-hidden="true" />
      </div>

      <div className="border-t border-zinc-200/60">
        {projects.map((project) => {
          const isOpen = openId === project.id;
          const cyc = displayCycle(project);
          const descText =
            project.description?.trim() ? project.description : "상세내용이 없습니다.";

          return (
            <div key={project.id} className="border-b border-zinc-200/60">
              <div className={`${grid} items-center px-1 py-1.5`}>
                <Link
                  href={`/projects/${project.id}`}
                  className="truncate text-sm font-semibold text-zinc-900 hover:underline"
                >
                  {project.name}
                </Link>
                <div className="min-w-0">
                  {readOnly ? (
                    <span className="inline-flex min-w-0 max-w-full cursor-default">
                      <Tag label={project.leader || "미선택"} />
                    </span>
                  ) : (
                    <CustomDropdown
                      variant="inline"
                      options={leaderOptions}
                      value={project.leader}
                      onChange={(v) => {
                        if (v !== "미선택") addLeader(v);
                        updateProject(project.id, { leader: v });
                      }}
                      placeholder="메인 리더"
                      showEditButton
                      onEditClick={() => setLeadersModalOpen(true)}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  {readOnly ? (
                    <span className="inline-flex min-w-0 max-w-full cursor-default">
                      <Tag label={project.category} variant="sky" />
                    </span>
                  ) : (
                    <CustomDropdown
                      variant="inline"
                      options={[...state.categories]}
                      value={project.category}
                      onChange={(v) =>
                        updateProject(project.id, {
                          category: v as ProjectCategory,
                        })
                      }
                      placeholder="워크타입"
                      allowCreate={false}
                      tagVariant="sky"
                      showEditButton
                      onEditClick={() => setWorkTypesModalOpen(true)}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  {readOnly ? (
                    <span className="inline-flex min-w-0 max-w-full cursor-default">
                      <Tag label={cyc} variant="sky" />
                    </span>
                  ) : (
                    <CustomDropdown
                      variant="inline"
                      options={[...CYCLES]}
                      value={cyc}
                      onChange={(v) =>
                        updateProject(project.id, {
                          cycle: v as ProjectCycle,
                        })
                      }
                      placeholder="업무 방식"
                      allowCreate={false}
                      tagVariant="sky"
                      showEditButton
                      onEditClick={() => setCycleInfoModalOpen(true)}
                    />
                  )}
                </div>
                <div className="text-xs text-zinc-500">{toDate(project.createdAt)}</div>
                {showDetail ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => toggleRowOpen(project)}
                      className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      {isOpen ? "접기" : "열기"}
                    </button>
                  </div>
                ) : null}
                <div className="flex justify-center">
                  {readOnly ? (
                    <span
                      className="inline-flex h-7 w-7 cursor-default items-center justify-center"
                      aria-hidden
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(project.id)}
                      className="p-1 text-zinc-400 hover:bg-zinc-50 hover:text-rose-600"
                      aria-label="프로젝트 삭제"
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {showDetail && isOpen ? (
                <div className="bg-zinc-50 px-3 py-1.5 text-xs leading-relaxed text-zinc-700">
                  {editingDescId === project.id ? (
                    <textarea
                      autoFocus
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      onBlur={() => saveDescription(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveDescription(project.id);
                        }
                      }}
                      rows={3}
                      className="w-full resize-y rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  ) : (
                    <span className="inline align-baseline">
                      <span className="whitespace-pre-wrap">{descText}</span>
                      {readOnly ? null : (
                        <button
                          type="button"
                          className="ml-1 inline align-baseline text-xs text-zinc-400 hover:text-zinc-700"
                          onClick={() => {
                            setEditingDescId(project.id);
                            setDescDraft(project.description ?? "");
                          }}
                        >
                          내용 편집
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <WorkTypesManageModal
        open={workTypesModalOpen}
        onClose={() => setWorkTypesModalOpen(false)}
      />
      <LeadersManageModal
        open={leadersModalOpen}
        onClose={() => setLeadersModalOpen(false)}
      />
      <CycleInfoModal
        open={cycleInfoModalOpen}
        onClose={() => setCycleInfoModalOpen(false)}
      />

      {confirmingId ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-900">프로젝트 삭제</h3>
            <p className="mt-2 text-sm text-zinc-600">
              이 프로젝트를 삭제하면 해당 프로젝트에 연결된 모든 디자인 시안도 함께
              휴지통으로 이동합니다.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingId(null)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  trashProject(confirmingId);
                  setConfirmingId(null);
                }}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
