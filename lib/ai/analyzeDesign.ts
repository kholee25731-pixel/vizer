/** 요소별 값 + 컨셉 맥락에서의 역할 */
export type DesignValueRole = { value: string; role: string };

export type DesignAnalysisConcept = {
  main: string;
  keywords: string[];
  /** 이 디자인이 무엇을 전달하려는지 한 문장(키워드 나열 금지) */
  summary: string;
};

export type DesignAnalysisBackground = {
  color: DesignValueRole[];
  texture: DesignValueRole[];
  object: DesignValueRole[];
};

export type DesignAnalysisTypography = {
  font_style: DesignValueRole[];
};

export type DesignAnalysisLayout = {
  structure: DesignValueRole[];
};

export type DesignAnalysisCopywriting = {
  tone_and_wording: DesignValueRole[];
};

export type DesignAnalysisKeyVisual = {
  focal_point: DesignValueRole[];
};

export type DesignAnalysisFeedbackAlignment = {
  matched: string[];
  mismatched: string[];
};

/**
 * 컨셉 기반 해석 구조. DB 저장: background/typography/layout/copywriting/key_visual,
 * ai_summary에는 `{ concept, feedback_alignment }` JSON.
 */
export type DesignAnalysisResult = {
  concept: DesignAnalysisConcept;
  background: DesignAnalysisBackground;
  typography: DesignAnalysisTypography;
  layout: DesignAnalysisLayout;
  copywriting: DesignAnalysisCopywriting;
  key_visual: DesignAnalysisKeyVisual;
  feedback_alignment: DesignAnalysisFeedbackAlignment;
};

function emptyResult(): DesignAnalysisResult {
  return {
    concept: { main: "", keywords: [], summary: "" },
    background: { color: [], texture: [], object: [] },
    typography: { font_style: [] },
    layout: { structure: [] },
    copywriting: { tone_and_wording: [] },
    key_visual: { focal_point: [] },
    feedback_alignment: { matched: [], mismatched: [] },
  };
}

function toKeywordArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = String(x ?? "").trim();
    if (s !== "") out.push(s);
  }
  return out;
}

/** 배열 요소: `{ value, role }` 또는 레거시 문자열 */
function toValueRoleArray(v: unknown): DesignValueRole[] {
  if (!Array.isArray(v)) return [];
  const out: DesignValueRole[] = [];
  for (const x of v) {
    if (x !== null && typeof x === "object" && !Array.isArray(x)) {
      const r = x as Record<string, unknown>;
      const value = String(r.value ?? "").trim();
      const role = String(r.role ?? "").trim();
      if (value || role) out.push({ value, role });
      continue;
    }
    const s = String(x ?? "").trim();
    if (s !== "") out.push({ value: s, role: "" });
  }
  return out;
}

function normConcept(v: unknown): DesignAnalysisConcept {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return { main: "", keywords: [], summary: "" };
  }
  const o = v as Record<string, unknown>;
  return {
    main: String(o.main ?? "").trim(),
    keywords: toKeywordArray(o.keywords),
    summary: String(o.summary ?? "").trim(),
  };
}

function normBackground(v: unknown): DesignAnalysisBackground {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    color: toValueRoleArray(o.color),
    texture: toValueRoleArray(o.texture),
    object: toValueRoleArray(o.object),
  };
}

function normTypography(v: unknown): DesignAnalysisTypography {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    font_style: toValueRoleArray(o.font_style),
  };
}

function normLayout(v: unknown): DesignAnalysisLayout {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    structure: toValueRoleArray(o.structure),
  };
}

function normCopywriting(v: unknown): DesignAnalysisCopywriting {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    tone_and_wording: toValueRoleArray(o.tone_and_wording),
  };
}

function normKeyVisual(v: unknown): DesignAnalysisKeyVisual {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    focal_point: toValueRoleArray(o.focal_point),
  };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = String(x ?? "").trim();
    if (s !== "") out.push(s);
  }
  return out;
}

function normFeedbackAlignment(
  v: unknown,
): DesignAnalysisFeedbackAlignment {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return { matched: [], mismatched: [] };
  }
  const o = v as Record<string, unknown>;
  return {
    matched: toStringArray(o.matched),
    mismatched: toStringArray(o.mismatched),
  };
}

