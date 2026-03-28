"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { selectProjectsForCurrentUser } from "@/lib/fetchProjects";
import { insertProjectForCurrentUser } from "@/lib/insertProject";
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
  /** 진행 방식 (기존 데이터 없으면 UI에서 기본값 표시) */
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
  /** MVP: 피드백 아카이브에서 선택한 해시태그 */
  tags?: string[];
  design_image_data_url?: string;
  copy_text?: string;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
};

/** AI 피드백 페이지에서 「피드백 요청」 시 쌓이는 기록 (아카이브 outputs 와 분리) */
export type AiFeedbackHistoryEntry = {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  description: string;
  design_image_data_url?: string;
  /** 카드에 표시할 한 줄 요약 (예측 라벨 + 설명 등) */
  summaryReason: string;
  /** AI 피드백 설명 본문 (히스토리 카드 3줄 요약용) */
  aiExplanation?: string;
  status: OutputStatus;
  approvalProbability: number;
  createdAt: string;
};

type StoreState = {
  projects: Project[];
  outputs: CreativeOutput[];
  leaders: string[];
  /** 워크타입 목록 (고정 기본값 + 관리자 편집); 로컬 저장 키는 호환을 위해 `categories` 유지 */
  categories: string[];
  /** AI 피드백 탭 전용 요청 히스토리 */
  aiFeedbackHistory: AiFeedbackHistoryEntry[];
};

type StoreApi = {
  state: StoreState;
  addLeader: (name: string) => void;
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
  ) => void;
  createOutput: (input: Omit<CreativeOutput, "id" | "createdAt">) => CreativeOutput;
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
  restoreProject: (projectId: string) => void;
  deleteProjectPermanently: (projectId: string) => void;
  restoreOutput: (outputId: string) => void;
  deleteOutputPermanently: (outputId: string) => void;
  addAiFeedbackHistory: (
    input: Omit<AiFeedbackHistoryEntry, "id" | "createdAt">,
  ) => void;
};

const STORAGE_KEY = "splice_ai_store_v1";

/** localStorage 용량 절약: data URL 이미지 제거 */
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

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
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

const DEFAULT_LEADERS = ["효정", "근호"];

const DEFAULT_WORK_TYPES: string[] = [...WORK_TYPES];

const DEFAULT_STATE: StoreState = {
  leaders: DEFAULT_LEADERS,
  categories: DEFAULT_WORK_TYPES,
  projects: [
    {
      id: "seed_p1",
      name: "수상한 스튜디오 리뉴얼",
      description: "스튜디오 브랜드 리뉴얼 프로젝트",
      category: "마케팅 및 브랜딩" as ProjectCategory,
      leader: "효정",
      cycle: "단발성",
      createdAt: "2026-02-12T00:00:00.000Z",
      deleted: false,
    },
    {
      id: "seed_p2",
      name: "26 재계약식_어나더 운동회",
      description: "크루 단합을 위한 연례 이벤트",
      category: "내부 지원" as ProjectCategory,
      leader: "근호",
      cycle: "루틴",
      createdAt: "2026-02-02T00:00:00.000Z",
      deleted: false,
    },
    {
      id: "seed_p3",
      name: "26 코엑스_K-Edu",
      description: "교육 박람회 디자인 프로젝트",
      category: "제품 생산" as ProjectCategory,
      leader: "근호",
      cycle: "단발성",
      createdAt: "2026-01-21T00:00:00.000Z",
      deleted: false,
    },
  ],
  outputs: [
    {
      id: "seed_out_1",
      projectId: "seed_p1",
      output_type: "design",
      description: "시안 #1",
      status: "Rejected",
      reason: "레이아웃이 너무 복잡함",
      createdAt: "2026-03-14T00:00:00.000Z",
      deleted: false,
    },
    {
      id: "seed_out_2",
      projectId: "seed_p1",
      output_type: "design",
      description: "시안 #2",
      status: "Approved",
      reason: "CTA 버튼 강조",
      createdAt: "2026-03-16T00:00:00.000Z",
      deleted: false,
    },
  ],
  aiFeedbackHistory: [],
};

function normalizeCycle(c: unknown): ProjectCycle | undefined {
  return c === "루틴" || c === "단발성" ? c : undefined;
}

