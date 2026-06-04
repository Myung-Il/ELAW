// Supabase 클라이언트 — 공개 데이터(랜딩/문제/공고) 조회용
// publishable key는 브라우저 노출용 공개 키이며, 접근 제어는 RLS 정책이 담당한다.
// 환경변수 미설정 시에도 동작하도록 ELAW 프로젝트 기본값을 폴백으로 둔다 (Vercel 환경변수로 덮어쓰기 가능).
import { createClient } from "@supabase/supabase-js"

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wqafbfduiuulsivliddy.supabase.co"
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_b3-SNj4TP9Ej-5SlhpIjHQ_2Ebwp_W-"

export const supabase = createClient(supabaseUrl, supabaseKey)
