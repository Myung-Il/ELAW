// 로그인 후 메인 홈 페이지
// 기업공고 / 커리큘럼 현황 / 공부목록 / 게시판 / 프로필 섹션 포함
"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  Building2, GraduationCap, BookOpen, MessageSquare,
  ChevronRight, TrendingUp, Trophy, Bell, Calendar,
  Briefcase, Sparkles, ArrowRight, Clock, Users,
} from "lucide-react"

// ─── 하드코딩 더미 데이터 (추후 API 연동 필요) ──────────────────────────────
// [FE 수정 매뉴얼] 아래 데이터를 useEffect 안에서 API 호출로 교체해야 합니다
// [BE 매뉴얼] GET /api/v1/home/dashboard → 홈 대시보드 종합 데이터 반환
// [DB 매뉴얼] 각 테이블에서 최신 데이터를 JOIN하여 반환하는 뷰(View) 또는 집계 API

// 추천 기업 공고
const featuredJobs = [
  { id: 1, company: "삼성전자", position: "SW 개발 신입", field: "IT/반도체", deadline: "D-7", logo: "S", color: "bg-blue-500", match: 94 },
  { id: 2, company: "카카오", position: "서버 개발 인턴", field: "IT", deadline: "D-14", logo: "K", color: "bg-yellow-500", match: 89 },
  { id: 3, company: "LG전자", position: "임베디드 SW 개발", field: "전자", deadline: "D-21", logo: "L", color: "bg-red-500", match: 85 },
]

// 나의 커리큘럼 현황
const curriculumStatus = {
  totalWeeks: 12,
  completedWeeks: 3,
  inProgressWeek: 4,
  totalProblems: 410,
  solvedProblems: 121,
  progressPercent: 29,
  comparisonText: "합격자 평균보다 15% 낮음",
  subjects: [
    { name: "자료구조", progress: 85, color: "bg-primary" },
    { name: "알고리즘", progress: 62, color: "bg-primary" },
    { name: "운영체제", progress: 45, color: "bg-accent" },
  ],
}

// 공부 목록
const studyItems = [
  { id: 1, title: "이진 탐색 트리(BST)", category: "자료구조", problems: 12, duration: "2시간", difficulty: "중" },
  { id: 2, title: "다이나믹 프로그래밍", category: "알고리즘", problems: 20, duration: "4시간", difficulty: "상" },
  { id: 3, title: "그래프 탐색(BFS/DFS)", category: "알고리즘", problems: 15, duration: "3시간", difficulty: "중" },
]

