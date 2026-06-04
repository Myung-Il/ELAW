// 메인 랜딩 페이지 - 비로그인 사용자가 처음 보는 페이지
// 로그인 클릭 → /login, 회원가입 클릭 → /register 으로 이동
// [FE 수정 매뉴얼] Supabase 연동 완료 — 직군/기업/이벤트/통계가 DB 실데이터로 렌더링됨 (5분 ISR)
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PublicHeader from "@/components/layout/public-header"
import { supabase } from "@/lib/supabase"
import {
  GraduationCap,
  Building2,
  Trophy,
  Brain,
  BookOpen,
  Users,
  Briefcase,
  Sparkles,
  ChevronRight,
  Play,
  Clock,
  TrendingUp,
  Award,
  ArrowRight,
  CheckCircle,
} from "lucide-react"

// 5분마다 재검증 (ISR) — DB 변경이 랜딩에 자동 반영됨
export const revalidate = 300

// ─── 표시용 매핑 ─────────────────────────────────────────
// 랜딩에 노출할 대표 직군 6개 (learning_path_meta 30개 중)
const ROLE_ICONS: Record<string, string> = {
  "AI Engineer": "🤖",
  "Backend Engineer": "⚙️",
  "Frontend Developer": "💻",
  "Data Scientist": "📊",
  "DevOps Engineer": "🚀",
  "Security Engineer": "🔐",
}
const COMPANY_COLORS = ["bg-yellow-500", "bg-green-600", "bg-emerald-500", "bg-blue-500"]
const POST_CATEGORY_LABEL: Record<string, string> = {
  contest: "대회",
  event: "이벤트",
  notice: "공지",
}

type JobRoleItem = { name: string; problems: number; clusters: number; icon: string }
type CompanyItem = { name: string; field: string; positions: number; logo: string; color: string }
type EventItem = { id: number; title: string; type: string; views: number; snippet: string }
type StatItem = { value: string; label: string }

// ─── 폴백 데이터 (Supabase 조회 실패 시 표시) ─────────────
const FALLBACK_ROLES: JobRoleItem[] = [
  { name: "AI Engineer", problems: 200, clusters: 192, icon: "🤖" },
  { name: "Backend Engineer", problems: 200, clusters: 180, icon: "⚙️" },
  { name: "Frontend Developer", problems: 200, clusters: 175, icon: "💻" },
  { name: "Data Scientist", problems: 200, clusters: 188, icon: "📊" },
  { name: "DevOps Engineer", problems: 200, clusters: 170, icon: "🚀" },
  { name: "Security Engineer", problems: 200, clusters: 165, icon: "🔐" },
]
const FALLBACK_COMPANIES: CompanyItem[] = [
  { name: "카카오", field: "IT/플랫폼", positions: 9, logo: "카", color: "bg-yellow-500" },
  { name: "네이버", field: "IT/검색", positions: 9, logo: "네", color: "bg-green-600" },
  { name: "라인", field: "IT/글로벌", positions: 8, logo: "라", color: "bg-emerald-500" },
]
const FALLBACK_EVENTS: EventItem[] = [
  { id: 1, title: "2026 상반기 코딩테스트 일정", type: "대회", views: 98, snippet: "주요 기업 코딩테스트 일정을 안내합니다." },
  { id: 2, title: "신규 가입 이벤트", type: "이벤트", views: 183, snippet: "신규 가입 시 AI 커리큘럼 무료 제공!" },
  { id: 3, title: "카카오 2026 공채 일정 안내", type: "대회", views: 121, snippet: "카카오 공개채용 코딩테스트 접수 안내입니다." },
]
const FALLBACK_STATS: StatItem[] = [
  { value: "6,000+", label: "제공 문제" },
  { value: "30", label: "지원 직군" },
  { value: "26+", label: "채용 공고" },
  { value: "3+", label: "파트너 기업" },
]

