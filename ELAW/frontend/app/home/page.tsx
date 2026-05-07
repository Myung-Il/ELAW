/**
 * [페이지] 메인 홈 페이지 (/home) - 로그인 후 메인 대시보드
 *
 * 구성 섹션 (5개):
 *   1. 환영 배너 - 사용자 이름 + 진행 현황 요약
 *   2. 기업 공고 - AI 추천 기업 공고 3개 + 전체 보기
 *   3. 커리큘럼 현황 - 진행률, 과목별 상세, 합격자 비교
 *   4. 공부 목록 - 현재 커리큘럼의 학습 항목
 *   5. 게시판 요약 - 최신 공지/QnA/행사 글 목록
 *
 * 디자인 정책:
 *   - 랜딩페이지(app/page.tsx)와 동일한 디자인 언어 사용
 *   - 섹션마다 Badge + 타이틀 + 설명 패턴 유지
 *   - bg-background + border-t 섹션 구분 방식 사용
 *   - 동일한 Card, Badge, Button 컴포넌트 스타일 적용
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   모든 더미 데이터를 useEffect 내 API 호출로 교체해야 합니다.
 *   API 호출 예시:
 *     useEffect(() => {
 *       Promise.all([
 *         fetch("/api/v1/jobs/recommended").then(r => r.json()),
 *         fetch("/api/v1/curriculum/me").then(r => r.json()),
 *         fetch("/api/v1/study/my-list").then(r => r.json()),
 *         fetch("/api/v1/board/recent?limit=4").then(r => r.json()),
 *       ]).then(([jobs, curriculum, study, board]) => { ... })
 *     }, [])
 *
 * [BE 매뉴얼]
 *   - GET /api/v1/home/dashboard → 홈 대시보드 종합 데이터 (한 번에 반환하는 통합 API 권장)
 *   - GET /api/v1/jobs/recommended → 사용자 커리큘럼/목표 기반 AI 추천 공고
 *   - GET /api/v1/curriculum/me → 현재 사용자의 커리큘럼 진행 상황
 *   - GET /api/v1/study/my-list → 내 커리큘럼에 포함된 학습 항목
 *   - GET /api/v1/board/recent?limit=4 → 최신 게시글 4개
 *   - GET /api/v1/events/upcoming?limit=2 → 다가오는 일정 2개
 *   - GET /api/v1/auth/me → 로그인 사용자 정보 (이름, 학과)
 *
 * [DB 매뉴얼]
 *   - JobPostings JOIN Companies → 추천 공고 목록
 *   - UserCurriculum JOIN CurriculumWeeks JOIN StudyProgress → 진행 현황
 *   - BoardPosts ORDER BY created_at DESC LIMIT 4 → 최신 게시글
 *   - Events WHERE event_date > NOW() ORDER BY event_date ASC LIMIT 2
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  Building2,
  GraduationCap,
  BookOpen,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Trophy,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  Eye,
  Bell,
  HelpCircle,
  CheckCircle,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// 더미 데이터 (추후 API 연동 필요)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI 추천 기업 공고 (사용자 커리큘럼/목표 기반)
 * [BE 매뉴얼] GET /api/v1/jobs/recommended
 *   - match: AI가 계산한 사용자-기업 적합도 점수 (0~100%)
 *   - 헤더에 Authorization: Bearer {token} 필요
 * [DB 매뉴얼] JobPostings + Companies JOIN UserGoals → 목표 직무와의 관련성 계산
 */
const featuredJobs = [
  {
    id: 1,
    company: "삼성전자",
    position: "SW 개발 신입",
    field: "IT/반도체",
    deadline: "D-7",
    logo: "S",
    color: "bg-blue-500",
    match: 94,
  },
  {
    id: 2,
    company: "카카오",
    position: "서버 개발 인턴",
    field: "IT",
    deadline: "D-14",
    logo: "K",
    color: "bg-yellow-500",
    match: 89,
  },
  {
    id: 3,
    company: "LG전자",
    position: "임베디드 SW 개발",
    field: "전자",
    deadline: "D-21",
    logo: "L",
    color: "bg-red-500",
    match: 85,
  },
]

