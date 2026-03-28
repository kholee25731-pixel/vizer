"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, UploadCloud, X, ArrowUpFromLine } from "lucide-react";
import { CustomDropdown } from "../../components/CustomDropdown";
import { useStore } from "../providers";

type Status = "Approved" | "Rejected";

function statusLabelKo(s: Status): string {
  return s === "Approved" ? "승인됨" : "거절됨";
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
  /** data URL from design_image_data_url */
  imageUrl?: string;
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
  const { state, createOutput, createProject, updateOutput } = useStore();
  const [status, setStatus] = useState<Status>("Approved");
  const [feedback, setFeedback] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
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

  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [draftProjectId, setDraftProjectId] = useState("");
  const [draftStatus, setDraftStatus] = useState<Status>("Approved");
  const [draftReason, setDraftReason] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTagsText, setDraftTagsText] = useState("");
  const [draftImage, setDraftImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!detailOutputId) return;
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
    setDraftImage(o.design_image_data_url);
  }, [detailOutputId, state.outputs]);

  const handleSaveDetail = () => {
    if (!detailOutputId || !draftProjectId) return;
    updateOutput(detailOutputId, {
      projectId: draftProjectId,
      status: draftStatus,
      reason: draftReason.trim() || "(피드백 없음)",
      description: draftDescription.trim() || "시안 업로드",
      tags: draftTagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      design_image_data_url: draftImage,
    });
    setDetailOutputId(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const setImageFromFile = (file: File) => {
    setSelectedFileName(file.name);

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
    return all.map((o) => {
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
        imageUrl: o.design_image_data_url,
        tags: o.tags ?? [],
      } satisfies ArchiveItem;
    });
  }, [state.outputs, activeProjects]);

  const filteredItems = useMemo(() => {
    if (monthFilter === "all") return outputs;
    return outputs.filter((item) => item.date.startsWith(monthFilter));
  }, [monthFilter, outputs]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, ArchiveItem[]>();
    for (const item of filteredItems) {
      if (!map.has(item.projectName)) map.set(item.projectName, []);
      map.get(item.projectName)!.push(item);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  const handleUpload = () => {
    if (!selectedProjectId) return;
    createOutput({
      projectId: selectedProjectId,
      output_type: "design",
      description: selectedFileName ? `시안: ${selectedFileName}` : "시안 업로드",
      status,
      reason: feedback.trim() || "(피드백 없음)",
      tags: selectedTags,
      design_image_data_url: preview ?? undefined,
      deleted: false,
    });
    setFeedback("");
    setSelectedFileName(null);
    setPreview(null);
    setSelectedTags([]);
    setExpanded(false);
    setIsAdding(false);
    setNewTag("");
  };

  return (
    <div className="space-y-6">
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
                      const p = await createProject({
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
        {groupedByProject.map(([projectName, items]) => (
          <div key={projectName} className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-900">
                {projectName}
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
                    onClick={() => setDetailOutputId(item.outputId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailOutputId(item.outputId);
                      }
                    }}
                    className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    <div className="h-[11.25rem] w-full overflow-hidden bg-zinc-100">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
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
                      const p = await createProject({
                        name,
                        description: "",
                        category: "미분류",
                        leader: "미선택",
                      });
                      setDraftProjectId(p.id);
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500">상태</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftStatus("Rejected")}
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
                    onClick={() => setDraftStatus("Approved")}
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
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
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
                disabled={!draftProjectId}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