// ─── Supabase 실데이터 조회 ──────────────────────────────
// [DB 매뉴얼] learning_path_meta(직군별 학습경로), core_company+core_jobposting(기업/공고),
//             core_post(대회/이벤트), job_problems(문제) — DB/sql 스키마 참조
async function getLandingData() {
  try {
    const [rolesRes, companiesRes, postsRes, problemCnt, roleCnt, postingCnt, companyCnt] =
      await Promise.all([
        supabase
          .from("learning_path_meta")
          .select("job_role,total_problems,cluster_count")
          .in("job_role", Object.keys(ROLE_ICONS)),
        supabase
          .from("core_company")
          .select("name,industry,core_jobposting(count)")
          .eq("is_approved", true)
          .limit(4),
        supabase
          .from("core_post")
          .select("id,title,category,content,view_count")
          .in("category", ["contest", "event"])
          .order("view_count", { ascending: false })
          .limit(3),
        supabase.from("job_problems").select("*", { count: "exact", head: true }),
        supabase.from("learning_path_meta").select("*", { count: "exact", head: true }),
        supabase.from("core_jobposting").select("*", { count: "exact", head: true }),
        supabase.from("core_company").select("*", { count: "exact", head: true }),
      ])

    const jobRoles: JobRoleItem[] =
      rolesRes.data?.length
        ? rolesRes.data.map((r) => ({
            name: r.job_role,
            problems: r.total_problems,
            clusters: r.cluster_count,
            icon: ROLE_ICONS[r.job_role] ?? "💼",
          }))
        : FALLBACK_ROLES

    const companies: CompanyItem[] =
      companiesRes.data?.length
        ? companiesRes.data.map((c, i) => ({
            name: c.name,
            field: c.industry ?? "",
            positions: (c.core_jobposting as { count: number }[])?.[0]?.count ?? 0,
            logo: c.name.charAt(0),
            color: COMPANY_COLORS[i % COMPANY_COLORS.length],
          }))
        : FALLBACK_COMPANIES

    const events: EventItem[] =
      postsRes.data?.length
        ? postsRes.data.map((p) => ({
            id: p.id,
            title: p.title,
            type: POST_CATEGORY_LABEL[p.category] ?? p.category,
            views: p.view_count,
            snippet: p.content.length > 40 ? `${p.content.slice(0, 40)}…` : p.content,
          }))
        : FALLBACK_EVENTS

    const stats: StatItem[] = problemCnt.count
      ? [
          { value: problemCnt.count.toLocaleString(), label: "제공 문제" },
          { value: String(roleCnt.count ?? 0), label: "지원 직군" },
          { value: String(postingCnt.count ?? 0), label: "채용 공고" },
          { value: String(companyCnt.count ?? 0), label: "파트너 기업" },
        ]
      : FALLBACK_STATS

    return { jobRoles, companies, events, stats }
  } catch {
    return {
      jobRoles: FALLBACK_ROLES,
      companies: FALLBACK_COMPANIES,
      events: FALLBACK_EVENTS,
      stats: FALLBACK_STATS,
    }
  }
}

// AI 기능 특징 목록
const features = [
  { icon: TrendingUp, text: "실력 분석 기반 맞춤 학습 계획" },
  { icon: Clock, text: "주 단위 학습 목표 및 진도 관리" },
  { icon: Award, text: "기업 합격자 데이터 기반 커리큘럼" },
  { icon: CheckCircle, text: "시험 일정에 맞춘 자동 복습 추천" },
]