/**
 * 커리큘럼 현황 데이터
 * [BE 매뉴얼] GET /api/v1/curriculum/me
 *   Response: { totalWeeks, completedWeeks, totalProblems, solvedProblems, progressPercent,
 *               comparisonText, subjects: [{ name, progress, color }] }
 * [DB 매뉴얼] UserCurriculum + StudyProgress 테이블 JOIN + 집계
 */
const curriculumStatus = {
  totalWeeks: 12,
  completedWeeks: 3,
  inProgressWeek: 4,
  totalProblems: 410,
  solvedProblems: 121,
  progressPercent: 29,
  comparisonText: "삼성전자 합격자 평균보다 15% 낮음",
  subjects: [
    { name: "자료구조", progress: 85, color: "bg-primary" },
    { name: "알고리즘", progress: 62, color: "bg-primary" },
    { name: "운영체제", progress: 45, color: "bg-accent" },
  ],
}

/**
 * 나의 공부 목록 (현재 커리큘럼에 포함된 학습 항목)
 * [BE 매뉴얼] GET /api/v1/study/my-list
 *   Response: { items: [{ id, title, category, problems, duration, difficulty }] }
 * [DB 매뉴얼] StudyCurriculum JOIN StudyTopics WHERE user_id = ? AND status != 'completed'
 */
const studyItems = [
  { id: 1, title: "이진 탐색 트리(BST)", category: "자료구조", problems: 12, duration: "2시간", difficulty: "중" },
  { id: 2, title: "다이나믹 프로그래밍", category: "알고리즘", problems: 20, duration: "4시간", difficulty: "상" },
  { id: 3, title: "그래프 탐색(BFS/DFS)", category: "알고리즘", problems: 15, duration: "3시간", difficulty: "중" },
]

/**
 * 게시판 최신 게시글
 * [BE 매뉴얼] GET /api/v1/board/recent?limit=4
 *   Response: { posts: [{ id, category, title, author, date, views }] }
 * [DB 매뉴얼] BoardPosts ORDER BY created_at DESC LIMIT 4
 */
