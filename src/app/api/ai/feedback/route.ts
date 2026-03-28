export const runtime = "nodejs";

/** @deprecated `/api/ai/feedback`은 `/api/ai/evaluate`로 대체되었습니다. */
export async function POST() {
  return Response.json(
    {
      error: "이 엔드포인트는 사용 중단되었습니다.",
      use: "/api/ai/evaluate",
    },
    { status: 410 },
  );
}
