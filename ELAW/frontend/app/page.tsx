/**
 * [페이지] 랜딩페이지 (/) - 비로그인 사용자가 처음 보는 메인 페이지
 *
 * 시나리오:
 *   - 비로그인 상태에서 접속 시 이 페이지가 표시됩니다.
 *   - 상단 헤더: '로그인', '회원가입', '게시판' 버튼/탭 표시 (PublicHeader)
 *   - 기업 카드 클릭 → 기업 소개 모달 열기 (기업 정보는 누구나 열람 가능)
 *   - 기업 소개 모달 내 [지원하기] / [커리큘럼 생성] 버튼 → 로그인 안내 후 /login 이동
 *   - 게시판 요약 섹션: 최신 게시글 목록 표시 (클릭 → 로그인 안내)
 *   - 커리큘럼 섹션: 더미 데이터로 기능 미리보기 제공
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   하드코딩된 배열들(departments, companies, events, boardPreview)을
 *   페이지 초기 로드 시 useEffect 안에서 API 호출로 교체하세요.
 *   예시:
 *     useEffect(() => {
 *       fetch("/api/v1/companies/featured").then(r => r.json()).then(setCompanies)
 *     }, [])
 *
 * [BE 매뉴얼]
 *   - GET /api/v1/departments → 학과 목록 (name, courses, students, icon)
 *   - GET /api/v1/companies/featured → 파트너 기업 목록 (name, field, positions, logo, color, desc)
 *   - GET /api/v1/events/upcoming → 예정 이벤트 (title, dDay, type, prize)
 *   - GET /api/v1/board/recent?limit=4 → 최신 게시글 4개 (title, category, date, views)
 *   - GET /api/v1/stats → 플랫폼 통계 (students, courses, companies, jobRate)
 *
 * [DB 매뉴얼]
 *   - Departments: id, name, courses_count, students_count, icon_emoji
 *   - Companies: id, name, field, positions, logo, color, description, apply_url
 *   - Events: id, title, event_date, type, prize
 *   - BoardPosts: id, title, category, author_id, views, created_at
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  MapPin,
  Globe,
  FileText,
  MessageSquare,
  Eye,
  Bell,
  Calendar,
  HelpCircle,
  LogIn,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// 하드코딩 더미 데이터 (추후 API 연동 필요)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 학과 목록 더미 데이터
 * [BE 매뉴얼] GET /api/v1/departments
 * [DB 매뉴얼] Departments 테이블: id, name, courses_count, students_count, icon_emoji
 */
const departments = [
  { name: "컴퓨터공학", courses: 48, students: 1250, icon: "💻" },
  { name: "전자공학", courses: 42, students: 980, icon: "⚡" },
  { name: "기계공학", courses: 38, students: 870, icon: "⚙️" },
  { name: "화학공학", courses: 35, students: 720, icon: "🧪" },
  { name: "건축공학", courses: 32, students: 650, icon: "🏗️" },
  { name: "산업공학", courses: 30, students: 580, icon: "📊" },
]

/**
 * 파트너 기업 더미 데이터 (랜딩페이지 '기업 공고' 섹션)
 * [BE 매뉴얼] GET /api/v1/companies/featured
 * [DB 매뉴얼] Companies: id, name, field, positions, logo, color, description, apply_url
 *             - apply_url: 기업 공식 채용 페이지 URL (지원 버튼 클릭 시 사용)
 */
