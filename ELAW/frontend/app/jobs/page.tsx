// ═══════════════════════════════════════════════════════════════════════════
// 기업 공고 목록 페이지  (/jobs)
// ───────────────────────────────────────────────────────────────────────────
// - 로그인 여부와 관계없이 모든 사용자가 공고 목록을 볼 수 있습니다.
// - 로그인 전: PublicHeader 표시, 각 카드 클릭 시 /jobs/[id] 로 이동
//              (상세 페이지에서 [지원하기] 등 로그인 필요 기능이 차단됨)
// - 로그인 후: AppHeader 표시, AI 매칭 점수가 카드에 표시됨
// - 검색/필터: 기업명·직무 검색, 분야별 필터 버튼
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import PublicHeader from "@/components/layout/public-header"
import { useAuth } from "@/hooks/use-auth"
import { Search, Briefcase, ChevronRight, SlidersHorizontal } from "lucide-react"

// ─── 기업 공고 더미 데이터 ─────────────────────────────────────────────────
// [FE 수정 매뉴얼] companies 배열 → GET /api/v1/jobs?field=&search=&page=1&limit=12 로 교체
//   검색어(search)와 분야(field)를 쿼리 파라미터로 전달, 디바운스(300ms) 적용 권장
// [BE 매뉴얼] GET /api/v1/jobs
//   Query: field(string), search(string), page(int), limit(int)
//   Response: { jobs: [{id, company, position, field, deadline, logo, color, match, positions, desc}], total, page, totalPages }
//   - match(AI 매칭 점수)는 로그인한 경우에만 의미가 있으며, 비로그인 시 null 또는 생략
//   - 인증 헤더(Authorization: Bearer {token})가 없을 경우 match 없이 응답
// [DB 매뉴얼] JobPostings 테이블:
//   id, company_id(FK→Companies), title(직무명), field(분야), deadline(마감일), status(active/closed)
//   Companies 테이블: id, name, logo_char, logo_color, description
//   UserJobMatch 테이블: user_id, job_id, match_score (AI 매칭 결과 저장)
const companies = [
  { id: 1, company: "삼성전자", position: "SW 개발 신입", field: "IT/반도체", deadline: "D-7", logo: "S", color: "bg-blue-500", match: 94, positions: 50, desc: "삼성전자 MX사업부 소프트웨어 개발 신입사원 모집" },
  { id: 2, company: "카카오", position: "서버 개발 인턴", field: "IT", deadline: "D-14", logo: "K", color: "bg-yellow-500", match: 89, positions: 20, desc: "카카오 AI 플랫폼팀 서버 개발 인턴십 모집" },
  { id: 3, company: "LG전자", position: "임베디드 SW 개발", field: "전자", deadline: "D-21", logo: "L", color: "bg-red-500", match: 85, positions: 30, desc: "LG전자 H&A사업부 임베디드 소프트웨어 개발자" },
  { id: 4, company: "SK하이닉스", position: "반도체 공정 엔지니어", field: "반도체", deadline: "D-30", logo: "SK", color: "bg-orange-500", match: 78, positions: 15, desc: "SK하이닉스 DRAM 공정 설계 및 개발 엔지니어" },
  { id: 5, company: "현대자동차", position: "자율주행 SW 개발", field: "자동차", deadline: "D-10", logo: "H", color: "bg-sky-500", match: 82, positions: 25, desc: "현대자동차 SDV(Software Defined Vehicle) 부문 개발자" },
  { id: 6, company: "네이버", position: "AI 연구 개발", field: "IT", deadline: "D-18", logo: "N", color: "bg-green-500", match: 76, positions: 10, desc: "네이버 AI Lab 자연어처리/컴퓨터비전 연구개발자" },
  { id: 7, company: "포스코", position: "공정 엔지니어", field: "철강/소재", deadline: "D-25", logo: "P", color: "bg-slate-500", match: 71, positions: 35, desc: "POSCO 철강 생산 공정 최적화 엔지니어 모집" },
  { id: 8, company: "두산로보틱스", position: "로봇 SW 개발", field: "로봇/자동화", deadline: "D-12", logo: "D", color: "bg-teal-500", match: 80, positions: 8, desc: "협동 로봇 제어 소프트웨어 개발자 모집" },
]

// 분야 필터 목록 - 기업 데이터의 field 값과 일치해야 합니다
// [BE 매뉴얼] GET /api/v1/jobs/fields → 분야 목록 동적 로딩 가능
const fields = ["전체", "IT", "IT/반도체", "반도체", "전자", "자동차", "철강/소재", "로봇/자동화"]

