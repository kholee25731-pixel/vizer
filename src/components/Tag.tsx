import { ChevronDown } from "lucide-react";
import { getTagColor } from "../lib/getTagColor";

type Props = {
  label: string;
  /** 워크타입·업무 방식 전용 고정 스카이 (getTagColor 미사용) */
  variant?: "default" | "sky";
  /** Line chevron inside the pill (dropdown triggers) */
  withChevron?: boolean;
  chevronOpen?: boolean;
};

export function Tag({
  label,
  variant = "default",
  withChevron,
  chevronOpen,
}: Props) {
  const hashColors = getTagColor(label);
  const [bgClass, textClass] =
    variant === "sky"
      ? (["bg-sky-100", "text-sky-700"] as const)
      : hashColors;
  const chevronClass =
    variant === "sky" ? "text-sky-600" : "text-zinc-400";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${bgClass} ${textClass}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {withChevron ? (
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${chevronClass} ${chevronOpen ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
    </span>
  );
}
