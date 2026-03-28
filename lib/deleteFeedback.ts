import { supabase } from "./supabase";

/** 휴지통에서 영구 삭제 시 DB 행 제거 (테이블/컬럼명은 Supabase 스키마에 맞게 조정) */
export async function deleteFeedbackFromSupabase(feedbackId: string) {
  const { error } = await supabase
    .from("feedbacks")
    .delete()
    .eq("id", feedbackId);

  if (error) {
    console.error("[feedbacks] delete 실패:", error.message);
  }
}