export default function JobsPage() {
  const [search, setSearch] = useState("")
  const [selectedField, setSelectedField] = useState("전체")

  // 로그인 상태 감지 (SSR 안전: useEffect 내부에서 localStorage 접근)
  // - 로그인 여부에 따라 헤더 컴포넌트와 AI 매칭 점수 표시 여부 결정
  const { isLoggedIn, isLoading } = useAuth()

  // ─── 클라이언트 사이드 검색/필터 처리 ──────────────────────────────────────
  // [FE 수정 매뉴얼] 실제 구현 시 검색어/필터 변경 시마다 API 호출로 교체
  //   - useDebounce(search, 300) 훅으로 입력 디바운싱 적용
  //   - 서버에서 필터링하면 대규모 데이터에서 성능 개선
  const filtered = companies.filter((c) => {
    const matchesSearch = c.company.includes(search) || c.position.includes(search)
    const matchesField = selectedField === "전체" || c.field === selectedField
    return matchesSearch && matchesField
  })

  // 로딩 중에는 레이아웃 깜빡임 방지를 위해 헤더를 렌더링하지 않음
  if (isLoading) return null

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 헤더: 로그인 상태에 따라 다른 컴포넌트 렌더링 */}
      {/* - AppHeader: 로그인 후, 프로필 드롭다운 + 내비게이션 탭 */}
      {/* - PublicHeader: 비로그인, 로그인/회원가입 버튼 + 게시판 탭 */}
      {isLoggedIn ? <AppHeader /> : <PublicHeader />}

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        {/* ── 페이지 헤더 섹션 ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">기업 공고</h1>
          <p className="text-muted-foreground text-sm">
            {isLoggedIn
              ? "AI가 나의 학습 데이터를 분석해 맞춤 기업을 추천합니다"
              : "기업 공고를 검색하고 원하는 기업을 찾아보세요"}
          </p>
        </div>

        {/* ── 검색 & 필터 섹션 ─────────────────────────────────────────── */}
        <div className="mb-6 space-y-4">
          {/* 텍스트 검색창 */}
          {/* [FE 수정 매뉴얼] onChange 이벤트에 디바운스 적용 후 API 호출로 교체 */}
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="기업명 또는 직무로 검색"
              className="pl-10 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* 분야 필터 버튼 목록 */}
          {/* [FE 수정 매뉴얼] fields 배열을 GET /api/v1/jobs/fields API로 교체 */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {fields.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setSelectedField(field)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  selectedField === field
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 결과 카운트 */}
        {/* [FE 수정 매뉴얼] API 응답의 total 값으로 교체 */}
        <p className="mb-4 text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{filtered.length}</span>개의 공고
        </p>

        {/* ── 기업 카드 그리드 ──────────────────────────────────────────── */}
        {/* [FE 수정 매뉴얼] filtered 배열을 API 응답 데이터(jobs)로 교체 */}
        {/* 각 카드는 /jobs/[id] 로 링크 → 상세 페이지에서 로그인 게이트 처리됨 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((job) => (
            <Link href={`/jobs/${job.id}`} key={job.id}>
              <Card className="h-full cursor-pointer card-hover group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    {/* 기업 로고 아이콘 */}
                    {/* [FE 수정 매뉴얼] logo_url 이 있을 경우 <Image> 컴포넌트로 교체 */}
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${job.color} text-white font-bold shadow-sm`}>
                      {job.logo}
                    </div>
                    {/* AI 매칭 점수 뱃지 - 로그인한 사용자에게만 표시 */}
                    {/* [BE 매뉴얼] 사용자 학습 데이터 기반 AI 매칭 점수는 서버에서 계산하여 응답 */}
                    {isLoggedIn && (
                      <Badge variant="secondary" className="text-xs">
                        매칭 {job.match}%
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{job.company}</CardTitle>
                  <CardDescription className="text-sm font-medium text-foreground/70 line-clamp-1">
                    {job.position}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{job.desc}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-primary" />
                        {job.positions}명 모집
                      </span>
                      <Badge variant="outline" className="text-xs">{job.field}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-destructive">{job.deadline} 마감</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* 검색 결과 없음 안내 */}
        {filtered.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <Search className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p className="font-medium">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 검색어나 필터를 사용해보세요</p>
          </div>
        )}

        {/* 비로그인 사용자 안내 배너 */}
        {/* 로그인하면 AI 매칭 점수, 지원하기, 커리큘럼 생성 기능을 이용할 수 있음을 알림 */}
        {!isLoggedIn && (
          <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 text-center">
            <p className="text-sm font-medium text-foreground mb-1">
              로그인하면 AI 매칭 점수와 맞춤 추천 기업을 확인할 수 있어요!
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              관심 기업에 지원하거나 커리큘럼을 생성하려면 로그인이 필요합니다.
            </p>
            <div className="flex gap-2 justify-center">
              <Link href="/login">
                <Button size="sm">로그인</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" variant="outline">회원가입</Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
