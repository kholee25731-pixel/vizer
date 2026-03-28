"use client";

import { useState } from "react";
import { useStore } from "../app/providers";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** 워크타입 목록 추가/삭제 (스토어 `categories`) */
export function WorkTypesManageModal({ open, onClose }: Props) {
  const { state, addWorkType, removeWorkType } = useStore();
  const [newLabel, setNewLabel] = useState("");

  if (!open) return null;

  const handleAdd = () => {
    const t = newLabel.trim();
    if (!t) return;
    addWorkType(t);
    setNewLabel("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="worktypes-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="worktypes-modal-title"
          className="text-sm font-semibold text-zinc-900"
        >
          워크타입 편집
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          목록에 항목을 추가하거나 삭제할 수 있습니다. 삭제 시 해당 워크타입을 쓰는
          프로젝트는 다른 값으로 바뀝니다.
        </p>

        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 p-2">
          {state.categories.map((c) => (
            <li
              key={c}
              className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-sm text-zinc-800"
            >
              <span className="min-w-0 truncate">{c}</span>
              <button
                type="button"
                disabled={state.categories.length <= 1}
                onClick={() => removeWorkType(c)}
                className="shrink-0 text-xs font-medium text-rose-600 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="새 워크타입 이름"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
          >
            추가
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
