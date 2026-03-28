"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  insertAiFeedbackRow,
  mapAiFeedbackRow,
  selectAiFeedbacksForProjectIds,
  encodeAiFeedbackContent,
} from "@/lib/db/aiFeedbacks";
import { encodeFeedbackContent } from "@/lib/db/codec";
import {
  deleteFeedbackRow,
  insertFeedbackRow,
  mapFeedbackRow,
  selectFeedbacksForProjectIds,
  updateFeedbackRow,
  updateFeedbacksTrashForProject,
} from "@/lib/db/feedbacks";
import {
  deleteProjectCascade,
  insertProjectRow,
  updateProjectRow,
} from "@/lib/db/projects";
import { selectProjectsForCurrentUser } from "@/lib/fetchProjects";
import { supabase } from "@/lib/supabase";
import { WORK_TYPES } from "../constants/taxonomy";

export type ProjectCategory =
  | "미분류"
  | "연례 행사"
  | "단발성 프로젝트"
  | "마케팅 프로젝트"
  | "교육 프로젝트"
  | "브랜딩"
  | "캠페인"
  | "프로모션"
  | "콘텐츠"
  | "제품"
  | "UX/UI"
  | "기타";

export type ProjectLeader = "미선택" | string;

export type ProjectCycle = "루틴" | "단발성";

export type Project = {
  id: string;
  name: string;
  description: string;
  category: ProjectCategory;
  leader: ProjectLeader;
  cycle?: ProjectCycle;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
};

export type OutputType = "design" | "copy";
export type OutputStatus = "Approved" | "Rejected";

export type CreativeOutput = {
  id: string;
  projectId: string;
  output_type: OutputType;
  description: string;
  status: OutputStatus;
  reason: string;
  tags?: string[];
  design_image_data_url?: string;
  copy_text?: string;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
  /** DB `feedbacks` AI 분석 컬럼 — 아카이브 상세 등에서 표시 */
  ai_background?: string;
  ai_typography?: string;
  ai_copywriting?: string;
  ai_layout?: string;
  ai_key_visual?: string;
  ai_summary?: string;
};

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
  /** `/api/ai/evaluate`: low ≤33 · mid 34–66 · high ≥67 */
  prediction?: "low" | "mid" | "high";
  risks?: string[];
  similarCases?: AiSimilarPastCase[];
};

type StoreState = {
  projects: Project[];
  outputs: CreativeOutput[];
  leaders: string[];
  categories: string[];
  aiFeedbackHistory: AiFeedbackHistoryEntry[];
  /** 프로젝트 ID → Supabase `updateProject` 진행 중 */
  projectUpdatePending: Record<string, boolean>;
};

type StoreApi = {
  state: StoreState;
  addLeader: (name: string) => void;
  removeLeader: (name: string) => void;
  addWorkType: (name: string) => void;
  removeWorkType: (name: string) => void;
  createProject: (input: {
    name: string;
    description: string;
    category?: ProjectCategory;
    leader?: ProjectLeader;
    cycle?: ProjectCycle;
  }) => Promise<Project>;
  updateProject: (
    projectId: string,
    patch: Partial<Pick<Project, "leader" | "category" | "description" | "cycle">>,
  ) => Promise<void>;
  createOutput: (
    input: Omit<CreativeOutput, "id" | "createdAt">,
  ) => Promise<CreativeOutput>;
  updateOutput: (
    outputId: string,
    patch: Partial<
      Pick<
        CreativeOutput,
        | "status"
        | "reason"
        | "description"
        | "projectId"
        | "design_image_data_url"
        | "tags"
      >
    >,
  ) => void;
  trashProject: (projectId: string) => void;
  trashOutput: (outputId: string) => void;
  restoreProject: (projectId: string) => void;
  deleteProjectPermanently: (projectId: string) => void;
  restoreOutput: (outputId: string) => void;
  deleteOutputPermanently: (outputId: string) => void;
  addAiFeedbackHistory: (
    input: Omit<AiFeedbackHistoryEntry, "id" | "createdAt">,
  ) => Promise<void>;
  prependAiFeedbackHistory: (entry: AiFeedbackHistoryEntry) => void;
};

