"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measures anchor (trigger container) and flips the menu upward when
 * there is not enough space below (~200px).
 */
export function useDropdownDirection(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    if (!open || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }
  }, [open]);

  return { ref, openUpward };
}

type DropdownMenuProps = {
  open: boolean;
  openUpward: boolean;
  /** Full width of anchor vs compact floating width */
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Shared positioned panel — use inside a `relative` anchor with `useDropdownDirection`. */
export function DropdownMenu({
  open,
  openUpward,
  wide = true,
  className = "",
  children,
}: DropdownMenuProps) {
  if (!open) return null;

  return (
    <div
      className={[
        "absolute left-0 z-50 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md transition-opacity duration-150",
        openUpward ? "bottom-full mb-2" : "top-full mt-2",
        wide
          ? "w-full"
          : "min-w-[12rem] w-max max-w-[min(100vw-2rem,20rem)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
