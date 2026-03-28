"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { DropdownMenu, useDropdownDirection } from "./ui/Dropdown";
import { Tag } from "./Tag";

export type CustomDropdownProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void | Promise<void>;
  placeholder?: string;
  /** When set, `value` / `onChange` use these instead of option labels (same length as options). */
  optionValues?: string[];
  /** When user creates a new item; if omitted, `onChange(newLabel)` is used for create. */
  onCreateNew?: (label: string) => void;
  /** When false, no “새 항목 생성” and Enter only selects a filtered option. */
  allowCreate?: boolean;
  /**
   * `inline`: Tag + chevron only, no bordered trigger; panel floats below (table cells).
   * `default`: full-width bordered trigger (forms).
   */
  variant?: "default" | "inline";
  /**
   * `tag`: same as `variant="inline"` — Tag + chevron, no input box.
   * `field`: same as `variant="default"` — bordered trigger with Tag inside.
   * `status`: flat button (상태 선택과 동일 톤) + 목록은 텍스트만, 태그 색 없음.
   * When set, overrides `variant` for the trigger only.
   */
  triggerType?: "field" | "tag" | "status";
  /** 워크타입·업무 방식: 고정 스카이 태그 / 리더 등은 default(해시) */
  tagVariant?: "default" | "sky";
  /** 패널이 열렸을 때 하단에 Edit 표시 */
  showEditButton?: boolean;
  onEditClick?: () => void;
  /** true면 선택 비활성화 + 저장 중 스피너·문구 (예: Supabase 동기화) */
  pending?: boolean;
};