const boardPosts = [
  { id: 1, category: "공지", title: "2025년 상반기 취업 설명회 개최 안내", author: "운영팀", date: "2025.04.25", views: 1240 },
  { id: 2, category: "QnA", title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?", author: "kim**", date: "2025.04.24", views: 342 },
  { id: 3, category: "행사", title: "현대자동차 그룹 채용 설명회 (04.30)", author: "운영팀", date: "2025.04.23", views: 891 },
  { id: 4, category: "QnA", title: "CS 면접 단골 질문 정리해주실 분 있나요?", author: "park**", date: "2025.04.22", views: 567 },
]

/**
 * 예정 일정
 * [BE 매뉴얼] GET /api/v1/events/upcoming?limit=2
 * [DB 매뉴얼] Events WHERE event_date > NOW() ORDER BY event_date ASC LIMIT 2
 */
const upcomingEvents = [
  { title: "AI 해커톤 챌린지", date: "04.28", dDay: 2, type: "대회" },
  { title: "삼성전자 코딩테스트", date: "05.03", dDay: 7, type: "채용" },
]

/** 카테고리 배지 색상 매핑 */
const categoryColors: Record<string, string> = {
  공지: "bg-blue-100 text-blue-700",
  QnA: "bg-green-100 text-green-700",
  행사: "bg-orange-100 text-orange-700",
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 인증된 사용자 헤더: 프로필 드롭다운 포함 */}
      <AppHeader />

      <main>
        {/* ═══════════════════════════════════════════════════════════
            환영 배너 섹션
            - 사용자 이름과 현재 진행 상황 요약 표시
            - 랜딩페이지 히어로 섹션과 동일한 gradient 배경 사용
        ═══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-12 md:py-16">
          {/* 랜딩페이지와 동일한 배경 그라디언트 */}
          <div className="absolute inset-0 gradient-bg" />
          <div
            className="absolute top-0 right-0 w-1/2 h-full opacity-20"
            style={{
              background: "radial-gradient(ellipse at 80% 20%, oklch(0.65 0.22 280 / 0.15), transparent 60%)",
            }}
          />

          <div className="container relative mx-auto px-4 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                {/* [FE 수정 매뉴얼] "홍길동"을 API에서 받은 userName으로 교체 */}
                <p className="text-sm text-primary/70 font-medium mb-1">안녕하세요 👋</p>
                <h1 className="text-2xl md:text-3xl font-extrabold">
                  홍길동님, 오늘도 성장하는 하루 되세요!
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                  AI 커리큘럼 {curriculumStatus.inProgressWeek}주차 진행 중
                  · 전체 <span className="font-semibold text-primary">{curriculumStatus.progressPercent}%</span> 완료
                </p>
              </div>
              <Link href="/curriculum">
                <Button className="gap-2 font-semibold shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  커리큘럼 이어하기
                </Button>
              </Link>
            </div>

            {/* 빠른 진행률 통계 카드 - 랜딩페이지 통계 카드와 동일한 스타일 */}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { value: `${curriculumStatus.progressPercent}%`, label: "전체 진행률" },
                { value: `${curriculumStatus.completedWeeks}/${curriculumStatus.totalWeeks}주`, label: "완료 주차" },
                { value: `${curriculumStatus.solvedProblems}문제`, label: "해결 문제" },
                { value: "상위 30%", label: "학습 랭킹" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border bg-card p-5 text-center shadow-sm"
                >
                  <p className="text-2xl font-extrabold text-primary">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 1: 기업 공고
            - AI 추천 기업 공고 표시
            - 클릭 시 /jobs/{id} 상세 페이지로 이동
        ═══════════════════════════════════════════════════════════ */}
        <section className="border-t py-14">
          <div className="container mx-auto px-4 lg:px-8">
            {/* 섹션 헤더 - 랜딩페이지와 동일한 Badge + 타이틀 패턴 */}
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <Badge variant="outline" className="mb-3">
                  <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  취업 연계
                </Badge>
                <h2 className="text-2xl font-bold">AI 추천 기업 공고</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  나의 학습 데이터 기반으로 AI가 추천한 기업입니다
                </p>
              </div>
              <Link href="/jobs">
                <Button variant="outline" className="gap-2">
                  전체 공고 보기
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* [FE 수정 매뉴얼] featuredJobs를 GET /api/v1/jobs/recommended 로 교체 */}
            <div className="grid gap-4 sm:grid-cols-3">
              {featuredJobs.map((job) => (
                <Link href={`/jobs/${job.id}`} key={job.id}>
                  <Card className="h-full cursor-pointer card-hover group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        {/* 기업 로고 */}
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl ${job.color} text-white font-bold text-sm flex-shrink-0 shadow-sm`}
                        >
                          {job.logo}
                        </div>
                        {/* AI 매칭 점수 */}
                        <Badge variant="secondary" className="text-xs">
                          매칭 {job.match}%
                        </Badge>
                      </div>
                      <p className="font-semibold">{job.company}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 mb-3">{job.position} · {job.field}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                          {job.deadline} 마감
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 2: 커리큘럼 현황
            - 전체 진행률 + 과목별 진행률
            - 기업 합격자 비교 지표
        ═══════════════════════════════════════════════════════════ */}
        <section className="border-t bg-muted/30 py-14">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <Badge variant="outline" className="mb-3">
                  <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
                  학습 현황
                </Badge>
                <h2 className="text-2xl font-bold">커리큘럼 현황</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI가 생성한 맞춤형 12주 학습 커리큘럼의 진행 상황
                </p>
              </div>
              <Link href="/curriculum">
                <Button variant="outline" className="gap-2">
                  커리큘럼 상세
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* [FE 수정 매뉴얼] curriculumStatus를 GET /api/v1/curriculum/me 로 교체 */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* 전체 진행률 카드 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">전체 진행률</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">완료율</span>
                      <span className="font-bold text-primary">{curriculumStatus.progressPercent}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${curriculumStatus.progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {curriculumStatus.solvedProblems}/{curriculumStatus.totalProblems} 문제 완료
                      · {curriculumStatus.completedWeeks}/{curriculumStatus.totalWeeks}주 완료
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 과목별 진행률 카드 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">과목별 진행률</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {curriculumStatus.subjects.map((subj) => (
                    <div key={subj.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground font-medium">{subj.name}</span>
                        <span className="font-semibold">{subj.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${subj.color}`}
                          style={{ width: `${subj.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 합격자 비교 카드 */}
              {/* [BE 매뉴얼] GET /api/v1/curriculum/comparison?company_id=1 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    합격자 비교
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl bg-muted/50 border p-4 mb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {curriculumStatus.comparisonText}
                    </p>
                  </div>
                  <Link href="/curriculum">
                    <Button variant="outline" className="w-full gap-2 text-sm">
                      상세 비교 보기
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 3: 공부 목록
            - 현재 커리큘럼의 학습 항목 표시
            - 클릭 시 /study 페이지로 이동
        ═══════════════════════════════════════════════════════════ */}
        <section className="border-t py-14">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <Badge variant="outline" className="mb-3">
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  학습 목록
                </Badge>
                <h2 className="text-2xl font-bold">나의 공부 목록</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  현재 커리큘럼에 포함된 학습 항목입니다
                </p>
              </div>
              <Link href="/study">
                <Button variant="outline" className="gap-2">
                  전체 목록
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* [FE 수정 매뉴얼] studyItems를 GET /api/v1/study/my-list 로 교체 */}
            <div className="space-y-3 max-w-4xl">
              {studyItems.map((item) => (
                <Link href="/study" key={item.id}>
                  <Card className="cursor-pointer card-hover group">
                    <CardContent className="flex items-center gap-4 p-4">
                      {/* 학습 아이콘 */}
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.category}</p>
                      </div>

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                        <span className="hidden sm:flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {item.problems}문제
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.duration}
                        </span>
                        <Badge
                          variant={item.difficulty === "상" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {item.difficulty}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            섹션 4: 게시판 요약 + 예정 일정
            - 행사, QnA, 공지를 목록 형식으로 요약
            - 우측에 D-Day 카운트다운 카드
        ═══════════════════════════════════════════════════════════ */}
        <section className="border-t bg-muted/30 py-14">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-3">

              {/* 게시판 요약 (좌측 2/3) */}
              <div className="lg:col-span-2">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <Badge variant="outline" className="mb-3">
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      커뮤니티
                    </Badge>
                    <h2 className="text-2xl font-bold">게시판</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      행사, 공지, Q&A를 한눈에 확인하세요
                    </p>
                  </div>
                  <Link href="/board">
                    <Button variant="outline" className="gap-2">
                      전체 게시판
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {/* [FE 수정 매뉴얼] boardPosts를 GET /api/v1/board/recent?limit=4 로 교체 */}
                <Card className="shadow-sm">
                  {boardPosts.map((post, i) => (
                    <Link href={`/board/${post.id}`} key={post.id}>
                      <div
                        className={`flex items-start gap-3 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group ${i < boardPosts.length - 1 ? "border-b" : ""}`}
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
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>{post.author}</span>
                            <span>{post.date}</span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {post.views.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </Card>
              </div>

              {/* 예정 일정 (우측 1/3) */}
              <div>
                <div className="mb-6">
                  <Badge variant="outline" className="mb-3">
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    일정
                  </Badge>
                  <h2 className="text-2xl font-bold">예정 일정</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    다가오는 대회와 채용 일정
                  </p>
                </div>

                {/* [FE 수정 매뉴얼] upcomingEvents를 GET /api/v1/events/upcoming?limit=2 로 교체 */}
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <Card key={event.title} className="shadow-sm">
                      <CardContent className="flex items-center gap-4 p-4">
                        {/* D-Day 카운트다운 배지 */}
                        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground flex-shrink-0 shadow-sm">
                          <span className="text-[10px] font-medium opacity-80">D-</span>
                          <span className="text-lg font-extrabold leading-none">{event.dDay}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{event.date}</span>
                            <Badge variant="secondary" className="text-xs">{event.type}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