function normalizeParsed(parsed: unknown): DesignAnalysisResult {
  if (!parsed || typeof parsed !== "object") {
    return emptyResult();
  }
  const o = parsed as Record<string, unknown>;
  return {
    concept: normConcept(o.concept),
    background: normBackground(o.background),
    typography: normTypography(o.typography),
    layout: normLayout(o.layout),
    copywriting: normCopywriting(o.copywriting),
    key_visual: normKeyVisual(o.key_visual),
    feedback_alignment: normFeedbackAlignment(o.feedback_alignment),
  };
}

export type AnalyzeDesignInput = {
  image_url: string;
  description: string;
  status: "Approved" | "Rejected";
  reason: string;
};
/**
 * 이미지 URL + 설명 + 승인 여부 + 사용자 피드백으로 OpenAI 호출 후 분석 JSON을 반환합니다.
 * 파싱 실패·HTTP 오류·API 키 없음 → `null` (호출부에서 DB null 처리).
 */
export async function analyzeDesign({
  image_url,
  description,
  status,
  reason,
}: AnalyzeDesignInput): Promise<DesignAnalysisResult | null> {
  console.log("ANALYZE DESIGN CALLED");
  console.log("API KEY CHECK:", process.env.OPENAI_API_KEY);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return null;
  }

  const desc = String(description ?? "").trim() || "(설명 없음)";
  const img = String(image_url ?? "").trim();
  const reasonBlock = String(reason ?? "").trim() || "(사용자 피드백 없음)";

  const userText = `
다음 디자인을 분석하세요.

[디자인 설명]
${desc}

[사용자 피드백]
${reasonBlock}

[판단 결과]
${status}

---

분석은 반드시 2단계로 진행한다.

[1단계: 디자인 자체 분석 (객관)]
- 이미지와 구조만 보고 분석한다
- 사용자 피드백을 참고하지 않는다
- 기존 JSON 구조 (background, typography, layout 등)를 그대로 작성한다

[2단계: 사용자 피드백 검증]
- 사용자 피드백(reason)을 기준으로 분석 결과를 검증한다
- 아래를 반드시 구분해서 작성한다

1. 사용자 피드백과 일치하는 요소
2. 사용자 피드백과 불일치하는 요소

---

[중요 규칙]

- status가 "Approved"인 경우:
  → 디자인의 강점 중심으로 분석
  → 왜 승인될 수 있었는지 설명

- status가 "Rejected"인 경우:
  → 문제점 중심으로 분석
  → 왜 거절되었는지 구조적으로 설명

- 사용자 피드백은 반드시 분석에 반영하되,
  그대로 따라가지 말고 "검증"해야 한다

- 일반적인 디자인 이론 금지
- 반드시 해당 디자인 맥락 기준으로 해석

- concept·background·typography·layout·copywriting·key_visual의 각 항목은 value와 role을 모두 채운다. role은 비우지 않는다.
- copywriting·key_visual은 이미지에서 약하게 보여도 컨셉·레이아웃 근거로 추론해 채운다.
- feedback_alignment.matched / mismatched는 각각 짧은 한국어 문장 문자열 배열로 작성한다.

---

[role 작성 규칙 - 매우 중요]

각 요소의 role은 반드시 아래 3가지를 포함해야 한다:

1. 왜 이 요소를 사용했는지 (디자인 의도)
2. 어떻게 사용되었는지 (구성 방식)
3. 그로 인해 어떤 효과가 발생하는지 (결과)

---

[문장 구조 규칙]

role은 아래 형태를 기본 구조로 작성한다:

"~한 컨셉을 강화하기 위해, ~한 방식으로 ~를 사용하였다."

또는

"~한 효과를 만들기 위해, ~한 구조로 ~를 배치하였다."

---

[구체성 규칙]

- 단순 표현 금지
  (예: "강렬한 인상 제공", "시각적 초점 제공" ❌)

- 반드시 "구체적인 구성 방식" 포함
  (예: 중앙 배치, 색상 대비, 요소 제거 등)

---

[예시 - 나쁜 예]

"세리프체는 고전적인 느낌을 준다"

---

[예시 - 좋은 예]

"고전적인 컨셉을 강화하기 위해, 장식적인 형태를 가진 세리프 서체를 사용하였다."

---

[예시 - 레이아웃]

"중앙에 큰 텍스트를 배치하고 주변 요소를 최소화하여, 시선이 자연스럽게 중앙에 집중되도록 구성하였다."

---

[강제 규칙]

- role이 아래 형태면 무조건 잘못된 것으로 간주한다:

  "느낌을 준다"
  "인상을 준다"
  "강조한다"

→ 반드시 "왜 / 어떻게" 포함하도록 수정할 것

---

[추가 규칙]

- color는 반드시 "어떤 대비/맥락에서 사용되었는지" 포함
- layout은 반드시 "배치 방식" 포함
- typography는 반드시 "서체 선택 이유 + 형태 특징" 포함
- key_visual은 반드시 "시선 흐름" 포함

---

[핵심 규칙 - 매우 중요]

이 디자인은 단순 스타일(굵다, 장식적이다 등)로 설명하면 안 된다.

반드시 아래 기준으로 분석한다:

1. "형태 분석"
- 텍스트/그래픽이 어떤 형태를 하고 있는지 구체적으로 설명
- (예: 물고기 형태, 칼 형태, 새우 형태 등)

2. "메타포 해석"
- 그 형태가 어떤 컨셉을 표현하는지 연결
- (예: 수산시장, 어획, 신선함, 현장감 등)

3. "구성 방식"
- 단순히 존재한다고 말하지 말고
- 어떻게 배치되고 결합되어 있는지 설명

---

[검증 규칙 - 반드시 통과해야 함]

아래 조건을 하나라도 만족하지 못하면 잘못된 분석으로 간주한다:

1. typography 항목에 "구체적인 오브젝트 형태"가 언급되지 않은 경우
   (예: 물고기, 새우, 칼, 파도 등)

2. "메타포" (예: 수산시장, 어획, 시장 현장감 등)가 설명에 포함되지 않은 경우

3. role 문장이 단순 스타일 설명에 그친 경우
   (예: 굵다, 장식적이다, 강렬하다 등)

4. 텍스트를 단순 "폰트"로 해석한 경우
   (이 디자인은 텍스트가 아니라 그래픽 요소로 봐야 한다)

→ 위 조건을 만족하지 않으면 반드시 다시 분석하여 수정할 것

---

[타이포그래피 특별 규칙 - 최우선]

이 디자인의 타이포그래피는 "서체"가 아니라 "그래픽 오브젝트"로 해석해야 한다.

- 글자는 단순 텍스트가 아니라 시각적 오브젝트다
- 각 글자의 형태가 무엇을 닮았는지 반드시 분석해야 한다
- 반드시 아래 질문에 답해야 한다:

  1. 이 글자는 어떤 사물을 닮았는가?
  2. 그 사물은 어떤 컨셉을 의미하는가?
  3. 왜 그 사물을 선택했는가?

→ 이 3가지가 포함되지 않으면 잘못된 분석이다

---

[강제 문장 구조 - 타이포그래피]

role은 반드시 아래 구조로 작성한다:

"~ 컨셉을 표현하기 위해, 글자를 ~ 형태의 오브젝트처럼 변형하여 구성하였다."

---

[추가 금지 규칙]

아래 문장은 생성 금지:

- "굵고 장식적인 서체"
- "활기찬 느낌을 주기 위해"
- "강렬한 인상을 주기 위해"

→ 해당 표현이 포함되면 잘못된 분석으로 간주

---

[금지 규칙 - 매우 중요]

아래 표현은 사용 금지:

- "굵고 장식적인"
- "활기찬 느낌"
- "강렬한 인상"
- "시각적 강조"

→ 이런 표현은 모두 "표면적 설명"으로 간주하고 오답 처리

---

[강제 규칙]

타이포그래피는 반드시 아래를 포함해야 한다:

- 글자 자체가 어떤 오브젝트 형태를 띄는지
- 단순 폰트가 아닌 "그래픽화된 텍스트"인지 여부
- 어떤 오브젝트를 차용했는지 (예: 물고기, 새우, 칼 등)

---

[예시 - 나쁜 답변]

"굵고 장식적인 서체를 사용하여 활기찬 느낌을 준다"

---

[예시 - 올바른 답변]

"수산시장의 컨셉을 강조하기 위해, 텍스트를 단순한 서체가 아닌 물고기, 새우, 칼 등의 형태를 결합한 그래픽 형태로 구성하였다. 각 글자는 개별 오브젝트처럼 표현되어 시장의 생동감과 현장성을 시각적으로 전달한다."

---

[레이아웃 추가 규칙]

- 단순 "중앙 배치" 설명 금지
- 반드시 "왜 중앙인지" + "주변 요소와의 관계" 설명

---

[메인 그래픽 규칙]

- 텍스트 자체가 그래픽이면 그것을 "메인 그래픽"으로 해석할 것
- 단순히 "큰 텍스트"라고 말하지 말 것

---

[최종 목표]

이 분석은 "디자인 설명"이 아니라
"디자인 해석"이 되어야 한다.

---

[요약 출력 규칙 수정]

- concept.keywords는 JSON에는 유지하되,
  UI에서 사용되지 않도록 의미 없는 키워드 생성 금지

- keywords는 반드시 "분석용 내부 태그"로만 작성한다
- UI에 출력될 것을 고려하지 않는다

- keywords는 3개 이하로 제한 (과도 생성 금지)

---

[구조 강화 규칙 - 매우 중요]

각 섹션은 최소 2개 이상의 요소를 가져야 한다:

- background.color → 최소 2개
- background.texture → 최소 1개
- background.object → 최소 1개

- typography.font_style → 최소 2개

- layout.structure → 최소 2개

- copywriting.tone_and_wording → 최소 2개

- key_visual.focal_point → 최소 2개

---

[전체 개수 규칙 - 강제]

background + typography + layout + copywriting + key_visual

→ 전체 value 개수 합계는 반드시 14개 이상이어야 한다

→ 부족하면 반드시 추가 분석하여 채운다

---

[추가 생성 규칙]

- 요소가 부족해 보이더라도 반드시 "구성 기반으로 확장"하여 생성한다

예:

단순 1개 요소만 보일 경우
→ 역할 / 위치 / 기능 기준으로 분해해서 여러 개로 확장

---

[구조 분해 금지 규칙]

- "대표 1개만 설명" 금지
- "핵심 요소만 선택" 금지

→ 반드시 다각도로 쪼개서 분석

---

[좋은 예 - 분해]

(잘못된 경우)
"중앙 텍스트 하나"

(올바른 경우)
- 중앙 텍스트 구조
- 텍스트 대비 구조
- 주변 요소 제거 구조

---

[최종 목표 - 구조 분해]

이 분석은 "요약형"이 아니라
"구조 분해형 분석"이어야 한다

---

[요약 작성 규칙]

요약은 반드시 4문장으로 작성한다.

"summary" 필드에는 위 4문장 전체를 하나의 문자열로 넣는다. 문장마다 빈 줄 한 줄을 넣어 네 단락으로 구분한다 (JSON 문자열 안에 실제 개행 문자 포함).

---

[공통 규칙]

- 모든 문장은 자연스러운 한국어 문장으로 작성
- 키워드 나열 금지
- 각 문장은 서로 연결되어야 함

---

[1문장: 컨셉 정의]

"이 디자인은 ~한 컨셉을 가진 디자인이다."

- concept.main 기반으로 작성
- 단순 나열 금지, 하나의 명확한 방향으로 정의

---

[2문장: 사용자 피드백 반영]

- status가 "Rejected"인 경우:
  "사용자의 피드백에 따르면 ~한 문제가 있었다."

- status가 "Approved"인 경우:
  "사용자의 피드백에 따르면 ~한 강점이 있는 디자인이다."

- 반드시 reason 내용을 기반으로 작성

---

[3문장: 원인/강점 구조화]

- Rejected:
  "이 문제는 다음 요소들로 인해 발생한 것으로 분석된다: ~"

- Approved:
  "이러한 강점은 다음 요소들에서 비롯된 것으로 분석된다: ~"

- 반드시 실제 JSON 분석 요소를 기반으로 작성
- (예: 색상 대비 부족, 시각적 중심 불명확 등)

---

[4문장: 원인 상세 설명]

- 3문장에서 언급한 요소들을 구체적으로 설명한다

- Rejected:
  왜 문제가 되는지, 어떤 방식으로 사용자 경험을 저해하는지 설명

- Approved:
  왜 강점인지, 어떤 방식으로 사용자 경험을 향상시키는지 설명

- 반드시 "디자인 구조 + 시각 요소 + 사용자 경험" 관점 포함

---

[금지 규칙]

- 일반적인 디자인 이론 금지
- 추상적인 표현 금지 (예: 좋다, 나쁘다 ❌)
- 반드시 해당 디자인 맥락 기반 설명

---

[예시 - Rejected]

"이 디자인은 고전적이고 우아한 컨셉을 가진 디자인이다.

사용자의 피드백에 따르면 몰입감이 떨어진다는 문제가 있었다.

이 문제는 배경과 텍스트 간 대비 부족, 시각적 중심의 불명확성 때문으로 분석된다.

배경의 채도가 낮고 텍스트 강조 요소가 분산되어 있어 사용자가 시선을 집중하기 어렵고, 정보 전달 흐름이 명확하게 형성되지 않는다."

---

[예시 - Approved]

"이 디자인은 감정 표현을 유도하는 인터랙티브 컨셉을 가진 디자인이다.

사용자의 피드백에 따르면 직관적이고 몰입감 있는 경험을 제공하는 강점이 있는 디자인이다.

이러한 강점은 색상 대비를 통한 명확한 구분과 구조적인 레이아웃에서 비롯된 것으로 분석된다.

각 섹션이 명확하게 구분되고 시각적 흐름이 자연스럽게 이어지도록 설계되어 있어 사용자가 감정을 쉽게 인식하고 선택할 수 있도록 돕는다."

---

반드시 아래 JSON 형식으로 반환:

([구조 강화 규칙]·[전체 개수 규칙]을 만족하는 개수로 각 배열 채움. concept.keywords는 0~3개 내부 태그만.)

{
  "concept": {
    "main": "",
    "keywords": [],
    "summary": "4문장 전체 — 요약 작성 규칙·예시와 동일한 구조 (단락마다 한 줄 비움)"
  },
  "background": {
    "color": [{ "value": "", "role": "" }, { "value": "", "role": "" }],
    "texture": [{ "value": "", "role": "" }],
    "object": [{ "value": "", "role": "" }]
  },
  "typography": {
    "font_style": [{ "value": "", "role": "" }, { "value": "", "role": "" }]
  },
  "layout": {
    "structure": [{ "value": "", "role": "" }, { "value": "", "role": "" }]
  },
  "copywriting": {
    "tone_and_wording": [{ "value": "", "role": "" }, { "value": "", "role": "" }]
  },
  "key_visual": {
    "focal_point": [{ "value": "", "role": "" }, { "value": "", "role": "" }]
  },
  "feedback_alignment": {
    "matched": [],
    "mismatched": []
  }
}
`;

  const userContent = img
    ? ([
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: img } },
      ] as const)
    : userText;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
