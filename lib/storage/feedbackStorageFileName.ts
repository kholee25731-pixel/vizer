/** yy.mm.dd (로컬 날짜) */
export function formatDateYYMMDD(now = new Date()): string {
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/** 4자리 URL-safe 랜덤 */
export function generateShortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function getStatusPrefix(status: string): "acp" | "rej" | "unk" {
  if (status === "Approved") return "acp";
  if (status === "Rejected") return "rej";
  return "unk";
}

/** 확장자: 영문·숫자만, 비어 있으면 jpg */
function urlSafeExt(originalFileName: string): string {
  const part = originalFileName.includes(".")
    ? originalFileName.split(".").pop() ?? ""
    : "";
  const cleaned = part.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned || cleaned.length > 8) return "jpg";
  return cleaned;
}

/**
 * 원본 이름은 확장자 추출용으로만 사용. 최종 문자열에 포함하지 않음.
 * 예: feedback_26.03.29_acp1a2b.png
 */
export function buildFeedbackStorageFileName(
  originalFileName: string,
  status?: string,
): string {
  const ext = urlSafeExt(originalFileName);
  const date = formatDateYYMMDD();
  const prefix = getStatusPrefix(status ?? "");
  const shortId = generateShortId();
  return `feedback_${date}_${prefix}${shortId}.${ext}`;
}