export default async function HomePage() {
  const { jobRoles, companies, events, stats } = await getLandingData()

  return (
    <div className="min-h-screen bg-background">
      {/* 비로그인 헤더 - 로그인/회원가입 버튼 포함 */}
      <PublicHeader />

      <main>
        {/* ── 히어로 섹션 ─────────────────────────────────── */}
        <section className="relative overflow-hidden py-24 md:py-36">
          {/* 배경 그라디언트 */}
          <div className="absolute inset-0 gradient-bg" />
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-30"
            style={{ background: "radial-gradient(ellipse at 80% 20%, oklch(0.65 0.22 280 / 0.15), transparent 60%)" }}
          />

          <div className="container relative mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-5 px-3 py-1 text-sm">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                AI 기반 맞춤형 학습 플랫폼
              </Badge>

              <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl leading-tight">
                공과대학{" "}
                <span className="text-primary">학습</span>과{" "}
                <span className="text-primary">취업</span>을{" "}
                <br className="hidden md:block" />
                한번에 해결하세요
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
                AI가 분석한 맞춤형 커리큘럼으로 전공 학습부터 취업 준비까지.
                <br className="hidden md:block" />
                지금 바로 ELAW와 함께 성장을 시작하세요.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="gap-2 px-8 shadow-md font-semibold text-base">
                    무료로 시작하기
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="gap-2 px-8 font-semibold text-base">
                  <Play className="h-4 w-4 fill-current" />
                  서비스 소개
                </Button>
              </div>
            </div>

            {/* 통계 카드 — Supabase 실데이터 (문제/직군/공고/기업 카운트) */}
            <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border bg-card p-6 text-center shadow-sm"
                >
                  <p className="text-3xl font-extrabold text-primary">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 직군별 학습 섹션 ─────────────────────────────── */}
        <section id="learning" className="border-t py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-4">
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                직군별 학습
              </Badge>
              <h2 className="mb-4 text-3xl font-bold">전공 학습 시스템</h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                30개 IT 직군의 전공 문제와 AI 학습 경로를 한 곳에서
              </p>
            </div>

            {/* learning_path_meta 기반 대표 직군 6개 — 문제 수/클러스터 수 실데이터 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobRoles.map((role) => (
                <Card key={role.name} className="group cursor-pointer card-hover">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                        {role.icon}
                      </div>
                      <div>
                        <p className="font-semibold">{role.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {role.problems}개 문제
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            클러스터 {role.clusters.toLocaleString()}개
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/login">
                <Button variant="outline" className="gap-2">
                  전체 직군 보기
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 기업 매칭 섹션 ──────────────────────────────── */}
        <section id="career" className="border-t bg-muted/40 py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-4">
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                취업 연계
              </Badge>
              <h2 className="mb-4 text-3xl font-bold">기업 공고 & 매칭</h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                학습 데이터 기반 AI 매칭으로 나에게 맞는 기업을 찾아보세요
              </p>
            </div>

            {/* core_company + 공고 수 실데이터 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {companies.map((company) => (
                <Card key={company.name} className="group cursor-pointer card-hover">
                  <CardHeader className="pb-3">
                    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${company.color} text-white text-sm font-bold shadow-sm`}>
                      {company.logo}
                    </div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    <CardDescription>{company.field}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">{company.positions}개</span>
                      <span className="text-muted-foreground">포지션 모집 중</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/login">
                <Button variant="outline" className="gap-2">
                  전체 기업 공고 보기
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 대회/이벤트 섹션 ────────────────────────────── */}
        <section id="events" className="border-t py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-4">
                <Trophy className="mr-1.5 h-3.5 w-3.5" />
                성장 기회
              </Badge>
              <h2 className="mb-4 text-3xl font-bold">대회 & 이벤트</h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                실력을 검증하고 성장할 수 있는 다양한 대회와 프로그램
              </p>
            </div>

            {/* core_post(category: contest/event) 실데이터 */}
            <div className="mx-auto max-w-3xl space-y-4">
              {events.map((event) => (
                <Card key={event.id} className="group cursor-pointer card-hover">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      {/* 카테고리 아이콘 */}
                      <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm flex-shrink-0">
                        {event.type === "대회" ? (
                          <Trophy className="h-6 w-6" />
                        ) : (
                          <Sparkles className="h-6 w-6" />
                        )}
                        <span className="mt-1 text-[10px] font-medium opacity-80">{event.type}</span>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-1.5 text-xs">조회 {event.views.toLocaleString()}</Badge>
                        <h3 className="font-semibold text-sm md:text-base">{event.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.snippet}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary flex-shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI 커리큘럼 소개 섹션 ───────────────────────── */}
        <section id="ai-curriculum" className="border-t bg-gradient-to-br from-primary/5 via-background to-background py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              {/* 텍스트 영역 */}
              <div>
                <Badge variant="outline" className="mb-4">
                  <Brain className="mr-1.5 h-3.5 w-3.5" />
                  AI 학습 추천
                </Badge>
                <h2 className="mb-4 text-3xl font-bold leading-snug">
                  AI가 설계하는{" "}
                  <span className="text-primary">맞춤형 커리큘럼</span>
                </h2>
                <p className="mb-8 text-muted-foreground leading-relaxed">
                  방대한 전공 학습 내용을 AI가 분석하여 당신의 수준과 목표에 맞는
                  최적의 학습 경로를 제시합니다. 효율적인 자기개발 학습을 시작하세요.
                </p>
                <ul className="mb-8 space-y-4">
                  {features.map((feature) => (
                    <li key={feature.text} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                        <feature.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button size="lg" className="gap-2 shadow-md">
                    AI 커리큘럼 시작하기
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* 학습 현황 미리보기 카드 (데모용 정적 콘텐츠) */}
              <div className="rounded-2xl border bg-card p-6 shadow-lg">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-semibold">나의 학습 현황 미리보기</h3>
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI 분석 중
                  </Badge>
                </div>
                <div className="space-y-5">
                  {[
                    { subject: "자료구조", progress: 85, color: "bg-primary" },
                    { subject: "알고리즘", progress: 62, color: "bg-primary" },
                    { subject: "운영체제", progress: 45, color: "bg-accent" },
                    { subject: "데이터베이스", progress: 28, color: "bg-accent" },
                  ].map((item) => (
                    <div key={item.subject}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium">{item.subject}</span>
                        <span className="text-primary font-semibold">{item.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl bg-primary/5 p-4 border border-primary/10">
                  <p className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Sparkles className="h-4 w-4" />
                    AI 추천: 알고리즘 심화 학습 권장
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    기업 합격자 평균 대비 15% 부족한 영역입니다
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 최종 CTA 섹션 ──────────────────────────────── */}
        <section className="border-t py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="overflow-hidden rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground shadow-lg">
              <GraduationCap className="mx-auto mb-4 h-12 w-12 opacity-90" />
              <h2 className="mb-4 text-3xl font-bold">지금 바로 시작하세요</h2>
              <p className="mx-auto mb-8 max-w-xl text-primary-foreground/80 leading-relaxed">
                ELAW와 함께 체계적인 전공 학습과 취업 준비를 동시에.
                AI 커리큘럼으로 효율적인 성장을 경험하세요.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="font-semibold shadow-sm">
                    무료 회원가입
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 font-semibold"
                  >
                    로그인
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── 푸터 ────────────────────────────────────────── */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <GraduationCap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-primary">ELAW</span>
              </div>
              <p className="text-sm text-muted-foreground">공과대학 학습지원 및 취업연계 플랫폼</p>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-sm">학습</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">전공 강의</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">문제풀이</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">모의시험</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">AI 커리큘럼</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-sm">취업</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">기업 공고</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">AI 매칭</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">포트폴리오</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-sm">커뮤니티</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">게시판</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Q&A</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">공지사항</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 ELAW. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
