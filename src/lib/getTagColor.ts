const PALETTE: [string, string][] = [
  ["bg-blue-100", "text-blue-700"],
  ["bg-pink-100", "text-pink-700"],
  ["bg-green-100", "text-green-700"],
  ["bg-purple-100", "text-purple-700"],
  ["bg-yellow-100", "text-yellow-700"],
  ["bg-indigo-100", "text-indigo-700"],
];

function hashLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (Math.imul(31, h) + label.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic pastel Tailwind classes for a label (same label → same colors). */
export function getTagColor(label: string): [string, string] {
  const idx = hashLabel(label) % PALETTE.length;
  return PALETTE[idx]!;
}
