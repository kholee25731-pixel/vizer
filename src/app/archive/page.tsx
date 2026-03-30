"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Check, UploadCloud, X, ArrowUpFromLine } from "lucide-react";
import { CustomDropdown } from "../../components/CustomDropdown";
import { mapFeedbackRow } from "@/lib/db/feedbacks";
import { buildFeedbackStorageFileName } from "@/lib/storage/feedbackStorageFileName";
import { supabase } from "@/lib/supabase";
import { useStore } from "../providers";

type Status = "Approved" | "Rejected";

/** 상세 모달 열 때 스냅샷 — 저장 버튼은 현재 초안과 비교해 변경 있을 때만 활성 */
type DetailEditBaseline = {
  projectId: string;
  status: Status;
  reason: string;
  description: string;
  tags: string[];
  imageUrl: string | null;
};

function detailTagsNormalizedKey(tags: string[]): string {
  return [...tags]
    .map((t) => t.trim())
    .filter(Boolean)
    .sort()
    .join("\0");
}

function statusLabelKo(s: Status): string {
  return s === "Approved" ? "승인됨" : "거절됨";
}

function explainKeyword(keyword: string): string {
  const map: Record<string, string> = {
    "블랙 베이스": "시각적 대비를 강화함",
    "파스텔 핑크": "부드러운 감정 전달을 유도함",
    "종이 질감": "아날로그 감성을 제공함",
    "소품 없음": "메시지 집중도를 높임",

    "볼드 폰트": "가독성과 강조 효과를 제공함",
    "대문자": "시각적 임팩트를 강화함",

    "수직 구조": "정보 흐름을 명확하게 정리함",
    "균등 간격": "안정감 있는 레이아웃을 제공함",
  };

  return map[keyword] ?? "디자인 의도를 강화함";
}

function formatConceptSummaryBlock(o: Record<string, unknown>): string {
  let frag = "";
  const main = String(o.main ?? "").trim();
  const oneLine = String(o.summary ?? "").trim();
  const kws = Array.isArray(o.keywords) ? o.keywords : [];
  if (main) {
    frag += `[컨셉]\n${main}\n\n`;
  }
  if (kws.length > 0) {
    const lines = kws
      .map((k) => String(k ?? "").trim())
      .filter(Boolean)
      .map((k) => `• ${k} 중심의 디자인 구조 형성`);
    if (lines.length > 0) {
      frag += lines.join("\n");
      frag += "\n";
    }
  }
  if (oneLine) {
    frag += `[전달]\n${oneLine}\n`;
  }
  return frag;
}

function formatFeedbackAlignmentLines(fa: Record<string, unknown>): string {
  let result = "";
  const pushLines = (title: string, arr: unknown) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    result += `${title}\n`;
    for (const item of arr) {
      const s = String(item ?? "").trim();
      if (s) result += `• ${s}\n`;
    }
    result += "\n";
  };
  pushLines("[피드백과 일치하는 요소]", fa.matched);
  pushLines("[피드백과 불일치하는 요소]", fa.mismatched);
  return result;
}