const companies = [
  {
    id: 1,
    name: "삼성전자",
    field: "IT/반도체",
    positions: 120,
    logo: "S",
    color: "bg-blue-500",
    desc: "세계 최대의 IT·반도체 기업. 갤럭시 스마트폰, 반도체, 가전 등 글로벌 시장 선도.",
    companyInfo: "삼성전자는 세계 최대의 IT 기업 중 하나로, 반도체, 스마트폰, 가전제품 분야에서 세계 시장을 선도하고 있습니다.",
    requirements: ["컴퓨터공학 또는 관련 전공", "알고리즘 기본 지식", "Java/Kotlin 개발 경험"],
    techStack: ["Java", "Kotlin", "Android", "C++", "Linux"],
    deadline: "D-7",
    applyUrl: "https://careers.samsung.com",
  },
  {
    id: 2,
    name: "현대자동차",
    field: "자동차/모빌리티",
    positions: 85,
    logo: "H",
    color: "bg-sky-500",
    desc: "국내 1위 자동차 제조사. 전기차·수소차·자율주행 등 미래 모빌리티 혁신 선도.",
    companyInfo: "현대자동차는 국내 1위 자동차 제조사로, 전기차(EV), 수소연료전지차, 자율주행 기술 등을 개발합니다.",
    requirements: ["기계/전자/소프트웨어 관련 전공", "C++/Python 기본 지식"],
    techStack: ["C++", "Python", "ROS", "AUTOSAR"],
    deadline: "D-10",
    applyUrl: "https://careers.hyundai.com",
  },
  {
    id: 3,
    name: "LG전자",
    field: "전자/가전",
    positions: 75,
    logo: "L",
    color: "bg-red-500",
    desc: "글로벌 가전·전자 기업. TV, 냉장고, 세탁기 등 프리미엄 가전 세계 1위.",
    companyInfo: "LG전자는 프리미엄 가전, TV, B2B 솔루션 등 다양한 전자제품을 글로벌로 판매하는 기업입니다.",
    requirements: ["전자/컴퓨터 관련 전공", "임베디드 SW 기초 지식"],
    techStack: ["C", "C++", "Linux", "Embedded"],
    deadline: "D-21",
    applyUrl: "https://careers.lg.com",
  },
  {
    id: 4,
    name: "SK하이닉스",
    field: "반도체",
    positions: 68,
    logo: "SK",
    color: "bg-orange-500",
    desc: "세계 2위 메모리 반도체 기업. DRAM, NAND Flash 설계·제조.",
    companyInfo: "SK하이닉스는 세계 2위 메모리 반도체 기업으로 DRAM, NAND Flash 등을 설계·제조합니다.",
    requirements: ["전자/전기/물리 관련 전공", "반도체 공정 기초 지식"],
    techStack: ["Python", "MATLAB", "Verilog", "SPICE"],
    deadline: "D-30",
    applyUrl: "https://careers.skhynix.com",
  },
]

/**
 * 예정 이벤트/대회 더미 데이터
 * [BE 매뉴얼] GET /api/v1/events/upcoming
 * [DB 매뉴얼] Events: id, title, event_date, type, prize, description
 */
const events = [
  { title: "2024 전국 대학생 SW 경진대회", dDay: 15, type: "대회", prize: "1,000만원" },
  { title: "삼성 청년 SW 아카데미 12기 모집", dDay: 7, type: "프로그램", prize: "교육비 전액" },
  { title: "AI 해커톤 챌린지", dDay: 23, type: "대회", prize: "500만원" },
]

/**
 * AI 기능 특징 목록 (정적 콘텐츠 - API 불필요)
 */
const features = [
  { icon: TrendingUp, text: "실력 분석 기반 맞춤 학습 계획" },
  { icon: Clock, text: "주 단위 학습 목표 및 진도 관리" },
  { icon: Award, text: "기업 합격자 데이터 기반 커리큘럼" },
  { icon: CheckCircle, text: "시험 일정에 맞춘 자동 복습 추천" },
]

/**
 * 게시판 미리보기 더미 데이터
 * [BE 매뉴얼] GET /api/v1/board/recent?limit=4
 * [DB 매뉴얼] BoardPosts: id, title, category, author_id, views, created_at
 */
