"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  Building2, GraduationCap, BookOpen, MessageSquare,
  ChevronRight, TrendingUp, Sparkles, ArrowRight, Clock,
  Loader2,
} from "lucide-react"
import { api } from "@/lib/api-client"

interface DashboardData {
  user: { name: string; email: string; role: string }
  goal: { field: string; job_role: string; duration_weeks: number; has_curriculum: boolean } | null
  solve_stats: { total: number; solved: number; correct_rate: number }
  top_languages: { stat_key: string; correct_rate: number }[]
  weak_tags: { stat_key: string; correct_rate: number; total_count: number }[]
  top_matches: { posting_title: string; company: string; match_score: number; status: string }[]
  portfolio: { id: number; slug: string } | null
  platforms: { platform: string; external_id: string; last_synced: string | null }[]
}

interface BoardPost {
  id: number
  title: string
  category: string
  author_name: string
  created_at: string
  view_count: number
}

const categoryColors: Record<string, string> = {
  notice: "bg-blue-100 text-blue-700",
  event: "bg-orange-100 text-orange-700",
  qna: "bg-green-100 text-green-700",
}

const categoryLabels: Record<string, string> = {
  notice: "공지",
  event: "행사",
  qna: "QnA",
}

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [dash, board] = await Promise.all([
          api.get<DashboardData>("/api/core/dashboard/"),
          api.get<{ results: BoardPost[] } | BoardPost[]>("/api/board/"),
        ])
        setDashboard(dash)
        const posts = Array.isArray(board) ? board : board.results ?? []
        setBoardPosts(posts.slice(0, 4))
      } catch (err) {
        console.error("대시보드 데이터 로드 실패:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const user = dashboard?.user
  const goal = dashboard?.goal
  const solveStats = dashboard?.solve_stats
  const topMatches = dashboard?.top_matches ?? []
  const weakTags = dashboard?.weak_tags ?? []

  const progressPercent = solveStats && solveStats.total > 0
    ? Math.round((solveStats.solved / solveStats.total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        {/* 환영 배너 */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-primary px-8 py-8 text-primary-foreground shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-primary-foreground/70 font-medium mb-1">안녕하세요 👋</p>
              <h1 className="text-2xl font-bold">
                {user?.name ?? "사용자"}님, 오늘도 성장하는 하루 되세요!
              </h1>
              <p className="mt-2 text-primary-foreground/80 text-sm">
                {goal
                  ? `${goal.job_role} 목표 · 전체 ${progressPercent}% 완료`
                  : "목표를 설정하고 AI 커리큘럼을 시작해보세요"}
              </p>
            </div>
            <Link href={goal?.has_curriculum ? "/curriculum" : "/goal-setting"}>
              <Button variant="secondary" className="gap-2 font-semibold shadow-sm">
                <Sparkles className="h-4 w-4" />
                {goal?.has_curriculum ? "커리큘럼 이어하기" : "목표 설정하기"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 좌측: AI 추천 공고 + 취약 태그 */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI 추천 공고 */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  AI 추천 기업 공고
                </CardTitle>
                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    전체 보기 <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {topMatches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>추천 공고를 불러오는 중입니다.</p>
                    <Link href="/jobs" className="text-primary hover:underline mt-1 inline-block">
                      공고 둘러보기 →
                    </Link>
                  </div>
                ) : (
                  topMatches.map((job, idx) => (
                    <Link href="/jobs" key={idx}>
                      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                          {job.company.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{job.company}</p>
                          <p className="text-xs text-muted-foreground truncate">{job.posting_title}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-center hidden sm:block">
                            <p className="text-xs text-muted-foreground">매칭</p>
                            <p className="text-sm font-bold text-primary">{Math.round(job.match_score)}%</p>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">{job.status}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* 취약 영역 학습 추천 */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  보완이 필요한 학습 영역
                </CardTitle>
                <Link href="/study">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    전체 보기 <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {weakTags.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>플랫폼을 연동하면 취약 영역을 분석해드립니다.</p>
                    <Link href="/profile" className="text-primary hover:underline mt-1 inline-block">
                      플랫폼 연동하기 →
                    </Link>
                  </div>
                ) : (
                  weakTags.map((tag) => (
                    <Link href="/study" key={tag.stat_key}>
                      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 flex-shrink-0">
                          <BookOpen className="h-5 w-5 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{tag.stat_key}</p>
                          <p className="text-xs text-muted-foreground">총 {tag.total_count}문제</p>
                        </div>
                        <div className="text-right text-xs flex-shrink-0">
                          <p className="text-muted-foreground">정답률</p>
                          <p className={`font-bold ${tag.correct_rate < 50 ? "text-destructive" : "text-primary"}`}>
                            {Math.round(tag.correct_rate * 100)}%
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* 우측: 커리큘럼 현황 + 게시판 */}
          <div className="space-y-6">
            {/* 커리큘럼 현황 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  커리큘럼 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">전체 진행률</span>
                    <span className="font-semibold text-primary">{progressPercent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {solveStats?.solved ?? 0}/{solveStats?.total ?? 0} 문제 완료
                  </p>
                </div>

                {dashboard?.top_languages && dashboard.top_languages.length > 0 && (
                  <div className="space-y-3">
                    {dashboard.top_languages.map((lang) => (
                      <div key={lang.stat_key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{lang.stat_key}</span>
                          <span className="font-medium">{Math.round(lang.correct_rate * 100)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.round(lang.correct_rate * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 border p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-muted-foreground">
                      {solveStats && solveStats.correct_rate > 0
                        ? `정답률 ${solveStats.correct_rate}%`
                        : "아직 풀이 기록이 없습니다"}
                    </p>
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
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  게시판
                </CardTitle>
                <Link href="/board">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    전체 보기 <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {boardPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">게시글이 없습니다.</p>
                ) : (
                  boardPosts.map((post) => (
                    <Link href={`/board/${post.id}`} key={post.id}>
                      <div className="flex items-start gap-2.5 rounded-lg p-2.5 hover:bg-muted/50 transition-colors cursor-pointer group">
                        <Badge
                          className={`${categoryColors[post.category] ?? "bg-gray-100 text-gray-700"} text-xs flex-shrink-0 border-0 mt-0.5`}
                        >
                          {categoryLabels[post.category] ?? post.category}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {post.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(post.created_at).toLocaleDateString("ko-KR")} · 조회 {post.view_count?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
