/** 고정 워크타입 목록 (드롭다운 옵션은 이 목록만) */
export const WORK_TYPES = [
  "내부 지원",
  "제품 생산",
  "제품 리뉴얼",
  "마케팅 및 브랜딩",
  "플랫폼 관리",
  "팀 리포트",
] as const;

/** 업무 방식 (고정, 생성/편집 없음) */
export const CYCLES = ["단발성", "루틴"] as const;

export type WorkTypeLabel = (typeof WORK_TYPES)[number];
export type CycleLabel = (typeof CYCLES)[number];