function mapSupabaseProjectRow(row: Record<string, unknown>): Project {
  const id =
    row.id != null && String(row.id) !== ""
      ? String(row.id)
      : uid("proj");
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
  const deletedAt =
    typeof row.deleted_at === "string"
      ? row.deleted_at
      : typeof row.deletedAt === "string"
        ? row.deletedAt
        : undefined;

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
    ? parsed.projects.map((p) => ({
        ...p,
        cycle: normalizeCycle(p.cycle) ?? "단발성",
      }))
    : DEFAULT_STATE.projects;

  return {
    ...parsed,
    projects,
    leaders:
      Array.isArray(parsed.leaders) && parsed.leaders.length > 0
        ? parsed.leaders
        : DEFAULT_LEADERS,
    categories:
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories
        : DEFAULT_WORK_TYPES,
    aiFeedbackHistory: Array.isArray(parsed.aiFeedbackHistory)
      ? parsed.aiFeedbackHistory
      : [],
  };
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within AppProviders");
  return ctx;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  /**
   * SSR/CSR 첫 렌더는 동일해야 hydration mismatch가 나지 않음.
   * localStorage 복원은 마운트 후 useEffect에서만 수행.
   */
  const [state, setState] = useState<StoreState>({
    ...DEFAULT_STATE,
    projects: [],
  });
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
        setState({
          ...base,
          projects: rows.map(mapSupabaseProjectRow),
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
        if (!trimmed) return;
        setState((prev) =>
          prev.leaders.some((l) => l.toLowerCase() === trimmed.toLowerCase())
            ? prev
            : { ...prev, leaders: [...prev.leaders, trimmed] },
        );
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
          return {
            ...prev,
            categories: nextTypes,
            projects: prev.projects.map((p) =>
              p.category === name
                ? { ...p, category: fallback as ProjectCategory }
                : p,
            ),
          };
        });
      },
      createProject: async (input) => {
        const cycle: ProjectCycle =
          input.cycle === "루틴" || input.cycle === "단발성"
            ? input.cycle
            : "단발성";
        const project: Project = {
          id: uid("proj"),
          name: input.name.trim() || "새 프로젝트",
          description: input.description ?? "",
          category: (input.category ?? WORK_TYPES[0]) as ProjectCategory,
          leader: input.leader ?? "미선택",
          cycle,
          createdAt: new Date().toISOString(),
          deleted: false,
        };
        setState((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
        const localId = project.id;

        const result = await insertProjectForCurrentUser({
          name: project.name,
        });

        if (!result.ok) {
          return project;
        }

        const dbId = result.id;
        const merged: Project = { ...project, id: dbId };

        setState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === localId ? merged : p,
          ),
          outputs: prev.outputs.map((o) =>
            o.projectId === localId ? { ...o, projectId: dbId } : o,
          ),
          aiFeedbackHistory: (prev.aiFeedbackHistory ?? []).map((h) =>
            h.projectId === localId ? { ...h, projectId: dbId } : h,
          ),
        }));

        return merged;
      },
      updateProject: (projectId, patch) => {
        setState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) => {
            if (p.id !== projectId) return p;
            const next: Project = { ...p, ...patch };
            if (patch.cycle !== undefined) {
              next.cycle =
                patch.cycle === "루틴" || patch.cycle === "단발성"
                  ? patch.cycle
                  : (p.cycle ?? "단발성");
            }
            return next;
          }),
        }));
      },
      createOutput: (input) => {
        const output: CreativeOutput = {
          ...input,
          id: uid("out"),
          createdAt: new Date().toISOString(),
          deleted: false,
        };
        setState((prev) => ({ ...prev, outputs: [output, ...prev.outputs] }));
        return output;
      },
      updateOutput: (outputId, patch) => {
        setState((prev) => ({
          ...prev,
          outputs: prev.outputs.map((o) =>
            o.id === outputId ? { ...o, ...patch } : o,
          ),
        }));
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
      },
      deleteProjectPermanently: (projectId) => {
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
      },
      deleteOutputPermanently: (outputId) => {
        setState((prev) => ({
          ...prev,
          outputs: prev.outputs.filter((o) => o.id !== outputId),
        }));
      },
      addAiFeedbackHistory: (input) => {
        const entry: AiFeedbackHistoryEntry = {
          ...input,
          id: uid("ai_fb"),
          createdAt: new Date().toISOString(),
        };
        setState((prev) => ({
          ...prev,
          aiFeedbackHistory: [entry, ...(prev.aiFeedbackHistory ?? [])],
        }));
      },
    };
  }, [state]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