당신은 전문 디자인 분석가입니다.

반드시 모든 응답을 한국어로 작성하세요.
영어 사용 금지.

분석은 구체적이고 실무적인 관점에서 작성하세요.
일반적인 디자인 이론 설명은 피하고,
해당 디자인 맥락 기준으로 해석하세요.
background·typography·layout·copywriting·key_visual 등 모든 항목의 role은 user 메시지의 [role 작성 규칙]을 반드시 따른다 (의도·구성 방식·결과).
typography·key_visual·layout은 표면적 스타일 묘사가 아니라 user 메시지 [핵심 규칙]·[검증 규칙]·[타이포그래피 특별 규칙]을 만족해야 한다. 조건을 하나라도 빠뜨리면 출력 전 스스로 보정해 통과시킬 것.
concept.summary는 반드시 요약 작성 규칙대로 정확히 4문장(단락 구분)이어야 한다.
concept.keywords는 0~3개·내부 태그용만 (화면용 문구 생성 금지).
background~key_visual의 value(role 있는 항목) 합계는 반드시 14개 이상이며, user 메시지 [구조 강화 규칙]의 최소 개수를 각 배열이 충족해야 한다.
feedback_alignment를 포함해 사용자가 요청한 JSON 키를 빠짐없이 채우세요.
`.trim(),
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });
  } catch (e) {
    console.error("[analyzeDesign] fetch 실패:", e);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[analyzeDesign] 응답 JSON 파싱 실패");
    return null;
  }

  console.log("OPENAI RAW:", data);

  if (!res.ok) {
    console.error("[analyzeDesign] OpenAI HTTP 오류:", res.status, data);
    return null;
  }

  const content = (
    data as { choices?: Array<{ message?: { content?: string | null } }> }
  )?.choices?.[0]?.message?.content;
  console.log("AI CONTENT:", content);

  if (typeof content !== "string" || !content.trim()) {
    return null;
  }

  const trimmed = content.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      const stripped = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "");
      parsed = JSON.parse(stripped);
    } catch {
      return null;
    }
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return normalizeParsed(parsed);
}
