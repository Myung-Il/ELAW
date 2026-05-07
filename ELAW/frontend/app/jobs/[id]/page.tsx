/**
 * [페이지] 기업 공고 상세 페이지 (/jobs/[id])
 *
 * 접근 권한:
 *   - 로그인 사용자: 기업 소개 + [지원하기] + [커리큘럼 생성] 버튼 모두 사용 가능
 *   - 비로그인 사용자: 기업 소개글만 열람 가능
 *                     [지원하기] / [커리큘럼 생성] 클릭 → 로그인 안내 + /login 이동
 *
 * 시나리오:
 *   - [지원하기] 클릭 → /jobs/{id}/apply 로 이동 (AI 포트폴리오 생성 페이지)
 *   - [커리큘럼 생성] 클릭 → /curriculum?company={id} 로 이동 (기업 맞춤 커리큘럼)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   - jobsData를 GET /api/v1/jobs/{id} 로 교체하세요 (useEffect + useState 패턴)
 *   - 로딩 상태에서 Skeleton 컴포넌트를 표시하세요
 *
 * [BE 매뉴얼]
 *   GET /api/v1/jobs/{id}
 *     Response: {
 *       id, company, position, field, deadline, logo, color, match,
 *       positions, location, website, founded, employees,
 *       companyInfo, jobDesc, requirements, preferences, techStack, benefits,
 *       apply_url  ← 기업 공식 채용 URL
 *     }
 *
 * [DB 매뉴얼]
 *   JobPostings JOIN Companies 테이블
 *     - JobPostings: id, company_id, title, field, deadline, positions, description, tech_stack, requirements, preferences, benefits
 *     - Companies: id, name, logo, color, website, founded, employees, apply_url, company_info
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import PublicHeader from "@/components/layout/public-header"
import {
  Building2,
  Briefcase,
  Users,
  Calendar,
  MapPin,
  Globe,
  ArrowLeft,
  FileText,
  GraduationCap,
  CheckCircle,
  Clock,
  TrendingUp,
  LogIn,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

// ─────────────────────────────────────────────────────────────────────────────
// 기업 데이터 (추후 API 연동 필요)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 기업 상세 데이터 맵
 * [FE 수정 매뉴얼] 실제 구현 시 useEffect에서 GET /api/v1/jobs/{id} 호출
 * [DB 매뉴얼] JobPostings JOIN Companies 테이블에서 id로 조회
 */