// 게시판 최신 글
const boardPosts = [
  { id: 1, category: "공지", title: "2025년 상반기 취업 설명회 개최 안내", author: "운영팀", date: "2025.04.25", views: 1240 },
  { id: 2, category: "QnA", title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?", author: "kim**", date: "2025.04.24", views: 342 },
  { id: 3, category: "행사", title: "현대자동차 그룹 채용 설명회 (04.30)", author: "운영팀", date: "2025.04.23", views: 891 },
  { id: 4, category: "QnA", title: "CS 면접 단골 질문 정리해주실 분 있나요?", author: "park**", date: "2025.04.22", views: 567 },
]

// 카테고리 배지 색상
const categoryColors: Record<string, string> = {
  "공지": "bg-blue-100 text-blue-700",
  "QnA": "bg-green-100 text-green-700",
  "행사": "bg-orange-100 text-orange-700",
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* 인증된 사용자 헤더 - 프로필 아이콘 포함 */}
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        {/* ── 환영 배너 ──────────────────────────────────── */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-primary px-8 py-8 text-primary-foreground shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-primary-foreground/70 font-medium mb-1">안녕하세요 👋</p>
              <h1 className="text-2xl font-bold">홍길동님, 오늘도 성장하는 하루 되세요!</h1>
              <p className="mt-2 text-primary-foreground/80 text-sm">
                AI 커리큘럼 4주차 진행 중 · 전체 {curriculumStatus.progressPercent}% 완료
              </p>
            </div>
            <Link href="/curriculum">
              <Button variant="secondary" className="gap-2 font-semibold shadow-sm">
                <Sparkles className="h-4 w-4" />
                커리큘럼 이어하기
              </Button>
            </Link>
          </div>
        </div>

        {/* ── 메인 그리드 ─────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── 좌측: 기업공고 + 공부목록 ──────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 기업 공고 섹션 */}
            {/* [FE 수정 매뉴얼] featuredJobs 배열을 GET /api/v1/jobs/recommended API로 교체 */}
            {/* [BE 매뉴얼] GET /api/v1/jobs/recommended - 사용자 커리큘럼 기반 추천 공고 반환 */}
            {/* [DB 매뉴얼] JobPostings 테이블과 Users 테이블의 goal_field를 JOIN하여 매칭 점수 계산 */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  AI 추천 기업 공고
                </CardTitle>
                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    전체 보기
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {featuredJobs.map((job) => (
                  <Link href={`/jobs/${job.id}`} key={job.id}>
                    <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                      {/* 기업 로고 */}
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${job.color} text-white font-bold text-sm flex-shrink-0`}>
                        {job.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{job.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{job.position} · {job.field}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* AI 매칭 점수 */}
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">매칭</p>
                          <p className="text-sm font-bold text-primary">{job.match}%</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {job.deadline}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* 공부 목록 섹션 */}
            {/* [FE 수정 매뉴얼] studyItems를 GET /api/v1/study/my-list API로 교체 */}
            {/* [BE 매뉴얼] GET /api/v1/study/my-list - 사용자 커리큘럼 기반 학습 항목 반환 */}
            {/* [DB 매뉴얼] StudyCurriculum 테이블: user_id, topic_id, order, status */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  나의 공부 목록
                </CardTitle>
                <Link href="/study">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    전체 보기
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {studyItems.map((item) => (
                  <Link href={`/study`} key={item.id}>
                    <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
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
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── 우측: 커리큘럼 현황 + 게시판 ──────────────── */}
          <div className="space-y-6">

            {/* 커리큘럼 현황 */}
            {/* [FE 수정 매뉴얼] curriculumStatus를 GET /api/v1/curriculum/me API로 교체 */}
            {/* [BE 매뉴얼] GET /api/v1/curriculum/me - 현재 사용자 커리큘럼 진행 상황 반환 */}
            {/* [DB 매뉴얼] UserCurriculum + StudyProgress 테이블 JOIN하여 집계 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  커리큘럼 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 전체 진행률 */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">전체 진행률</span>
                    <span className="font-semibold text-primary">{curriculumStatus.progressPercent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${curriculumStatus.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {curriculumStatus.solvedProblems}/{curriculumStatus.totalProblems} 문제 완료
                  </p>
                </div>

                {/* 과목별 진행률 */}
                <div className="space-y-3">
                  {curriculumStatus.subjects.map((subj) => (
                    <div key={subj.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{subj.name}</span>
                        <span className="font-medium">{subj.progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${subj.color}`}
                          style={{ width: `${subj.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 합격자 비교 */}
                <div className="rounded-lg bg-muted/50 border p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-muted-foreground">{curriculumStatus.comparisonText}</p>
                  </div>
                </div>

                <Link href="/curriculum" className="block">
                  <Button variant="outline" className="w-full gap-2 text-sm">
                    커리큘럼 상세 보기
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* 게시판 미리보기 */}
            {/* [FE 수정 매뉴얼] boardPosts를 GET /api/v1/board/recent API로 교체 */}
            {/* [BE 매뉴얼] GET /api/v1/board/recent?limit=4 - 최신 게시글 반환 */}
            {/* [DB 매뉴얼] BoardPosts 테이블: id, title, category, author_id, views, created_at */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  게시판
                </CardTitle>
                <Link href="/board">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    전체 보기
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {boardPosts.map((post) => (
                  <Link href={`/board/${post.id}`} key={post.id}>
                    <div className="flex items-start gap-2.5 rounded-lg p-2.5 hover:bg-muted/50 transition-colors cursor-pointer group">
                      <Badge className={`${categoryColors[post.category] || "bg-gray-100 text-gray-700"} text-xs flex-shrink-0 border-0 mt-0.5`}>
                        {post.category}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {post.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {post.date} · 조회 {post.views.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* 예정 일정 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  예정 일정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { title: "AI 해커톤 챌린지", date: "04.28", dDay: 2, type: "대회" },
                  { title: "삼성전자 코딩테스트", date: "05.03", dDay: 7, type: "채용" },
                ].map((event) => (
                  <div key={event.title} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <span className="text-[10px] font-medium">D-</span>
                      <span className="text-sm font-bold leading-none">{event.dDay}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.date} · {event.type}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}