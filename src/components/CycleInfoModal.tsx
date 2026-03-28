"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** 업무 방식은 루틴/단발성 고정 — 안내용 */
export function CycleInfoModal({ open, onClose }: Props) {
  if (!open) return null;

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
        aria-labelledby="cycle-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="cycle-modal-title"
          className="text-sm font-semibold text-zinc-900"
        >
          업무 방식
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          업무 방식은 <strong className="text-zinc-800">단발성</strong>과{" "}
          <strong className="text-zinc-800">루틴</strong> 두 가지로 고정되어
          있습니다. 옵션을 바꾸려면 제품 설정에서 별도로 지원할 때까지 이
          목록만 사용할 수 있습니다.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