/** `ai_summary` 컬럼: 컨셉 + 세부 내용(요약 문단) + 선택적 피드백 검증 */
function formatAiSummary(raw: string | null | undefined): ReactNode {
  if (raw == null || String(raw).trim() === "") {
    return <p className="text-sm text-zinc-800">분석 없음</p>;
  }

  const trimmed = String(raw).trim();
  if (!trimmed.startsWith("{")) {
    return <p className="text-sm text-zinc-800">분석 없음</p>;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return <p className="text-sm text-zinc-800">분석 없음</p>;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return <p className="text-sm text-zinc-800">분석 없음</p>;
  }

  const rec = parsed as Record<string, unknown>;
  const keys = Object.keys(rec);
  const onlyConceptStored =
    keys.length > 0 &&
    keys.every(
      (k) => k === "main" || k === "keywords" || k === "summary",
    );

  const concept =
    onlyConceptStored
      ? rec
      : rec.concept != null &&
          typeof rec.concept === "object" &&
          !Array.isArray(rec.concept)
        ? (rec.concept as Record<string, unknown>)
        : null;

  if (!concept) {
    return <p className="text-sm text-zinc-800">분석 없음</p>;
  }

  const main = String(concept.main ?? "").trim();
  const summaryText = String(concept.summary ?? "").trim();
  const lines = summaryText
    ? summaryText.split(/\n/).map((l) => l.trim()).filter(Boolean)
    : [];

  const fa =
    !onlyConceptStored &&
    rec.feedback_alignment != null &&
    typeof rec.feedback_alignment === "object" &&
    !Array.isArray(rec.feedback_alignment)
      ? (rec.feedback_alignment as Record<string, unknown>)
      : null;

  const matched = Array.isArray(fa?.matched)
    ? (fa.matched as unknown[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
    : [];
  const mismatched = Array.isArray(fa?.mismatched)
    ? (fa.mismatched as unknown[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
    : [];

  const hasConceptBits = Boolean(main);
  const hasDetail = lines.length > 0;
  const hasFa = matched.length > 0 || mismatched.length > 0;

  if (!hasConceptBits && !hasDetail && !hasFa) {
    return <p className="text-sm text-zinc-800">분석 없음</p>;
  }

  return (
    <div className="space-y-4">
      {hasConceptBits ? (
        <div>
          <p className="mb-1 text-xs text-zinc-500">컨셉</p>
          {main ? (
            <p className="text-sm font-medium text-zinc-900">{main}</p>
          ) : null}
        </div>
      ) : null}

      {hasDetail ? (
        <div>
          <p className="mb-1 text-xs text-zinc-500">세부 내용</p>
          <div className="space-y-2 text-sm leading-relaxed text-zinc-800">
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      {hasFa ? (
        <div>
          <p className="mb-1 text-xs text-zinc-500">피드백 검증</p>
          {matched.length > 0 ? (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-zinc-600">
                일치하는 분석
              </p>
              <ul className="space-y-1 text-sm text-zinc-800">
                {matched.map((s, i) => (
                  <li key={`m-${i}`}>• {s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {mismatched.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">
                불일치하는 분석
              </p>
              <ul className="space-y-1 text-sm text-zinc-800">
                {mismatched.map((s, i) => (
                  <li key={`x-${i}`}>• {s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatAiAnalysis(raw: unknown): string {
  if (raw === undefined) {
    return "AI 분석 중입니다...";
  }
  if (raw === null) {
    return "분석 없음";
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return "분석 없음";
    }

    if (trimmed.startsWith("{")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);

        if (typeof parsed !== "object" || parsed === null) {
          return "분석 없음";
        }

        let result = "";

        const appendAnalysisItem = (item: unknown) => {
          if (item !== null && typeof item === "object" && !Array.isArray(item)) {
            const r = item as Record<string, unknown>;
            const value = String(r.value ?? "").trim();
            const role = String(r.role ?? "").trim();
            if (value) {
              result += `• [${value}] ${role || "설명 없음"}\n`;
            }
            return;
          }
          if (typeof item === "string") {
            const s = item.trim();
            if (s) result += `• [${s}] ${explainKeyword(s)}\n`;
            return;
          }
          const kw = String(item ?? "").trim();
          if (kw) result += `• [${kw}] ${explainKeyword(kw)}\n`;
        };

        const rec = parsed as Record<string, unknown>;
        const keys = Object.keys(rec);
        const onlyConceptStored =
          keys.length > 0 &&
          keys.every(
            (k) => k === "main" || k === "keywords" || k === "summary",
          );

        if (onlyConceptStored) {
          result += formatConceptSummaryBlock(rec);
          return result.trim() || "분석 없음";
        }

        Object.entries(rec).forEach(([key, value]) => {
          if (
            (key === "concept" || key === "summary") &&
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            result += formatConceptSummaryBlock(value as Record<string, unknown>);
            result += "\n";
            return;
          }

          if (
            key === "feedback_alignment" &&
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            result += formatFeedbackAlignmentLines(
              value as Record<string, unknown>,
            );
            return;
          }

          if (Array.isArray(value) && value.length > 0) {
            result += `[${key}]\n`;
            value.forEach((item) => appendAnalysisItem(item));
            result += "\n";
            return;
          }

          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value as Record<string, unknown>).forEach(
              ([subKey, items]) => {
                if (Array.isArray(items) && items.length > 0) {
                  result += `[${subKey}]\n`;
                  items.forEach((item) => appendAnalysisItem(item));
                  result += "\n";
                }
              },
            );
          }
        });

        return result.trim() || "분석 없음";
      } catch {
        return "분석 없음";
      }
    }

    return "분석 없음";
  }

  return "분석 없음";
}

/** 섹션 컬럼(ai_background 등) JSON → 카테고리 없이 자연스러운 문장 */
function formatAiSentence(raw: string | null | undefined): ReactNode {
  if (raw == null || String(raw).trim() === "") {
    return <p>분석 없음</p>;
  }

  let value: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) {
      return <p>분석 없음</p>;
    }
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return <p>분석 없음</p>;
    }
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return <p>분석 없음</p>;
  }

  const result: ReactElement[] = [];
  let elKey = 0;

  const keywordForCategory = (categoryKey: string, itemValue: string) => {
    const v = itemValue.trim();
    if (categoryKey === "color") return `${v} 컬러`;
    if (categoryKey === "texture") return `${v} 질감`;
    if (categoryKey === "object") return v;
    if (categoryKey === "font_style") return `${v} 서체`;
    if (categoryKey === "structure") return `${v} 구조`;
    if (categoryKey === "tone_and_wording") return v;
    if (categoryKey === "focal_point") return v;
    return v;
  };

  const pushSentence = (
    categoryKey: string,
    item: Record<string, unknown>,
    i: number,
  ) => {
    const v = String(item.value ?? "").trim();
    if (!v) return;

    const keyword = keywordForCategory(categoryKey, v);
    const role = String(item.role ?? "").trim();
    const tail = role || `${keyword} 요소가 사용되었다.`;

    result.push(
      <p key={`${categoryKey}-${i}-${elKey++}`}>
        <span className="font-medium">[{keyword}]</span> {tail}
      </p>,
    );
  };

  const walkCategory = (categoryKey: string, items: unknown) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        pushSentence(categoryKey, item as Record<string, unknown>, i);
      }
    });
  };

  for (const [sectionKey, section] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (section == null) continue;
    if (Array.isArray(section)) {
      walkCategory(sectionKey, section);
    } else if (typeof section === "object") {
      for (const [categoryKey, items] of Object.entries(
        section as Record<string, unknown>,
      )) {
        walkCategory(categoryKey, items);
      }
    }
  }

  if (result.length === 0) {
    return <p>분석 없음</p>;
  }

  return result;
}

/**
 * AI 필드 표시: undefined=로딩, null/빈 문자열=없음(+선택 재시도), 그 외=formatBody.
 * falsy 일괄 처리 금지 — 반드시 === undefined / null / trim 검사로 분기.
 */
function renderAiAnalysis(
  value: string | null | undefined,
  onRetry: (() => void) | undefined,
  retryBusy: boolean | undefined,
  formatBody: (text: string) => ReactNode,
): ReactNode {
  if (value === undefined) {
    return <p className="text-sm text-gray-400">AI 분석 중입니다...</p>;
  }

  if (value === null || value.trim() === "") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-400">분석 없음</p>
        {onRetry ? (
          <button
            type="button"
            disabled={retryBusy}
            className="self-start text-xs text-blue-500 underline disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onRetry()}
          >
            {retryBusy ? "분석 중…" : "다시 분석하기"}
          </button>
        ) : null}
      </div>
    );
  }

  return formatBody(value);
}

function SectionBlock({
  label,
  value,
  onRetry,
  retryBusy,
}: {
  label: string;
  value?: string | null;
  onRetry?: () => void;
  retryBusy?: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-100 bg-white/70 p-4 shadow-sm shadow-violet-950/5">
      <p className="mb-2 text-xs font-medium text-violet-800">{label}</p>
      <div className="space-y-1 text-sm text-zinc-800">
        {renderAiAnalysis(value, onRetry, retryBusy, (text) =>
          formatAiSentence(text),
        )}
      </div>
    </div>
  );
}

function AiAnalysisSummaryBlock({
  value,
  onRetry,
  retryBusy,
}: {
  value?: string | null;
  onRetry?: () => void;
  retryBusy?: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-100 bg-white/80 p-4 shadow-sm shadow-violet-950/5">
      <p className="mb-3 text-xs font-medium text-violet-800">요약</p>
      {renderAiAnalysis(value, onRetry, retryBusy, (text) =>
        formatAiSummary(text),
      )}
    </div>
  );
}

type ArchiveItem = {
  outputId: string;
  projectId: string;
  projectName: string;
  status: Status;
  reason: string;
  description: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  /** 시안 이미지 URL */
  image_url: string | null;
  tags: string[];
};

const TAG_OPTIONS = [
  "인쇄물 디자인",
  "포스터 디자인",
  "교구 디자인",
  "피피티 장표",
  "캐릭터",
  "모바일 디자인",
  "상세페이지",
  "문자 썸네일",
  "현수막",
  "배너",
  "스토리 배경",
];

export default function ArchivePage() {
  const { state, createOutput, createProject, updateOutput, trashOutput } =
    useStore();
  const [status, setStatus] = useState<Status>("Approved");
  const [feedback, setFeedback] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const activeProjects = useMemo(
    () => (state.projects ?? []).filter((p) => !p.deleted),
    [state.projects],
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [monthFilter, setMonthFilter] = useState<"all" | "2026-03" | "2026-02">(
    "all",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [draftProjectId, setDraftProjectId] = useState("");
  const [draftStatus, setDraftStatus] = useState<Status>("Approved");
  const [draftReason, setDraftReason] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTagsText, setDraftTagsText] = useState("");
  const [draftImage, setDraftImage] = useState<string | undefined>(undefined);
  const [detailEditBaseline, setDetailEditBaseline] =
    useState<DetailEditBaseline | null>(null);
  const lastOpenedDetailIdRef = useRef<string | null>(null);
  const [aiRetryingOutputId, setAiRetryingOutputId] = useState<string | null>(
    null,
  );

  const fetchAiFieldsForFeedback = async (selectedId: string) => {
    const { data, error } = await supabase
      .from("feedbacks")
      .select(`
    ai_background,
    ai_typography,
    ai_copywriting,
    ai_layout,
    ai_key_visual,
    ai_summary
  `)
      .eq("id", selectedId)
      .single();

    if (error || !data) return;

    const r = data as Record<string, unknown>;
    const cell = (key: string): string | null => {
      const v = r[key];
      if (v == null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    updateOutput(selectedId, {
      ai_background: cell("ai_background"),
      ai_typography: cell("ai_typography"),
      ai_copywriting: cell("ai_copywriting"),
      ai_layout: cell("ai_layout"),
      ai_key_visual: cell("ai_key_visual"),
      ai_summary: cell("ai_summary"),
    });
  };

  function openDetailPanel(selectedId: string) {
    const existing = state.outputs.find(
      (o) => o.id === selectedId && !o.deleted,
    );
    if (existing) {
      setDraftProjectId(existing.projectId);
      setDraftStatus(existing.status);
      setDraftReason(existing.reason);
      setDraftDescription(existing.description);
      setDraftTagsText((existing.tags ?? []).join(", "));
      setDraftImage(existing.image_url ?? undefined);
      setDetailEditBaseline({
        projectId: existing.projectId,
        status: existing.status,
        reason: existing.reason,
        description: existing.description,
        tags: [...(existing.tags ?? [])],
        imageUrl: existing.image_url ?? null,
      });
      lastOpenedDetailIdRef.current = selectedId;
    }
    setDetailOutputId(selectedId);

    if (existing?.ai_background) return;

    void fetchAiFieldsForFeedback(selectedId);
  }

  useEffect(() => {
    if (!detailOutputId) {
      lastOpenedDetailIdRef.current = null;
      setDetailEditBaseline(null);
      return;
    }
    const o = state.outputs.find(
      (x) => x.id === detailOutputId && !x.deleted,
    );
    if (!o) {
      setDetailOutputId(null);
      return;
    }
    setDraftProjectId(o.projectId);
    setDraftStatus(o.status);
    setDraftReason(o.reason);
    setDraftDescription(o.description);
    setDraftTagsText((o.tags ?? []).join(", "));
    setDraftImage(o.image_url ?? undefined);

    if (lastOpenedDetailIdRef.current !== detailOutputId) {
      lastOpenedDetailIdRef.current = detailOutputId;
      setDetailEditBaseline({
        projectId: o.projectId,
        status: o.status,
        reason: o.reason,
        description: o.description,
        tags: [...(o.tags ?? [])],
        imageUrl: o.image_url ?? null,
      });
    }
  }, [detailOutputId, state.outputs]);

  const isDetailDirty = useMemo(() => {
    if (!detailEditBaseline || !draftProjectId) return false;
    const b = detailEditBaseline;
    const normReason = draftReason.trim() || "(피드백 없음)";
    const normDesc = draftDescription.trim() || "시안 업로드";
    const baselineReason = b.reason.trim() || "(피드백 없음)";
    const baselineDesc = b.description.trim() || "시안 업로드";
    const draftTags = draftTagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagsEq =
      detailTagsNormalizedKey(draftTags) === detailTagsNormalizedKey(b.tags);

    return (
      draftProjectId !== b.projectId ||
      draftStatus !== b.status ||
      normReason !== baselineReason ||
      normDesc !== baselineDesc ||
      !tagsEq ||
      (draftImage ?? null) !== (b.imageUrl ?? null)
    );
  }, [
    detailEditBaseline,
    draftProjectId,
    draftStatus,
    draftReason,
    draftDescription,
    draftTagsText,
    draftImage,
  ]);

  const detailOutput = useMemo(
    () =>
      detailOutputId
        ? state.outputs.find((x) => x.id === detailOutputId && !x.deleted)
        : undefined,
    [detailOutputId, state.outputs],
  );

  const handleRetryAnalysis = useCallback(
    async (outputId: string) => {
      const o = state.outputs.find((x) => x.id === outputId && !x.deleted);
      if (!o) return;

      setAiRetryingOutputId(outputId);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/feedbacks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            project_id: o.projectId,
            description: o.description,
            image_url: o.image_url ?? "",
            output_id: o.id,
            status: o.status,
            reason: o.reason,
          }),
        });

        const data: unknown = await res.json().catch(() => null);
        if (!res.ok || !data || typeof data !== "object") return;
        const rec = data as { row?: Record<string, unknown> };
        if (!rec.row) return;
        const m = mapFeedbackRow(rec.row);
        updateOutput(o.id, {
          ai_background: m.ai_background,
          ai_typography: m.ai_typography,
          ai_copywriting: m.ai_copywriting,
          ai_layout: m.ai_layout,
          ai_key_visual: m.ai_key_visual,
          ai_summary: m.ai_summary,
        });
      } finally {
        setAiRetryingOutputId((cur) => (cur === outputId ? null : cur));
      }
    },
    [state.outputs, updateOutput],
  );

  const handleDraftDetailStatusChange = (newStatus: Status) => {
    if (newStatus === draftStatus) return;
    const confirmed = window.confirm(
      "상태를 수정하면 AI 분석이 다시 실행됩니다.\n진행하시겠습니까?",
    );
    if (!confirmed) return;
    setDraftStatus(newStatus);
  };

  const handleSaveDetail = () => {
    if (!detailOutputId || !draftProjectId || !isDetailDirty) return;
    const normReason = draftReason.trim() || "(피드백 없음)";
    const normDesc = draftDescription.trim() || "시안 업로드";
    const nextTags = draftTagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateOutput(detailOutputId, {
      projectId: draftProjectId,
      status: draftStatus,
      reason: normReason,
      description: normDesc,
      tags: nextTags,
      image_url: draftImage ?? null,
    });
    setDetailEditBaseline({
      projectId: draftProjectId,
      status: draftStatus,
      reason: normReason,
      description: normDesc,
      tags: nextTags,
      imageUrl: draftImage ?? null,
    });
    setDetailOutputId(null);
  };

  const handleTrashDetail = () => {
    if (!detailOutputId) return;
    trashOutput(detailOutputId);
    setDetailOutputId(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const setImageFromFile = (file: File) => {
    setSelectedFileName(file.name);
    setUploadFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string); // data URL (base64)
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFromFile(file);
  };

  const handleDetailImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDraftImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const outputs = useMemo(() => {
    const all = (state.outputs ?? []).filter((o) => !o.deleted);
    const mapped = all.map((o) => {
      const projectName =
        activeProjects.find((p) => p.id === o.projectId)?.name ?? "알 수 없음";
      return {
        outputId: o.id,
        projectId: o.projectId,
        projectName,
        status: o.status,
        reason: o.reason,
        description: o.description,
        date: o.createdAt.slice(0, 10),
        createdAt: o.createdAt,
        image_url: o.image_url,
        tags: o.tags ?? [],
      } satisfies ArchiveItem;
    });
    return mapped;
  }, [state.outputs, activeProjects]);

  const sortedOutputs = useMemo(() => {
    return [...outputs].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [outputs]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, ArchiveItem[]>();
    sortedOutputs.forEach((item) => {
      if (monthFilter !== "all") {
        const itemMonth = item.createdAt.slice(0, 7);
        if (itemMonth !== monthFilter) return;
      }

      const key = item.projectId;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(item);
    });

    return map;
  }, [sortedOutputs, monthFilter]);

  const handleUpload = async () => {
    console.log("UPLOAD CLICKED");
    if (!selectedProjectId) return;
    setUploadError(null);
    setUploading(true);
    try {
      let designImageUrl: string | undefined;
      if (uploadFile) {
        const fileName = buildFeedbackStorageFileName(
          uploadFile.name,
          status,
        );
        const filePath = `feedbacks/${fileName}`;
        const { error: storageError } = await supabase.storage
          .from("images")
          .upload(filePath, uploadFile);
        if (storageError) {
          setUploadError(
            storageError.message || "이미지 업로드에 실패했습니다.",
          );
          return;
        }
        const { data: publicUrlData } = supabase.storage
          .from("images")
          .getPublicUrl(filePath);
        designImageUrl = publicUrlData.publicUrl;
      } else {
        designImageUrl = preview ?? undefined;
      }

      const newOutput = await createOutput({
        projectId: selectedProjectId,
        output_type: "design",
        description: selectedFileName
          ? `시안: ${selectedFileName}`
          : "시안 업로드",
        status,
        reason: feedback.trim() || "(피드백 없음)",
        tags: selectedTags,
        image_url: designImageUrl ?? null,
        deleted: false,
      });
      setFeedback("");
      setSelectedFileName(null);
      setUploadFile(null);
      setPreview(null);
      setSelectedTags([]);
      setExpanded(false);
      setIsAdding(false);
      setNewTag("");

      void (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          console.log("BEFORE FETCH");

          const res = await fetch("/api/feedbacks", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token ?? ""}`,
            },
            body: JSON.stringify({
              project_id: selectedProjectId,
              description: newOutput.description,
              image_url: newOutput.image_url ?? "",
              output_id: newOutput.id,
              status: newOutput.status,
              reason: newOutput.reason,
            }),
          });

          console.log("AFTER FETCH");
          const data: unknown = await res.json().catch(() => null);
          console.log("API RESULT:", data);
          if (!res.ok || !data || typeof data !== "object") return;
          const rec = data as { row?: Record<string, unknown> };
          if (!rec.row) return;
          const m = mapFeedbackRow(rec.row);
          console.log("MAPPED RESULT:", m);
          updateOutput(newOutput.id, {
            ai_background: m.ai_background,
            ai_typography: m.ai_typography,
            ai_copywriting: m.ai_copywriting,
            ai_layout: m.ai_layout,
            ai_key_visual: m.ai_key_visual,
            ai_summary: m.ai_summary,
          });
        } catch {
          /* AI 보조 갱신 실패는 조용히 무시 */
        }
      })();
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "업로드에 실패했습니다.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white px-6 py-4 shadow">
            <p className="text-sm font-medium">업로드 중입니다...</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            피드백 아카이브
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            프로젝트별 디자인 시안과 피드백, 업로드 내역을 모아봅니다.
          </p>
        </div>
      </header>

      {/* Upload section */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
          {/* Left: upload + status */}
          <div className="flex w-full flex-1 flex-col">
            <p className="text-xs font-medium text-zinc-500">시안 업로드</p>
            <div className="mt-2">
              <label
                className={`group relative flex h-[320px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-dashed shadow-sm transition-colors ${
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
                  if (file) {
                    if (file.type.startsWith("image/")) {
                      setImageFromFile(file);
                    } else {
                      setSelectedFileName(file.name);
                      setUploadFile(null);
                      setPreview(null);
                    }
                  }
                  setIsDragging(false);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
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
                      <img
                        src={preview}
                        alt="preview"
                        className="w-full h-full object-contain rounded-xl"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
                        이미지 변경
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setStatus("Rejected")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  status === "Rejected"
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-zinc-200 bg-white text-zinc-500"
                }`}
              >
                <X
                  className={`h-4 w-4 ${
                    status === "Rejected" ? "text-rose-600" : "text-zinc-400"
                  }`}
                />
                <span>거절됨</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("Approved")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  status === "Approved"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-500"
                }`}
              >
                <Check
                  className={`h-4 w-4 ${
                    status === "Approved"
                      ? "text-emerald-600"
                      : "text-zinc-400"
                  }`}
                />
                <span>승인됨</span>
              </button>
            </div>
          </div>

          {/* Right: project / hashtags / feedback */}
          <div className="flex h-full min-h-0 w-full flex-1 flex-col justify-between">
            <div className="shrink-0 space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">프로젝트 선택</p>
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

              <div>
                <p className="text-xs font-medium text-zinc-500">#해시태그</p>
                <div
                  className={`mt-2 flex flex-wrap gap-2 overflow-hidden ${
                    expanded ? "" : "h-[72px]"
                  }`}
                >
                  {TAG_OPTIONS.map((tag) => {
                    const isActive = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          isActive
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  {selectedTags
                    .filter((t) => !TAG_OPTIONS.includes(t))
                    .map((tag) => (
                      <button
                        key={`custom-${tag}`}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-sm text-white transition"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                  {!expanded ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="hover:text-zinc-600"
                    >
                      더 보기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="hover:text-zinc-600"
                    >
                      접기
                    </button>
                  )}

                  <span className="text-zinc-300" aria-hidden>
                    |
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="hover:text-zinc-600"
                  >
                    추가하기
                  </button>
                </div>
                {isAdding ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="새 태그 입력"
                      className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const t = newTag.trim();
                        if (!t) return;
                        setSelectedTags((prev) => {
                          if (prev.includes(t)) return prev;
                          return [...prev, t];
                        });
                        setNewTag("");
                        setIsAdding(false);
                      }}
                      className="shrink-0 text-xs text-zinc-500 hover:text-zinc-800"
                    >
                      추가
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <p className="text-xs font-medium text-zinc-500">피드백 입력</p>
              <div className="relative mt-2 flex min-h-0 flex-1 flex-col">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[150px] w-full flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pb-16 pr-28 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  placeholder="시안에 대한 피드백을 기록하세요."
                />
                <button
                  type="button"
                  onClick={handleUpload}
                  className="absolute bottom-[20px] right-[20px] inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-900"
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  피드백 업로드
                </button>
              </div>
              {uploadError ? (
                <p className="mt-2 text-xs font-medium text-rose-600">
                  {uploadError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Month filter */}
      <section className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        {[
          { id: "all", label: "전체" },
          { id: "2026-03", label: "2026년 3월" },
          { id: "2026-02", label: "2026년 2월" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              setMonthFilter(option.id as "all" | "2026-03" | "2026-02")
            }
            className={`rounded-full px-3 py-1 ${
              monthFilter === option.id
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </section>

      {/* Design list grouped by project */}
      <section className="space-y-6">
        {Array.from(groupedByProject.entries()).map(([projectId, items]) => (
          <div key={projectId} className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-900">
                {items[0]?.projectName ?? "알 수 없음"}
              </h2>
              <div className="h-px w-full bg-zinc-200/80" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((item) => {
                const approved = item.status === "Approved";
                return (
                  <article
                    key={item.outputId}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetailPanel(item.outputId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetailPanel(item.outputId);
                      }
                    }}
                    className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    <div className="h-[11.25rem] w-full overflow-hidden bg-zinc-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            approved
                              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                              : "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                          }`}
                        >
                          {approved ? (
                            <Check
                              className="h-3 w-3 shrink-0 text-emerald-700"
                              aria-hidden
                            />
                          ) : (
                            <X
                              className="h-3 w-3 shrink-0 text-rose-700"
                              aria-hidden
                            />
                          )}
                          {statusLabelKo(item.status)}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {item.date}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-700 line-clamp-2">
                        {item.reason}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {detailOutputId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setDetailOutputId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="archive-detail-title"
              className="text-sm font-semibold text-zinc-900"
            >
              시안 상세 · 편집
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              등록일:{" "}
              {state.outputs.find((o) => o.id === detailOutputId)?.createdAt?.slice(
                0,
                19,
              )?.replace("T", " ") ?? ""}
            </p>

            <div className="mt-4 space-y-4">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {draftImage ? (
                  <img
                    src={draftImage}
                    alt=""
                    className="max-h-48 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs text-zinc-400">
                    No Image
                  </div>
                )}
              </div>
              <div>
                <label
                  htmlFor="detail-image-replace"
                  className="text-xs font-medium text-zinc-600"
                >
                  이미지 교체
                </label>
                <input
                  id="detail-image-replace"
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-xs text-zinc-600 file:mr-2 file:rounded-md file:border file:border-zinc-200 file:bg-white file:px-2 file:py-1"
                  onChange={handleDetailImageChange}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500">프로젝트</p>
                <div className="mt-2 w-full min-w-0">
                  <CustomDropdown
                    triggerType="status"
                    options={activeProjects.map((p) => p.name)}
                    optionValues={activeProjects.map((p) => p.id)}
                    value={draftProjectId}
                    onChange={setDraftProjectId}
                    placeholder="프로젝트를 선택해주세요."
                    onCreateNew={async (name) => {
                      try {
                        const p = await createProject({
                          name,
                          description: "",
                          category: "미분류",
                          leader: "미선택",
                        });
                        setDraftProjectId(p.id);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500">상태</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDraftDetailStatusChange("Rejected")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      draftStatus === "Rejected"
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-zinc-200 bg-white text-zinc-500"
                    }`}
                  >
                    <X
                      className={`h-4 w-4 ${
                        draftStatus === "Rejected"
                          ? "text-rose-600"
                          : "text-zinc-400"
                      }`}
                    />
                    <span>거절됨</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDraftDetailStatusChange("Approved")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      draftStatus === "Approved"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-white text-zinc-500"
                    }`}
                  >
                    <Check
                      className={`h-4 w-4 ${
                        draftStatus === "Approved"
                          ? "text-emerald-600"
                          : "text-zinc-400"
                      }`}
                    />
                    <span>승인됨</span>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="detail-description"
                  className="text-xs font-medium text-zinc-500"
                >
                  시안 설명
                </label>
                <input
                  id="detail-description"
                  type="text"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <div>
                <label
                  htmlFor="detail-reason"
                  className="text-xs font-medium text-zinc-500"
                >
                  피드백
                </label>
                <textarea
                  id="detail-reason"
                  value={draftReason}
                  onChange={(e) => setDraftReason(e.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label
                  htmlFor="detail-tags"
                  className="text-xs font-medium text-zinc-500"
                >
                  해시태그 (쉼표로 구분)
                </label>
                <textarea
                  id="detail-tags"
                  value={draftTagsText}
                  onChange={(e) => setDraftTagsText(e.target.value)}
                  rows={2}
                  className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              {detailOutput ? (
                <div className="space-y-6 rounded-2xl border border-violet-200/80 bg-violet-50/60 p-5 ring-1 ring-violet-100/80">
                  <h2 className="text-sm font-semibold text-violet-900">
                    AI 분석
                  </h2>

                  <AiAnalysisSummaryBlock
                    value={detailOutput.ai_summary}
                    onRetry={() => void handleRetryAnalysis(detailOutput.id)}
                    retryBusy={aiRetryingOutputId === detailOutput.id}
                  />

                  <div className="space-y-4">
                    <SectionBlock
                      label="배경 그래픽"
                      value={detailOutput.ai_background}
                      onRetry={() => void handleRetryAnalysis(detailOutput.id)}
                      retryBusy={aiRetryingOutputId === detailOutput.id}
                    />
                    <SectionBlock
                      label="타이포그래피"
                      value={detailOutput.ai_typography}
                      onRetry={() => void handleRetryAnalysis(detailOutput.id)}
                      retryBusy={aiRetryingOutputId === detailOutput.id}
                    />
                    <SectionBlock
                      label="카피라이팅"
                      value={detailOutput.ai_copywriting}
                      onRetry={() => void handleRetryAnalysis(detailOutput.id)}
                      retryBusy={aiRetryingOutputId === detailOutput.id}
                    />
                    <SectionBlock
                      label="레이아웃"
                      value={detailOutput.ai_layout}
                      onRetry={() => void handleRetryAnalysis(detailOutput.id)}
                      retryBusy={aiRetryingOutputId === detailOutput.id}
                    />
                    <SectionBlock
                      label="메인 그래픽"
                      value={detailOutput.ai_key_visual}
                      onRetry={() => void handleRetryAnalysis(detailOutput.id)}
                      retryBusy={aiRetryingOutputId === detailOutput.id}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={handleTrashDetail}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700"
              >
                삭제하기
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDetailOutputId(null)}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleSaveDetail}
                  disabled={!draftProjectId || !isDetailDirty}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    draftProjectId && isDetailDirty
                      ? "bg-black text-white hover:bg-zinc-800"
                      : "cursor-not-allowed bg-zinc-200 text-zinc-400"
                  }`}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