const STORAGE_KEY = "splice_ai_store_v1";

/** localStorage에 남아 있을 수 있는 비-UUID 레거시 행 제거용 */
function isStoredEntityId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function stripStoredImages(s: StoreState): StoreState {
  return {
    ...s,
    outputs: s.outputs.map((o) => ({
      ...o,
      design_image_data_url: undefined,
    })),
    aiFeedbackHistory: (s.aiFeedbackHistory ?? []).map((h) => ({
      ...h,
      design_image_data_url: undefined,
    })),
    projectUpdatePending: {},
  };
}

function tryPersistToLocalStorage(data: StoreState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    const isQuota =
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.code === 22);
    if (!isQuota && e instanceof Error) {
      console.warn("[splice] localStorage 저장 실패:", e.message);
    }
    return false;
  }
}

function safeParse(json: string | null): StoreState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StoreState;
  } catch {
    return null;
  }
}

const StoreContext = createContext<StoreApi | null>(null);

const DEFAULT_WORK_TYPES: string[] = [...WORK_TYPES];

const DEFAULT_STATE: StoreState = {
  leaders: [],
  categories: DEFAULT_WORK_TYPES,
  projects: [],
  outputs: [],
  aiFeedbackHistory: [],
  projectUpdatePending: {},
};

function normalizeCycle(c: unknown): ProjectCycle | undefined {
  return c === "루틴" || c === "단발성" ? c : undefined;
}

function mapSupabaseProjectRow(row: Record<string, unknown>): Project | null {
  const id = row.id != null ? String(row.id).trim() : "";
  if (!id) return null;

  const nameRaw = row.name != null ? String(row.name).trim() : "";
  const name = nameRaw || "새 프로젝트";
  const description =
    row.description != null ? String(row.description) : "";
  const leader = (row.leader != null
    ? String(row.leader)
    : "미선택") as ProjectLeader;
  const cycle: ProjectCycle = normalizeCycle(row.cycle) ?? "단발성";
  const catStr = row.category != null ? String(row.category) : "";
  const category = (
    DEFAULT_WORK_TYPES.includes(catStr) ? catStr : DEFAULT_WORK_TYPES[0]
  ) as ProjectCategory;
  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : typeof row.createdAt === "string"
        ? row.createdAt
        : new Date().toISOString();

  const deleted = Boolean(row.deleted);
  const deletedAtRaw = row.deleted_at;
  const deletedAt =
    typeof deletedAtRaw === "string" ? deletedAtRaw : undefined;

  return {
    id,
    name,
    description,
    category,
    leader,
    cycle,
    createdAt,
    deleted,
    deletedAt,
  };
}

