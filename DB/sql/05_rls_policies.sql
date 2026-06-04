-- ─────────────────────────────────────────────────────────────
-- 05_rls_policies.sql — Supabase RLS 보안 정책
--
-- 원칙:
--   · 모든 public 테이블에 RLS 활성화 + anon/authenticated 쓰기 권한 회수
--   · 랜딩 페이지가 읽는 공개 데이터에만 anon SELECT 정책 부여
--   · 나머지(사용자·세션·dataset 테이블)는 정책 없음 → PostgREST 접근 차단
--   · Django는 테이블 소유자(postgres)로 직접 접속하므로 RLS 영향 없음
--
-- 적용: python scripts/apply_supabase_rls.py
-- 재실행 안전 (idempotent). 새 마이그레이션으로 테이블이 추가되면 다시 실행할 것.
-- ─────────────────────────────────────────────────────────────

-- 1) 모든 public 테이블: RLS 활성화 + 외부 키(anon/authenticated) 쓰기 회수
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated',
      t.tablename
    );
  END LOOP;
END $$;

-- 앞으로 postgres 롤이 만드는 새 테이블도 기본적으로 외부 쓰기 불가
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- 2) 공개 읽기 정책 — 랜딩 페이지(frontend/app/page.tsx)가 조회하는 테이블만
--    문제·학습경로: 전체 공개 (학습 콘텐츠)
DROP POLICY IF EXISTS public_read ON public.job_problems;
CREATE POLICY public_read ON public.job_problems
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS public_read ON public.job_problem_clusters;
CREATE POLICY public_read ON public.job_problem_clusters
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS public_read ON public.problem_edges;
CREATE POLICY public_read ON public.problem_edges
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS public_read ON public.learning_path_meta;
CREATE POLICY public_read ON public.learning_path_meta
  FOR SELECT TO anon, authenticated USING (true);

--    기업: 승인된 곳만 / 공고: 활성 공고만 / 게시글: 전체 공개 (커뮤니티 콘텐츠)
DROP POLICY IF EXISTS public_read ON public.core_company;
CREATE POLICY public_read ON public.core_company
  FOR SELECT TO anon, authenticated USING (is_approved);

DROP POLICY IF EXISTS public_read ON public.core_jobposting;
CREATE POLICY public_read ON public.core_jobposting
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS public_read ON public.core_post;
CREATE POLICY public_read ON public.core_post
  FOR SELECT TO anon, authenticated USING (true);