export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "선택…",
  optionValues,
  onCreateNew,
  allowCreate = true,
  variant = "default",
  triggerType,
  tagVariant = "default",
  showEditButton = false,
  onEditClick,
  pending = false,
}: CustomDropdownProps) {
  const isInlineTrigger =
    triggerType === "tag"
      ? true
      : triggerType === "field" || triggerType === "status"
        ? false
        : variant === "inline";

  const isStatusTrigger = triggerType === "status";
  const flatList = isStatusTrigger;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { ref: rootRef, openUpward } = useDropdownDirection(open);

  const values = optionValues ?? options;

  const displayLabel = useMemo(() => {
    const i = values.findIndex((v) => v === value);
    if (i >= 0) return options[i] ?? value;
    return value || "";
  }, [options, values, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.map((label, i) => ({ label, i }));
    return options
      .map((label, i) => ({ label, i }))
      .filter(({ label }) => label.toLowerCase().includes(q));
  }, [options, query]);

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return options.some((o) => o.toLowerCase() === q);
  }, [options, query]);

  const canCreate =
    allowCreate && query.trim().length > 0 && !hasExactMatch;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (pending) close();
  }, [pending, close]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  const selectIndex = (i: number) => {
    if (pending) return;
    onChange(values[i] ?? options[i]);
    close();
  };

  const handleCreate = () => {
    if (pending) return;
    const label = query.trim();
    if (!label) return;
    if (onCreateNew) onCreateNew(label);
    else onChange(label);
    close();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate) {
        handleCreate();
        return;
      }
      if (filtered.length === 1) {
        selectIndex(filtered[0].i);
        return;
      }
      if (filtered.length > 0) {
        selectIndex(filtered[0].i);
      }
    }
  };

  const panelWide = isInlineTrigger ? false : true;

  const panel = (
    <DropdownMenu open={open && !pending} openUpward={openUpward} wide={panelWide}>
      <div className="space-y-1 border-b border-zinc-100 bg-white px-2 py-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={allowCreate ? "검색 또는 생성…" : "검색…"}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>
      <ul className="max-h-48 space-y-0 overflow-y-auto bg-white py-0.5">
        {filtered.map(({ label, i }) => {
          const v = values[i];
          const selected = v === value;
          return (
            <li key={`${label}-${i}`}>
              <button
                type="button"
                disabled={pending}
                onClick={() => selectIndex(i)}
                className={
                  flatList
                    ? `flex w-full cursor-pointer items-center justify-between gap-1.5 px-2 py-1 text-left text-xs hover:bg-zinc-100 ${
                        selected
                          ? "font-medium text-zinc-900"
                          : "text-zinc-700"
                      }`
                    : "flex w-full cursor-pointer items-center justify-between gap-1.5 px-2 py-1 text-left text-xs text-zinc-800 hover:bg-zinc-100"
                }
              >
                {flatList ? (
                  <span className="min-w-0 truncate">{label}</span>
                ) : (
                  <Tag label={label} variant={tagVariant} />
                )}
                {selected ? (
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${
                      flatList ? "text-zinc-400" : "text-zinc-700"
                    }`}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {canCreate ? (
        <div className="border-t border-zinc-100 px-2 py-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={handleCreate}
            className={`w-full rounded-lg px-2 py-1 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 ${
              flatList ? "" : "flex flex-wrap items-center gap-1"
            }`}
          >
            {flatList ? (
              <>
                새 항목 생성:{" "}
                <span className="font-medium text-zinc-900">
                  {query.trim()}
                </span>
              </>
            ) : (
              <>
                <span>새 항목 생성:</span>
                <Tag label={query.trim()} variant={tagVariant} />
              </>
            )}
          </button>
        </div>
      ) : null}
      {showEditButton ? (
        <div className="border-t border-zinc-100 px-2 py-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              close();
              onEditClick?.();
            }}
            className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      ) : null}
    </DropdownMenu>
  );

  if (isStatusTrigger) {
    return (
      <div ref={rootRef} className="relative w-full min-w-0">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            if (pending) return;
            setOpen((o) => !o);
          }}
          className={`flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-zinc-50 ${
            displayLabel ? "text-zinc-700" : "text-zinc-600"
          } ${pending ? "cursor-wait opacity-80" : ""}`}
        >
          <span className="min-w-0 flex-1 truncate">
            {displayLabel ? (
              displayLabel
            ) : (
              <span className="text-zinc-400">{placeholder}</span>
            )}
          </span>
          {pending ? (
            <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-zinc-400">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={2}
                aria-hidden
              />
              <span className="text-[11px] font-medium whitespace-nowrap">
                저장 중…
              </span>
            </span>
          ) : (
            <span className="ml-2 shrink-0 text-zinc-400" aria-hidden>
              ▾
            </span>
          )}
        </button>
        {panel}
      </div>
    );
  }

  if (isInlineTrigger) {
    return (
      <div
        ref={rootRef}
        className="relative inline-flex max-w-full min-w-0 items-center"
      >
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            if (pending) return;
            setOpen((o) => !o);
          }}
          className={`inline-flex h-7 max-w-full min-w-0 items-center gap-1 border-0 bg-transparent p-0 text-left shadow-none outline-none ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 [&:focus]:ring-0 ${
            pending ? "cursor-wait opacity-80" : ""
          }`}
        >
          {displayLabel ? (
            <Tag
              label={displayLabel}
              variant={tagVariant}
              withChevron
              chevronOpen={open && !pending}
            />
          ) : (
            <span className="inline-flex h-7 max-w-full min-w-0 items-center gap-1 text-xs text-zinc-400">
              <span className="truncate">{placeholder}</span>
              <ChevronDown
                className="h-3 w-3 shrink-0 text-zinc-400"
                strokeWidth={2}
                aria-hidden
              />
            </span>
          )}
          {pending ? (
            <>
              <Loader2
                className="h-3 w-3 shrink-0 animate-spin text-zinc-400"
                strokeWidth={2}
                aria-hidden
              />
              <span className="text-[10px] font-medium whitespace-nowrap text-zinc-400">
                저장 중…
              </span>
            </>
          ) : null}
        </button>
        {panel}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (pending) return;
          setOpen((o) => !o);
        }}
        className={`flex min-h-[2.375rem] w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
          pending ? "cursor-wait opacity-80" : ""
        }`}
      >
        <span className="min-w-0 flex-1 text-left">
          {displayLabel ? (
            <Tag
              label={displayLabel}
              variant={tagVariant}
              withChevron
              chevronOpen={open && !pending}
            />
          ) : (
            <span className="text-sm text-zinc-400">{placeholder}</span>
          )}
        </span>
        {pending ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span className="text-[11px] font-medium whitespace-nowrap">
              저장 중…
            </span>
          </span>
        ) : !displayLabel ? (
          <ChevronDown
            className="h-3 w-3 shrink-0 text-zinc-400"
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
      </button>

      {panel}
    </div>
  );
}