const jobsData: Record<string, {
  id: number; company: string; position: string; field: string
  deadline: string; logo: string; color: string; match: number
  positions: number; desc: string; location: string; website: string
  founded: string; employees: string; requirements: string[]
  preferences: string[]; benefits: string[]; techStack: string[]
  jobDesc: string; companyInfo: string; applyUrl: string
}> = {
  "1": {
    id: 1,
    company: "삼성전자", position: "SW 개발 신입", field: "IT/반도체",
    deadline: "2025-05-15", logo: "S", color: "bg-blue-500", match: 94,
    positions: 50, location: "경기도 수원시", website: "https://www.samsung.com",
    founded: "1969년", employees: "270,000명+",
    desc: "삼성전자 MX사업부 소프트웨어 개발 신입사원 모집",
    companyInfo: "삼성전자는 세계 최대의 IT 기업 중 하나로, 반도체, 스마트폰, 가전제품 분야에서 세계 시장을 선도하고 있습니다. 혁신적인 기술로 미래를 만들어가는 글로벌 리더입니다.",
    jobDesc: "MX사업부의 갤럭시 스마트폰 운영체제 및 앱 개발에 참여합니다. Android 플랫폼 기반의 시스템 소프트웨어 개발 및 최적화 업무를 수행합니다.",
    requirements: ["컴퓨터공학 또는 관련 전공 졸업(예정)", "Java/Kotlin 또는 C++ 개발 경험", "알고리즘 및 자료구조 기본 지식", "의사소통 능력 및 팀워크"],
    preferences: ["안드로이드 앱 개발 프로젝트 경험", "오픈소스 기여 경험", "삼성 SW 역량테스트 B형 이상", "외국어 능통자"],
    techStack: ["Java", "Kotlin", "C++", "Android", "Linux", "Git"],
    benefits: ["연봉 5,000만원~", "성과급 연 2회", "사내 어린이집", "기숙사 제공", "의료비 지원", "주 5일 근무"],
    applyUrl: "https://careers.samsung.com",
  },
  "2": {
    id: 2,
    company: "카카오", position: "서버 개발 인턴", field: "IT",
    deadline: "2025-05-22", logo: "K", color: "bg-yellow-500", match: 89,
    positions: 20, location: "제주도 서귀포시 / 경기도 성남시", website: "https://www.kakao.com",
    founded: "2014년", employees: "13,000명+",
    desc: "카카오 AI 플랫폼팀 서버 개발 인턴십 모집",
    companyInfo: "카카오는 국내 대표 IT 플랫폼 기업으로 카카오톡, 카카오페이, 카카오모빌리티 등 다양한 서비스를 운영합니다.",
    jobDesc: "AI 플랫폼팀에서 대규모 트래픽 처리 서버 개발 업무에 참여합니다. Spring Boot 기반의 REST API 개발 및 데이터베이스 설계에 참여합니다.",
    requirements: ["컴퓨터공학 관련 전공 재학생/졸업생", "Java 또는 Kotlin 기본 지식", "데이터베이스 기초 이해"],
    preferences: ["Spring Framework 경험", "오픈소스 기여 경험", "클라우드 플랫폼 경험"],
    techStack: ["Java", "Spring Boot", "Kotlin", "MySQL", "Redis", "Kafka"],
    benefits: ["월 300만원 인턴십 급여", "정규직 전환 기회", "카카오 내부 서비스 식사", "교통비 지원"],
    applyUrl: "https://careers.kakao.com",
  },
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  /** 인증 상태 확인 - 로그인 여부에 따라 버튼 동작이 달라짐 */
  const { isLoggedIn, isLoading } = useAuth()

  // [FE 수정 매뉴얼] 실제 구현 시 useState + useEffect로 API 데이터 로드
  const job = jobsData[id] || jobsData["1"]

  /**
   * 비로그인 상태에서 로그인 필요 버튼 클릭 시 처리
   * 안내 메시지 표시 후 로그인 페이지로 이동
   */
  const handleLoginRequired = (action: string) => {
    alert(`${action} 기능은 로그인 후 이용할 수 있습니다.\n로그인 페이지로 이동합니다.`)
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 로그인 상태에 따라 헤더 분기 */}
      {isLoggedIn ? <AppHeader /> : <PublicHeader />}

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          기업 공고 목록으로
        </button>

        {/* ── 기업 헤더 카드 ───────────────────────────────────── */}
        <Card className="mb-6 shadow-sm overflow-hidden">
          {/* 상단 컬러 바 */}
          <div className="h-3 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              {/* 기업 로고 */}
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${job.color} text-white font-bold text-xl shadow-md flex-shrink-0`}
              >
                {job.logo}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold">{job.company}</h1>
                  {/* AI 매칭 점수 (로그인 상태에서만 표시) */}
                  {isLoggedIn && (
                    <Badge variant="secondary" className="text-sm">
                      AI 매칭 {job.match}%
                    </Badge>
                  )}
                </div>
                <p className="text-lg text-primary font-semibold mb-2">{job.position}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {job.employees}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    창립 {job.founded}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {job.positions}명 모집
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── 메인 정보 (좌측 2/3) ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 기업 소개 - 비로그인 사용자도 열람 가능 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  기업 소개
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{job.companyInfo}</p>
                <a
                  href={job.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  공식 홈페이지 방문
                </a>
              </CardContent>
            </Card>

            {/* 직무 소개 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4 text-primary" />
                  직무 소개
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{job.jobDesc}</p>

                {/* 기술 스택 */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">기술 스택</p>
                  <div className="flex flex-wrap gap-2">
                    {job.techStack.map((tech) => (
                      <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
                    ))}
                  </div>
                </div>

                {/* 지원 자격 */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">지원 자격</p>
                  <ul className="space-y-1.5">
                    {job.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 우대 사항 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">우대 사항</p>
                  <ul className="space-y-1.5">
                    {job.preferences.map((pref, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-1">+</span>
                        {pref}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 복리후생 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  복리후생
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {job.benefits.map((benefit) => (
                    <span
                      key={benefit}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {benefit}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── 사이드바: 지원 액션 (우측 1/3) ─────────────── */}
          <div className="space-y-4">
            {/* 마감일 + 액션 카드 */}
            <Card className="shadow-sm border-primary/20">
              <CardContent className="p-5">
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground mb-1">지원 마감</p>
                  <p className="text-xl font-bold text-destructive">{job.deadline}</p>
                </div>

                <div className="space-y-2">
                  {isLoggedIn ? (
                    /* 로그인 상태: 정상 버튼 표시 */
                    <>
                      {/* 지원하기: AI 포트폴리오 생성 후 기업 채용 페이지로 이동 */}
                      <Link href={`/jobs/${id}/apply`} className="block">
                        <Button className="w-full gap-2 font-semibold shadow-sm" size="lg">
                          <FileText className="h-4 w-4" />
                          지원하기 (포트폴리오 생성)
                        </Button>
                      </Link>

                      {/* 커리큘럼 생성: 이 기업 맞춤 커리큘럼 생성 */}
                      <Link href={`/curriculum?company=${id}`} className="block">
                        <Button variant="outline" className="w-full gap-2 font-semibold" size="lg">
                          <GraduationCap className="h-4 w-4" />
                          커리큘럼 생성
                        </Button>
                      </Link>
                    </>
                  ) : (
                    /* 비로그인 상태: 로그인 안내 버튼 표시 */
                    <>
                      <Button
                        className="w-full gap-2 font-semibold shadow-sm"
                        size="lg"
                        onClick={() => handleLoginRequired("지원하기")}
                      >
                        <FileText className="h-4 w-4" />
                        지원하기 (로그인 필요)
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full gap-2 font-semibold"
                        size="lg"
                        onClick={() => handleLoginRequired("커리큘럼 생성")}
                      >
                        <GraduationCap className="h-4 w-4" />
                        커리큘럼 생성 (로그인 필요)
                      </Button>
                      {/* 로그인 바로가기 */}
                      <Link href="/login" className="block">
                        <Button variant="ghost" className="w-full gap-2 text-primary text-sm">
                          <LogIn className="h-4 w-4" />
                          로그인하고 지원하기
                        </Button>
                      </Link>
                    </>
                  )}
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  지원 전 기업 공식 채용 페이지에서 최신 공고를 확인하세요
                </p>
              </CardContent>
            </Card>

            {/* 나의 준비 현황 (로그인 사용자만 표시) */}
            {/* [BE 매뉴얼] GET /api/v1/jobs/{id}/readiness - 사용자의 준비 현황 */}
            {/* [DB 매뉴얼] UserProgress JOIN JobRequirements로 준비 수준 비교 */}
            {isLoggedIn && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">나의 준비 현황</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "알고리즘", progress: 62, required: 80 },
                    { label: "자료구조", progress: 85, required: 75 },
                    { label: "운영체제", progress: 45, required: 60 },
                  ].map((item) => {
                    const isReady = item.progress >= item.required
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className={isReady ? "text-primary font-semibold" : "text-destructive font-semibold"}>
                            {item.progress}% / 필요 {item.required}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${isReady ? "bg-primary" : "bg-destructive/70"}`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-xs text-muted-foreground pt-1">
                    <Clock className="inline h-3 w-3 mr-1" />
                    예상 준비 기간: 3-4주
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
