"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CycleInfoModal } from "../../components/CycleInfoModal";
import { CustomDropdown } from "../../components/CustomDropdown";
import { LeadersManageModal } from "../../components/LeadersManageModal";
import { ProjectTable } from "../../components/ProjectTable";
import { WorkTypesManageModal } from "../../components/WorkTypesManageModal";
import { CYCLES } from "../../constants/taxonomy";
import { useStore } from "../providers";
import type { ProjectCategory, ProjectCycle } from "../providers";

function ProjectsPage() {
  const { createProject, state, addLeader } = useStore();
  const [nlDescription, setNlDescription] = useState("");
  const [projectName, setProjectName] = useState("");
  const [leader, setLeader] = useState<string>("");
  const [workType, setWorkType] = useState<string>("");
  const [cycle, setCycle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [workTypesModalOpen, setWorkTypesModalOpen] = useState(false);
  const [leadersModalOpen, setLeadersModalOpen] = useState(false);
  const [cycleInfoModalOpen, setCycleInfoModalOpen] = useState(false);

  const leaderOptions = useMemo(
    () => ["미선택", ...state.leaders.filter((l) => l !== "미선택")],
    [state.leaders],
  );

  const handleCreate = async () => {
    setError(null);
    if (!projectName.trim()) {
      setError("프로젝트 명을 입력해주세요.");
      return;
    }
    if (!leader.trim()) {
      setError("메인 리더를 선택해주세요.");
      return;
    }
    if (!workType.trim() || !state.categories.includes(workType)) {
      setError("워크타입을 선택해주세요.");
      return;
    }
    if (cycle !== "루틴" && cycle !== "단발성") {
      setError("진행 방식을 선택해주세요.");
      return;
    }
    if (!nlDescription.trim()) {
      setError("프로젝트 설명을 입력해주세요.");
      return;
    }

    try {
      await createProject({
        name: projectName,
        description: nlDescription,
        category: workType as ProjectCategory,
        leader,
        cycle: cycle as ProjectCycle,
      });

      setNlDescription("");
      setProjectName("");
      setLeader("");
      setWorkType("");
      setCycle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로젝트 생성에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          프로젝트
        </h1>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 pb-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">프로젝트 생성</h2>
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="프로젝트 명"
            className="min-w-[8rem] flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <div className="min-w-[7.5rem] flex-1">
            <CustomDropdown
              options={leaderOptions}
              value={leader}
              placeholder="메인 리더"
              showEditButton
              onEditClick={() => setLeadersModalOpen(true)}
              onChange={(v) => {
                if (v !== "미선택") addLeader(v);
                setLeader(v);
              }}
            />
          </div>
          <div className="min-w-[7.5rem] flex-1">
            <CustomDropdown
              options={[...state.categories]}
              value={
                state.categories.includes(workType) ? workType : ""
              }
              placeholder="워크타입"
              allowCreate={false}
              tagVariant="sky"
              showEditButton
              onEditClick={() => setWorkTypesModalOpen(true)}
              onChange={setWorkType}
            />
          </div>
          <div className="min-w-[7.5rem] flex-1">
            <CustomDropdown
              options={[...CYCLES]}
              value={cycle}
              onChange={setCycle}
              placeholder="업무 방식"
              allowCreate={false}
              tagVariant="sky"
              showEditButton
              onEditClick={() => setCycleInfoModalOpen(true)}
            />
          </div>
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

        <div className="mt-2">
          <textarea
            value={nlDescription}
            onChange={(e) => setNlDescription(e.target.value)}
            rows={4}
            placeholder="프로젝트 설명을 입력하세요."
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div className="mt-4 flex justify-start">
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            <span className="text-sm leading-none">+</span>
            프로젝트 생성
          </button>
        </div>

        {error ? (
          <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">프로젝트 목록</h2>
        <ProjectTable />
      </section>
    </div>
  );
}

export default dynamic(() => Promise.resolve({ default: ProjectsPage }), {
  ssr: false,
});
