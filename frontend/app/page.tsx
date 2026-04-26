// 메인 랜딩 페이지 - 비로그인 사용자가 처음 보는 페이지
// 로그인 클릭 → /login, 회원가입 클릭 → /register 으로 이동
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PublicHeader from "@/components/layout/public-header"
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

// ─── 하드코딩 데이터 (추후 API 연동 필요) ───────────────────────────────────
// [FE 수정 매뉴얼] 아래 배열들은 현재 하드코딩 상태. useEffect + fetch로 교체 필요
// [BE 매뉴얼] GET /api/v1/departments → { name, courses, students }[]
// [DB 매뉴얼] Departments 테이블: id, name, courses_count, students_count
const departments = [
  { name: "컴퓨터공학", courses: 48, students: 1250, icon: "💻" },
  { name: "전자공학", courses: 42, students: 980, icon: "⚡" },
  { name: "기계공학", courses: 38, students: 870, icon: "⚙️" },
  { name: "화학공학", courses: 35, students: 720, icon: "🧪" },
  { name: "건축공학", courses: 32, students: 650, icon: "🏗️" },
  { name: "산업공학", courses: 30, students: 580, icon: "📊" },
]

// [BE 매뉴얼] GET /api/v1/companies/featured → 파트너 기업 목록
// [DB 매뉴얼] Companies 테이블: id, name, field, positions, logo, is_partner
const companies = [
  { name: "삼성전자", field: "IT/반도체", positions: 120, logo: "S", color: "bg-blue-500" },
  { name: "현대자동차", field: "자동차/모빌리티", positions: 85, logo: "H", color: "bg-sky-500" },
  { name: "LG전자", field: "전자/가전", positions: 75, logo: "L", color: "bg-red-500" },
  { name: "SK하이닉스", field: "반도체", positions: 68, logo: "SK", color: "bg-orange-500" },
]

// [BE 매뉴얼] GET /api/v1/events/upcoming → 예정 이벤트 목록
// [DB 매뉴얼] Events 테이블: id, title, event_date, type, prize
const events = [
  { title: "2024 전국 대학생 SW 경진대회", dDay: 15, type: "대회", prize: "1,000만원" },
  { title: "삼성 청년 SW 아카데미 12기 모집", dDay: 7, type: "프로그램", prize: "교육비 전액" },
  { title: "AI 해커톤 챌린지", dDay: 23, type: "대회", prize: "500만원" },
]

// AI 기능 특징 목록
const features = [
  { icon: TrendingUp, text: "실력 분석 기반 맞춤 학습 계획" },
  { icon: Clock, text: "주 단위 학습 목표 및 진도 관리" },
  { icon: Award, text: "기업 합격자 데이터 기반 커리큘럼" },
  { icon: CheckCircle, text: "시험 일정에 맞춘 자동 복습 추천" },
]

export default function HomePage() {
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

            {/* 통계 카드 */}
            {/* [FE 수정 매뉴얼] 통계 숫자는 GET /api/v1/stats API로 동적으로 가져오도록 수정 필요 */}
            <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
              {[
                { value: "25,000+", label: "등록 학생" },
                { value: "500+", label: "제공 강의" },
                { value: "150+", label: "파트너 기업" },
                { value: "92%", label: "취업 성공률" },
              ].map((stat) => (
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

        {/* ── 학과별 학습 섹션 ─────────────────────────────── */}
        <section id="learning" className="border-t py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-4">
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                학과별 학습
              </Badge>
              <h2 className="mb-4 text-3xl font-bold">전공 학습 시스템</h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                공과대학 모든 학과의 전공 강의, 문제풀이, 시험을 한 곳에서
              </p>
            </div>

            {/* [FE 수정 매뉴얼] departments 배열을 API 데이터로 교체 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((dept) => (
                <Card key={dept.name} className="group cursor-pointer card-hover">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                        {dept.icon}
                      </div>
                      <div>
                        <p className="font-semibold">{dept.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {dept.courses}개 강좌
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {dept.students.toLocaleString()}명
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
                  전체 학과 보기
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

            {/* [FE 수정 매뉴얼] companies 배열을 API 데이터로 교체 */}
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

            {/* [FE 수정 매뉴얼] events 배열을 API 데이터로 교체 */}
            <div className="mx-auto max-w-3xl space-y-4">
              {events.map((event) => (
                <Card key={event.title} className="group cursor-pointer card-hover">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      {/* D-Day 뱃지 */}
                      <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm flex-shrink-0">
                        <span className="text-xs font-medium opacity-80">D-</span>
                        <span className="text-xl font-extrabold leading-none">{event.dDay}</span>
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-1.5 text-xs">{event.type}</Badge>
                        <h3 className="font-semibold text-sm md:text-base">{event.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <Award className="mr-1 inline h-3 w-3 text-primary" />
                          상금 {event.prize}
                        </p>
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

              {/* 학습 현황 미리보기 카드 */}
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
