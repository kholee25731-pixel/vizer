"use client";

import type { HTMLAttributes } from "react";

export type FeedbackCardProps = {
  imageUrl?: string;
  status: "accepted" | "rejected";
  reason: string;
  date: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

/** Feedback / archive card — thumbnail on top, status + date + reason below. */
export function FeedbackCard({
  imageUrl,
  status,
  reason,
  date,
  className,
  ...rest
}: FeedbackCardProps) {
  const accepted = status === "accepted";

  const root = [
    "flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={root} {...rest}>
      <div className="aspect-square w-full overflow-hidden bg-zinc-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-0 items-center justify-center text-xs text-zinc-400">
            No Image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              accepted
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
            }`}
          >
            {accepted ? "Approved" : "Rejected"}
          </span>
          <span className="shrink-0 text-[11px] text-zinc-400">{date}</span>
        </div>
        <p className="min-w-0 overflow-hidden break-words text-xs text-zinc-700 line-clamp-2">
          {reason}
        </p>
      </div>
    </div>
  );
}