const boardPreview = [
  { id: 1, category: "공지", title: "2025년 상반기 취업 설명회 개최 안내", date: "2025.04.25", views: 1240 },
  { id: 2, category: "QnA", title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?", date: "2025.04.24", views: 342 },
  { id: 3, category: "행사", title: "현대자동차 그룹 채용 설명회 (04.30)", date: "2025.04.23", views: 891 },
  { id: 4, category: "QnA", title: "CS 면접 단골 질문 정리해주실 분 있나요?", date: "2025.04.22", views: 567 },
]

/** 카테고리 배지 색상 매핑 */
const categoryColors: Record<string, string> = {
  공지: "bg-blue-100 text-blue-700",
  QnA: "bg-green-100 text-green-700",
  행사: "bg-orange-100 text-orange-700",
}

/** 클릭된 기업 정보 타입 */
type Company = typeof companies[0]

export default function LandingPage() {
  const router = useRouter()

  /** 기업 상세 모달에 표시할 선택된 기업 (null이면 모달 닫힘) */
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  /**
   * 비로그인 상태에서 로그인이 필요한 버튼 클릭 시 호출
   * 안내 후 로그인 페이지로 이동합니다.
   */
  const handleLoginRequired = (action: string) => {
    alert(`${action} 기능은 로그인 후 이용할 수 있습니다.\n로그인 페이지로 이동합니다.`)
    router.push("/login")
  }

  /**
   * 게시글 클릭 시 처리 (비로그인 상태)
   * 게시글 목록은 열람 가능하나 개별 게시글은 로그인 필요
   */
  const handleBoardPostClick = () => {
    alert("로그인 시 게시글을 확인할 수 있습니다.\n로그인 페이지로 이동합니다.")
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 비로그인 헤더: 로그인/회원가입/게시판 버튼 포함 */}
      <PublicHeader />

      <main>
        {/* ═══════════════════════════════════════════════════════════
            섹션 1: 히어로 섹션 - 핵심 가치 제안 + CTA 버튼
        ═══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-24 md:py-36">
          {/* 배경 그라디언트 레이어 */}
          <div className="absolute inset-0 gradient-bg" />
          <div
            className="absolute top-0 right-0 w-1/2 h-full opacity-30"
            style={{
              background: "radial-gradient(ellipse at 80% 20%, oklch(0.65 0.22 280 / 0.15), transparent 60%)",
            }}
          />

          <div className="container relative mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              {/* AI 플랫폼 배지 */}
              <Badge variant="secondary" className="mb-5 px-3 py-1 text-sm">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                AI 기반 맞춤형 학습 플랫폼
              </Badge>

              {/* 메인 헤딩 */}
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

              {/* CTA 버튼 그룹 */}
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

            {/* 플랫폼 통계 카드 */}
            {/* [FE 수정 매뉴얼] 아래 숫자를 GET /api/v1/stats 로 동적으로 교체하세요 */}
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

        {/* ═══════════════════════════════════════════════════════════
            섹션 2: 학과별 학습 섹션
        ═══════════════════════════════════════════════════════════ */}
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

            {/* [FE 수정 매뉴얼] departments를 API 데이터로 교체 */}
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
                  전체 학과 보기 (로그인 필요)
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 3: 기업 공고 섹션
            - 기업 카드 클릭 → 기업 소개 모달 열기
            - 비로그인 상태: 기업 정보 열람 가능, 지원/커리큘럼 버튼은 로그인 게이트
        ═══════════════════════════════════════════════════════════ */}
        <section id="career" className="border-t bg-muted/40 py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-4">
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                취업 연계
              </Badge>
              <h2 className="mb-4 text-3xl font-bold">기업 공고 & 매칭</h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                기업 카드를 클릭하면 상세 소개를 볼 수 있어요.
                로그인 후 지원하기 및 커리큘럼 생성이 가능합니다.
              </p>
            </div>

            {/* [FE 수정 매뉴얼] companies를 GET /api/v1/companies/featured 로 교체 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {companies.map((company) => (
                <Card
                  key={company.id}
                  className="group cursor-pointer card-hover"
                  onClick={() => setSelectedCompany(company)}
                >
                  <CardHeader className="pb-3">
                    <div
                      className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${company.color} text-white text-sm font-bold shadow-sm`}
                    >
                      {company.logo}
                    </div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    <CardDescription>{company.field}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{company.desc}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">{company.positions}개</span>
                      <span className="text-muted-foreground">포지션 모집 중</span>
                    </div>
                    <p className="mt-2 text-xs text-primary font-medium">
                      클릭하여 상세 소개 보기 →
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/login">
                <Button variant="outline" className="gap-2">
                  전체 기업 공고 보기 (로그인 필요)
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 4: 대회 & 이벤트 섹션
        ═══════════════════════════════════════════════════════════ */}
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

            {/* [FE 수정 매뉴얼] events를 GET /api/v1/events/upcoming 으로 교체 */}
            <div className="mx-auto max-w-3xl space-y-4">
              {events.map((event) => (
                <Card key={event.title} className="group cursor-pointer card-hover">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      {/* D-Day 배지 */}
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

        {/* ═══════════════════════════════════════════════════════════
            섹션 5: AI 커리큘럼 소개 섹션 (더미 데이터로 미리보기)
        ═══════════════════════════════════════════════════════════ */}
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

              {/* 커리큘럼 미리보기 카드 (더미 데이터) */}
              {/* 비로그인 사용자에게 기능을 미리 체험하게 하는 데모 카드 */}
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
                    { subject: "자료구조", progress: 85 },
                    { subject: "알고리즘", progress: 62 },
                    { subject: "운영체제", progress: 45 },
                    { subject: "데이터베이스", progress: 28 },
                  ].map((item) => (
                    <div key={item.subject}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium">{item.subject}</span>
                        <span className="text-primary font-semibold">{item.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
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
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  * 위 데이터는 예시입니다. 실제 데이터는 로그인 후 확인 가능합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 6: 게시판 미리보기 섹션
            - 최신 게시글 목록 표시 (누구나 열람 가능)
            - 개별 게시글 클릭 시 로그인 안내
        ═══════════════════════════════════════════════════════════ */}
        <section className="border-t py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-4">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                커뮤니티
              </Badge>
              <h2 className="mb-4 text-3xl font-bold">게시판</h2>
              <p className="mx-auto max-w-xl text-muted-foreground">
                취업 준비생들의 Q&A, 행사 정보, 공지사항을 한눈에
              </p>
            </div>

            {/* [FE 수정 매뉴얼] boardPreview를 GET /api/v1/board/recent?limit=4 로 교체 */}
            <div className="mx-auto max-w-3xl">
              <Card className="shadow-sm">
                {boardPreview.map((post, i) => (
                  <div
                    key={post.id}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group ${i < boardPreview.length - 1 ? "border-b" : ""}`}
                    onClick={handleBoardPostClick}
                  >
                    {/* 카테고리 배지 */}
                    <Badge
                      className={`text-xs flex-shrink-0 border-0 mt-0.5 ${categoryColors[post.category] || "bg-gray-100 text-gray-700"}`}
                    >
                      {post.category}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {post.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{post.date}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.views.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* 로그인 필요 표시 */}
                    <LogIn className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </Card>

              <div className="mt-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  게시글 상세 내용은 로그인 후 확인 가능합니다
                </p>
                <div className="flex justify-center gap-3">
                  <Link href="/board">
                    <Button variant="outline" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      게시판 전체 보기
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button className="gap-2">
                      <LogIn className="h-4 w-4" />
                      로그인하고 참여하기
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 7: 최종 CTA 섹션
        ═══════════════════════════════════════════════════════════ */}
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

      {/* ── 푸터 ──────────────────────────────────────────────────── */}
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
                <li><Link href="/board" className="hover:text-foreground transition-colors">게시판</Link></li>
                <li><Link href="/board" className="hover:text-foreground transition-colors">Q&A</Link></li>
                <li><Link href="/board" className="hover:text-foreground transition-colors">공지사항</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 ELAW. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════
          기업 상세 모달 (Dialog)
          - 기업 카드 클릭 시 열림
          - 기업 소개 + 기술 스택 + 지원 자격 표시
          - [지원하기]: 비로그인 → 로그인 안내 & 이동
          - [커리큘럼 생성]: 비로그인 → 로그인 안내 & 이동
      ═══════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedCompany && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  {/* 기업 로고 */}
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${selectedCompany.color} text-white font-bold text-xl shadow-md flex-shrink-0`}
                  >
                    {selectedCompany.logo}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">{selectedCompany.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">{selectedCompany.field}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* 기업 소개 */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    기업 소개
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedCompany.companyInfo}
                  </p>
                </div>

                {/* 모집 정보 */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">{selectedCompany.positions}개</span>
                    <span className="text-muted-foreground">포지션</span>
                  </span>
                  <span className="text-destructive font-semibold">
                    마감 {selectedCompany.deadline}
                  </span>
                </div>

                {/* 기술 스택 */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    주요 기술 스택
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCompany.techStack.map((tech) => (
                      <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
                    ))}
                  </div>
                </div>

                {/* 지원 자격 */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    지원 자격
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedCompany.requirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 로그인 안내 배너 */}
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                  <p className="text-sm font-medium text-primary mb-1">
                    로그인 후 더 많은 기능을 이용하세요
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AI 포트폴리오 생성, 맞춤 커리큘럼 추천 등 다양한 취업 지원 기능을 제공합니다.
                  </p>
                </div>

                {/* 액션 버튼 그룹 */}
                <div className="space-y-2 pt-2">
                  {/* 지원하기 버튼: 비로그인 시 로그인 안내 */}
                  <Button
                    className="w-full gap-2 font-semibold"
                    size="lg"
                    onClick={() => handleLoginRequired("지원하기")}
                  >
                    <FileText className="h-4 w-4" />
                    지원하기 (AI 포트폴리오 생성)
                  </Button>

                  {/* 커리큘럼 생성 버튼: 비로그인 시 로그인 안내 */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 font-semibold"
                    size="lg"
                    onClick={() => handleLoginRequired("커리큘럼 생성")}
                  >
                    <GraduationCap className="h-4 w-4" />
                    커리큘럼 생성
                  </Button>

                  {/* 로그인 바로 가기 */}
                  <Link href="/login" className="block">
                    <Button variant="ghost" className="w-full gap-2 text-primary">
                      <LogIn className="h-4 w-4" />
                      로그인하고 전체 기능 이용하기
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