function normalizeLoadedState(parsed: StoreState): StoreState {
  const projects = Array.isArray(parsed.projects)
    ? parsed.projects
        .filter((p) => isStoredEntityId(p.id))
        .map((p) => ({
          ...p,
          cycle: normalizeCycle(p.cycle) ?? "단발성",
        }))
    : [];

  const outputs = Array.isArray(parsed.outputs)
    ? parsed.outputs.filter(
        (o) => isStoredEntityId(o.id) && isStoredEntityId(o.projectId),
      )
    : [];

  const aiFeedbackHistory = Array.isArray(parsed.aiFeedbackHistory)
    ? parsed.aiFeedbackHistory.filter(
        (h) => isStoredEntityId(h.id) && isStoredEntityId(h.projectId),
      )
    : [];

  return {
    ...parsed,
    projects,
    outputs,
    aiFeedbackHistory,
    projectUpdatePending: {},
    leaders: Array.isArray(parsed.leaders)
      ? parsed.leaders.filter(
          (l): l is string =>
            typeof l === "string" &&
            l.trim() !== "" &&
            l !== "미선택",
        )
      : [],
    categories:
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories
        : DEFAULT_WORK_TYPES,
  };
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within AppProviders");
  return ctx;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(DEFAULT_STATE);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncFromAuth = async () => {
      const existing = safeParse(localStorage.getItem(STORAGE_KEY));
      const base = existing ? normalizeLoadedState(existing) : DEFAULT_STATE;

      const rows = await selectProjectsForCurrentUser();

      if (cancelled) return;

      if (rows === null) {
        setState(base);
      } else {
        const projects = rows
          .map((r) => mapSupabaseProjectRow(r))
          .filter((p): p is Project => p !== null);
        const pids = projects.map((p) => p.id);
        const fbRaw = await selectFeedbacksForProjectIds(pids);
        const outputs = fbRaw.map(mapFeedbackRow);
        const aiRaw = await selectAiFeedbacksForProjectIds(pids);
        const aiFeedbackHistory = aiRaw.map(mapAiFeedbackRow);
        setState({
          ...base,
          projects,
          outputs,
          aiFeedbackHistory,
          projectUpdatePending: {},
        });
      }
      setStorageReady(true);
    };

    void syncFromAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncFromAuth();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    if (tryPersistToLocalStorage(state)) return;

    console.warn(
      "[splice] localStorage 용량 한도 초과로 저장에 실패했습니다. 이미지 미리보기(data URL)를 빼고 다시 시도합니다.",
    );

    const withoutImages = stripStoredImages(state);
    if (tryPersistToLocalStorage(withoutImages)) {
      setState(withoutImages);
      return;
    }

    const trimmedHistory = {
      ...withoutImages,
      aiFeedbackHistory: (withoutImages.aiFeedbackHistory ?? []).slice(0, 12),
    };
    if (tryPersistToLocalStorage(trimmedHistory)) {
      setState(trimmedHistory);
      return;
    }

    const noAiHistory = { ...trimmedHistory, aiFeedbackHistory: [] };
    if (tryPersistToLocalStorage(noAiHistory)) {
      setState(noAiHistory);
      return;
    }

    console.error(
      "[splice] localStorage에 저장할 수 없습니다. 브라우저 저장소를 비우거나 이 사이트의 데이터를 삭제한 뒤 다시 시도하세요.",
    );
  }, [state, storageReady]);

  const api = useMemo<StoreApi>(() => {
    return {
      state,
      addLeader: (name) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === "미선택") return;
        setState((prev) =>
          prev.leaders.some((l) => l.toLowerCase() === trimmed.toLowerCase())
            ? prev
            : { ...prev, leaders: [...prev.leaders, trimmed] },
        );
      },
      removeLeader: (name) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === "미선택") return;
        setState((prev) => {
          if (!prev.leaders.includes(trimmed)) return prev;
          const nextLeaders = prev.leaders.filter((l) => l !== trimmed);
          const projects = prev.projects.map((p) => {
            if (p.leader !== trimmed) return p;
            const next: Project = { ...p, leader: "미선택" };
            void updateProjectRow(next.id, {
              name: next.name,
              leader: null,
              category: String(next.category),
              cycle: next.cycle ?? "단발성",
              description: next.description ?? "",
            });
            return next;
          });
          return { ...prev, leaders: nextLeaders, projects };
        });
      },
      addWorkType: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setState((prev) =>
          prev.categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
            ? prev
            : { ...prev, categories: [...prev.categories, trimmed] },
        );
      },
      removeWorkType: (name) => {
        setState((prev) => {
          let nextTypes = prev.categories.filter((c) => c !== name);
          if (nextTypes.length === 0) nextTypes = [...WORK_TYPES];
          const fallback = nextTypes[0] ?? WORK_TYPES[0];
          const projects = prev.projects.map((p) => {
            if (p.category !== name) return p;
            const next = { ...p, category: fallback as ProjectCategory };
            void updateProjectRow(next.id, {
              name: next.name,
              leader: next.leader === "미선택" ? null : String(next.leader),
              category: String(next.category),
              cycle: next.cycle ?? "단발성",
              description: next.description ?? "",
            });
            return next;
          });
          return { ...prev, categories: nextTypes, projects };
        });
      },
      createProject: async (input) => {
        const {
          data: { user: authUser },
          error: authErr,
        } = await supabase.auth.getUser();

        const uid = authUser?.id != null ? String(authUser.id).trim() : "";
        if (authErr || !uid) {
          if (authErr) {
            console.warn("[projects] auth.getUser 실패:", authErr.message);
          }
          throw new Error(
            "로그인이 필요합니다. 프로젝트를 만들려면 다시 로그인해 주세요.",
          );
        }

        const cycle: ProjectCycle =
          input.cycle === "루틴" || input.cycle === "단발성"
            ? input.cycle
            : "단발성";
        const name = input.name.trim() || "새 프로젝트";
        const description = input.description ?? "";

        const result = await insertProjectRow({
          name,
          user_id: uid,
          leader:
            (input.leader ?? "미선택") === "미선택"
              ? null
              : String(input.leader),
          category: String((input.category ?? WORK_TYPES[0]) as ProjectCategory),
          cycle,
          description,
        });

        if (!result.ok) {
          throw new Error(result.message ?? "프로젝트 생성에 실패했습니다.");
        }

        const mapped = mapSupabaseProjectRow(result.row);
        if (!mapped) {
          throw new Error("프로젝트 응답이 유효하지 않습니다.");
        }

        setState((prev) => ({
          ...prev,
          projects: [mapped, ...prev.projects],
        }));
        return mapped;
      },
      updateProject: async (projectId, patch) => {
        let merged: Project | undefined;
        let previous: Project | undefined;

        setState((prev) => {
          const p = prev.projects.find((x) => x.id === projectId);
          if (!p) return prev;
          previous = p;
          const next: Project = { ...p, ...patch };
          if (patch.cycle !== undefined) {
            next.cycle =
              patch.cycle === "루틴" || patch.cycle === "단발성"
                ? patch.cycle
                : (p.cycle ?? "단발성");
          }
          merged = next;
          return {
            ...prev,
            projects: prev.projects.map((x) =>
              x.id === projectId ? next : x,
            ),
            projectUpdatePending: {
              ...prev.projectUpdatePending,
              [projectId]: true,
            },
          };
        });

        try {
          if (!merged || !previous) return;

          const ok = await updateProjectRow(projectId, {
            name: merged.name,
            leader: merged.leader === "미선택" ? null : String(merged.leader),
            category: String(merged.category),
            cycle: merged.cycle ?? "단발성",
            description: merged.description ?? "",
          });

          if (!ok) {
            console.warn(
              "[projects] UI 되돌림: Supabase projects update 실패 또는 갱신 0건",
              projectId,
            );
            setState((prev) => ({
              ...prev,
              projects: prev.projects.map((p) =>
                p.id === projectId ? previous! : p,
              ),
            }));
          }
        } finally {
          setState((prev) => {
            if (!prev.projectUpdatePending[projectId]) return prev;
            const { [projectId]: _r, ...rest } = prev.projectUpdatePending;
            return { ...prev, projectUpdatePending: rest };
          });
        }
      },
      createOutput: async (input) => {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          throw new Error("로그인이 필요합니다.");
        }

        const res = await insertFeedbackRow({
          project_id: input.projectId,
          content: encodeFeedbackContent({
            output_type: input.output_type,
            status: input.status,
            reason: input.reason,
            description: input.description,
            tags: input.tags,
            copy_text: input.copy_text,
          }),
          image_url: input.design_image_data_url ?? "",
        });
        if (!res.ok) {
          throw new Error(res.message ?? "피드백 저장에 실패했습니다.");
        }

        const output = mapFeedbackRow(res.row);
        setState((prev) => ({
          ...prev,
          outputs: [output, ...prev.outputs],
        }));
        return output;
      },
      updateOutput: (outputId, patch) => {
        setState((prev) => {
          const outputs = prev.outputs.map((o) =>
            o.id !== outputId ? o : { ...o, ...patch },
          );
          const o = outputs.find((x) => x.id === outputId);
          if (o) {
            void updateFeedbackRow(o.id, {
              project_id: o.projectId,
              content: encodeFeedbackContent({
                output_type: o.output_type,
                status: o.status,
                reason: o.reason,
                description: o.description,
                tags: o.tags,
                copy_text: o.copy_text,
              }),
              image_url: o.design_image_data_url ?? "",
            });
          }
          return { ...prev, outputs };
        });
      },
      trashProject: (projectId) => {
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === projectId ? { ...p, deleted: true, deletedAt: now } : p,
          ),
          outputs: prev.outputs.map((o) =>
            o.projectId === projectId ? { ...o, deleted: true, deletedAt: now } : o,
          ),
        }));
        void updateProjectRow(projectId, {
          deleted: true,
          deleted_at: now,
        });
        void updateFeedbacksTrashForProject(projectId, true, now);
      },
      trashOutput: (outputId) => {
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          outputs: prev.outputs.map((o) =>
            o.id === outputId ? { ...o, deleted: true, deletedAt: now } : o,
          ),
        }));
        void updateFeedbackRow(outputId, {
          deleted: true,
          deleted_at: now,
        });
      },
      restoreProject: (projectId) => {
        setState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === projectId ? { ...p, deleted: false, deletedAt: undefined } : p,
          ),
          outputs: prev.outputs.map((o) =>
            o.projectId === projectId ? { ...o, deleted: false, deletedAt: undefined } : o,
          ),
        }));
        void updateProjectRow(projectId, {
          deleted: false,
          deleted_at: null,
        });
        void updateFeedbacksTrashForProject(projectId, false, null);
      },
      deleteProjectPermanently: (projectId) => {
        void deleteProjectCascade(projectId);
        setState((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== projectId),
          outputs: prev.outputs.filter((o) => o.projectId !== projectId),
        }));
      },
      restoreOutput: (outputId) => {
        setState((prev) => ({
          ...prev,
          outputs: prev.outputs.map((o) =>
            o.id === outputId ? { ...o, deleted: false, deletedAt: undefined } : o,
          ),
        }));
        void updateFeedbackRow(outputId, {
          deleted: false,
          deleted_at: null,
        });
      },
      deleteOutputPermanently: (outputId) => {
        void deleteFeedbackRow(outputId);
        setState((prev) => ({
          ...prev,
          outputs: prev.outputs.filter((o) => o.id !== outputId),
        }));
      },
      prependAiFeedbackHistory: (entry) => {
        setState((prev) => ({
          ...prev,
          aiFeedbackHistory: [entry, ...(prev.aiFeedbackHistory ?? [])],
        }));
      },
      addAiFeedbackHistory: async (input) => {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          console.warn("[ai_feedbacks] 로그인 필요 — 건너뜀");
          return;
        }

        const now = new Date().toISOString();
        const parentContent = encodeFeedbackContent({
          output_type: "design",
          status: input.status,
          reason: "(AI 피드백 요청)",
          description: input.description,
          tags: [],
          copy_text: undefined,
        });
        const fbIns = await insertFeedbackRow({
          project_id: input.projectId,
          content: parentContent,
          image_url: input.design_image_data_url ?? "",
        });
        if (!fbIns.ok) {
          console.error("[ai_feedbacks] 부모 feedback 저장 실패:", fbIns.message);
          return;
        }

        const parentRow = fbIns.row;
        const parentId = String(parentRow.id ?? "");
        if (!parentId) return;

        const aiContent = encodeAiFeedbackContent({
          projectName: input.projectName,
          fileName: input.fileName,
          summaryReason: input.summaryReason,
          aiExplanation: input.aiExplanation,
          status: input.status,
          approvalProbability: input.approvalProbability,
        });
        const aiIns = await insertAiFeedbackRow({
          project_id: input.projectId,
          user_id: authUser.id,
          content: aiContent,
          image_url: input.design_image_data_url ?? "",
        });

        const newOutput = mapFeedbackRow(parentRow);

        if (aiIns.ok) {
          const historyEntry = mapAiFeedbackRow({
            id: aiIns.id,
            project_id: input.projectId,
            content: aiContent,
            created_at: now,
            image_url: input.design_image_data_url ?? "",
          });
          setState((prev) => ({
            ...prev,
            outputs: [newOutput, ...prev.outputs],
            aiFeedbackHistory: [historyEntry, ...(prev.aiFeedbackHistory ?? [])],
          }));
        } else {
          setState((prev) => ({
            ...prev,
            outputs: [newOutput, ...prev.outputs],
          }));
        }
      },
    };
  }, [state]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
