"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  Building2, GraduationCap, BookOpen, MessageSquare,
  ChevronRight, Sparkles, ArrowRight,
  Loader2, Brain, AlertTriangle,
  BarChart3, Target, FileQuestion, ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { CATEGORY_STYLE, CATEGORY_LABELS, BOARD_PREVIEW_LIMIT } from "@/lib/constants"
import { mapToBroadCategory } from "@/lib/broad-categories"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"

// ── 타입 ──────────────────────────────────────────────────────────

interface DashboardData {
  user: { name: string; email: string; role: string }
  goal: { field: string; job_role: string; duration_weeks: number; has_curriculum: boolean } | null
  solve_stats?: { total: number; solved: number; correct_rate: number }
  top_languages?: { stat_key: string; correct_rate: number | null }[]
  weak_tags?: { stat_key: string; correct_rate: number | null; total_count: number }[]
  top_matches: { posting_title: string; company: string; match_score: number; status: string }[]
}

interface BoardPost {
  id: number
  title: string
  category: string
  author_name: string
  created_at: string
  view_count: number
}

interface BoardResponse {
  data?: BoardPost[]
  results?: BoardPost[]
  count?: number
}

interface QuizStats {
  total_attempts: number
  correct_count: number
  accuracy: number
  categories: {
    category: string
    attempts: number
    correct: number
    accuracy: number
  }[]
}

interface RecommendData {
  status: "no_recommend" | "has_recommend"
  zone?: string
  weights?: Record<string, number>
  weak_categories?: Record<string, number>
}

// ── 상수 ──────────────────────────────────────────────────────────

const ZONE_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  낮음:   { label: "기초 단계",   color: "text-rose-700",    bg: "bg-rose-100",    desc: "기초 개념 집중 학습을 권장합니다" },
  괜찮음: { label: "성장 단계",   color: "text-amber-700",   bg: "bg-amber-100",   desc: "취약 분야를 보완하면 좋겠습니다" },
  높음:   { label: "심화 단계",   color: "text-emerald-700", bg: "bg-emerald-100", desc: "심화 문제로 실력을 더 높여보세요" },
}

const categoryColors = CATEGORY_STYLE
const categoryLabels = CATEGORY_LABELS

// ── 컴포넌트 ──────────────────────────────────────────────────────

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([])
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null)
  const [recData, setRecData] = useState<RecommendData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [boardIdx, setBoardIdx] = useState(0)
  const boardTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [dash, board, qStats, rec] = await Promise.all([
          api.get<DashboardData>("/api/core/dashboard/"),
          api.get<BoardResponse | BoardPost[]>("/api/board/"),
          api.get<QuizStats>("/api/core/quiz/stats/").catch(() => null),
          api.get<RecommendData>("/api/core/quiz/recommend/").catch(() => null),
        ])
        setDashboard(dash)
        const posts = Array.isArray(board) ? board : ((board as BoardResponse).data ?? (board as BoardResponse).results ?? [])
        setBoardPosts(posts.slice(0, BOARD_PREVIEW_LIMIT))
        if (qStats && qStats.total_attempts > 0) setQuizStats(qStats)
        if (rec) setRecData(rec)
      } catch (err) {
        console.error("대시보드 데이터 로드 실패:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── 게시판 자동 슬라이드 ──────────────────────────────────────────
  const stopTimer = () => {
    if (boardTimerRef.current) {
      clearInterval(boardTimerRef.current)
      boardTimerRef.current = null
    }
  }
  const startTimer = (len: number) => {
    stopTimer() // 기존 interval 반드시 제거 후 새로 생성
    if (len <= 1) return
    boardTimerRef.current = setInterval(() => {
      setBoardIdx((prev) => (prev + 1) % len)
    }, 4000)
  }

  useEffect(() => {
    startTimer(boardPosts.length)
    return stopTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardPosts.length])

  const pauseTimer = () => stopTimer()
  const resumeTimer = () => startTimer(boardPosts.length)

  const goToSlide = (idx: number) => {
    setBoardIdx(idx)
    startTimer(boardPosts.length) // 수동 이동 시 타이머 리셋
  }

  // ── 취약 영역 계산 (ML 결과 → 퀴즈 통계 순서로 우선 적용) ──────
  const weakAreas = useMemo(() => {
    type RawArea = { category: string; accuracy: number | null; attempts: number; source: "ml" | "stats" }
    let raw: RawArea[] = []

    // 1순위: ML 진단 결과의 weak_categories
    if (recData?.status === "has_recommend" && recData.weak_categories) {
      raw = Object.entries(recData.weak_categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cat]) => {
          const stat = quizStats?.categories.find((c) => c.category === cat)
          return {
            category: cat,
            accuracy: stat ? Math.round(stat.accuracy) : null,
            attempts: stat?.attempts ?? 0,
            source: "ml" as const,
          }
        })
    } else if (quizStats && quizStats.categories.length > 0) {
      // 2순위: 퀴즈 통계에서 정답률 낮은 카테고리
      raw = quizStats.categories
        .filter((c) => c.attempts >= 1)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 10)
        .map((c) => ({
          category: c.category,
          accuracy: Math.round(c.accuracy),
          attempts: c.attempts,
          source: "stats" as const,
        }))
    }

    // 대분류로 변환 후 중복 제거 (첫 번째 등장 우선)
    const seen = new Set<string>()
    return raw
      .map((a) => ({ ...a, displayName: mapToBroadCategory(a.category) }))
      .filter(({ displayName }) => {
        if (seen.has(displayName)) return false
        seen.add(displayName)
        return true
      })
      .slice(0, 4)
  }, [recData, quizStats])

  // ── 카테고리별 차트 데이터 (대분류 집계) ─────────────────────────
  const categoryChartData = useMemo(() => {
    if (!quizStats || quizStats.categories.length === 0) return []
    const broadMap = new Map<string, { attempts: number; correct: number }>()
    for (const c of quizStats.categories) {
      const broad = mapToBroadCategory(c.category)
      const prev = broadMap.get(broad) ?? { attempts: 0, correct: 0 }
      broadMap.set(broad, { attempts: prev.attempts + c.attempts, correct: prev.correct + c.correct })
    }
    return Array.from(broadMap.entries())
      .filter(([, v]) => v.attempts > 0)
      .map(([name, v]) => ({
        name,
        accuracy: Math.round((v.correct / v.attempts) * 100),
        wrong: v.attempts - v.correct,
        attempts: v.attempts,
      }))
      .sort((a, b) => a.accuracy - b.accuracy) // 정답률 낮은 순
  }, [quizStats])

  const quizAccuracy = quizStats ? Math.round(quizStats.accuracy) : 0

  // ── 커리큘럼 성취도 레벨 ───────────────────────────────────────
  const LEVELS = [
    { key: "기초", label: "기초", desc: "기본 개념을 익히는 단계예요", next: "정답률 40% 이상이면 초급이 됩니다", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-300", min: 0 },
    { key: "초급", label: "초급", desc: "핵심 개념을 이해하고 있어요",   next: "정답률 60% 이상이면 중급이 됩니다", color: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-300", min: 40 },
    { key: "중급", label: "중급", desc: "실무 적용 수준에 다가가고 있어요", next: "정답률 75% 이상이면 고급이 됩니다", color: "text-amber-700", bg: "bg-amber-100", border: "border-amber-300", min: 60 },
    { key: "고급", label: "고급", desc: "심화 수준을 자신있게 풀고 있어요", next: "최고 수준에 도달했습니다!", color: "text-violet-700", bg: "bg-violet-100", border: "border-violet-300", min: 75 },
  ] as const

  const currentLevelIdx = quizStats
    ? quizAccuracy >= 75 ? 3 : quizAccuracy >= 60 ? 2 : quizAccuracy >= 40 ? 1 : 0
    : -1
  const currentLevel = currentLevelIdx >= 0 ? LEVELS[currentLevelIdx as 0 | 1 | 2 | 3] : null

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
  const topMatches = dashboard?.top_matches ?? []

  // 플랫폼 연동(백준 등) 기반 학습 통계 — /api/core/dashboard/
  const solveStats = dashboard?.solve_stats
  const topLanguages = dashboard?.top_languages ?? []
  const weakTags = dashboard?.weak_tags ?? []
  const hasPlatformStats =
    (solveStats?.total ?? 0) > 0 || topLanguages.length > 0 || weakTags.length > 0

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
                  ? `${goal.job_role} 목표 · ${quizStats ? `${quizStats.total_attempts}문제 풀이 완료` : "학습을 시작해보세요"}`
                  : "목표를 설정하고 AI 커리큘럼을 시작해보세요"}
              </p>
            </div>
            <Link href={goal?.has_curriculum ? "/study" : "/goal-setting"}>
              <Button variant="secondary" className="gap-2 font-semibold shadow-sm">
                <Sparkles className="h-4 w-4" />
                {goal?.has_curriculum ? "학습 이어하기" : "목표 설정하기"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 좌측: AI 추천 공고 + 취약 영역 */}
          <div className="lg:col-span-2 space-y-6">

            {/* AI 추천 기업 공고 */}
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

            {/* 보완이 필요한 학습 영역 */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  보완이 필요한 학습 영역
                </CardTitle>
                <Link href="/study">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    학습하러 가기 <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoryChartData.length === 0 ? (
                  /* 데이터 없음 */
                  <div className="text-center py-8 space-y-3">
                    <Brain className="h-10 w-10 mx-auto opacity-30 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">아직 분석할 데이터가 없습니다</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        공부 목록에서 문제를 풀면<br />
                        취약한 학습 영역을 자동으로 분석해드립니다
                      </p>
                    </div>
                    <Link href="/study">
                      <Button size="sm" className="gap-2 mt-1">
                        <Brain className="h-4 w-4" />
                        문제 풀러 가기
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* 요약 통계 */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "총 풀이", value: quizStats!.total_attempts },
                        { label: "정답",    value: quizStats!.correct_count },
                        { label: "정답률",  value: `${quizAccuracy}%` },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border bg-muted/30 p-2.5 text-center">
                          <p className="text-base font-bold text-primary">{s.value}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* 분야별 정답률 차트 */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          분야별 정답률
                        </p>
                        {recData?.status === "has_recommend" && (
                          <Badge variant="secondary" className="text-xs gap-1 font-normal py-0">
                            <Brain className="h-3 w-3" /> AI 분석
                          </Badge>
                        )}
                      </div>
                      <ResponsiveContainer width="100%" height={Math.max(categoryChartData.length * 34 + 16, 80)}>
                        <BarChart
                          layout="vertical"
                          data={categoryChartData}
                          margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
                        >
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={110}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null
                              const d = payload[0].payload
                              return (
                                <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1">
                                  <p className="font-semibold">{d.name}</p>
                                  <p>정답률 <span className="font-bold text-primary">{d.accuracy}%</span></p>
                                  <p>풀이 {d.attempts}문제 · 오답 <span className="text-rose-500 font-medium">{d.wrong}개</span></p>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} maxBarSize={18}>
                            {categoryChartData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={entry.accuracy < 50 ? "#ef4444" : entry.accuracy < 70 ? "#f59e0b" : "#10b981"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {/* 범례 */}
                      <div className="flex items-center gap-3 mt-1 justify-end">
                        {[
                          { color: "bg-rose-500",   label: "50% 미만" },
                          { color: "bg-amber-400",  label: "50-70%" },
                          { color: "bg-emerald-500",label: "70% 이상" },
                        ].map((l) => (
                          <span key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className={cn("inline-block w-2 h-2 rounded-sm", l.color)} />
                            {l.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 오답 많은 분야 */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        오답이 많은 분야
                      </p>
                      <div className="space-y-2">
                        {[...categoryChartData]
                          .sort((a, b) => b.wrong - a.wrong)
                          .slice(0, 3)
                          .map((area) => (
                            <Link href="/study" key={area.name}>
                              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                                <div className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                                  area.accuracy < 50 ? "bg-rose-100" : area.accuracy < 70 ? "bg-amber-100" : "bg-emerald-100"
                                )}>
                                  <AlertTriangle className={cn(
                                    "h-4 w-4",
                                    area.accuracy < 50 ? "text-rose-500" : area.accuracy < 70 ? "text-amber-500" : "text-emerald-600"
                                  )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{area.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {area.attempts}문제 중 <span className="text-rose-500 font-medium">{area.wrong}개 오답</span>
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className={cn(
                                    "text-sm font-bold",
                                    area.accuracy < 50 ? "text-rose-600" : area.accuracy < 70 ? "text-amber-600" : "text-emerald-600"
                                  )}>
                                    {area.accuracy}%
                                  </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                              </div>
                            </Link>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 우측: 커리큘럼 현황 + 게시판 */}
          <div className="space-y-6">

            {/* 커리큘럼 현황 — 성취도 레벨 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  커리큘럼 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 목표 직무 */}
                {goal && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
                    <Target className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">목표 직무</p>
                      <p className="text-sm font-semibold truncate">{goal.job_role}</p>
                    </div>
                  </div>
                )}

                {/* 레벨 스텝 인디케이터 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    학습 성취도
                  </p>
                  <div className="relative flex items-center justify-between">
                    {/* 연결선 */}
                    <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted mx-4" />
                    {LEVELS.map((lv, idx) => {
                      const isActive = idx === currentLevelIdx
                      const isPassed = currentLevelIdx > idx
                      return (
                        <div key={lv.key} className="relative flex flex-col items-center gap-1.5 z-10">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                            isActive
                              ? `${lv.bg} ${lv.border} ${lv.color}`
                              : isPassed
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-background border-muted text-muted-foreground"
                          )}>
                            {isPassed ? "✓" : idx + 1}
                          </div>
                          <span className={cn(
                            "text-[10px] font-medium",
                            isActive ? lv.color : isPassed ? "text-primary" : "text-muted-foreground"
                          )}>
                            {lv.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 현재 레벨 설명 */}
                {currentLevel ? (
                  <div className={cn("rounded-xl border-2 p-4", currentLevel.border, currentLevel.bg)}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("text-lg font-bold", currentLevel.color)}>
                        {currentLevel.label} 단계
                      </span>
                      <Badge className={cn("text-xs border-0", currentLevel.bg, currentLevel.color)}>
                        현재
                      </Badge>
                    </div>
                    <p className={cn("text-sm", currentLevel.color)}>{currentLevel.desc}</p>
                    {currentLevelIdx < LEVELS.length - 1 && (
                      <p className={cn("text-xs mt-1.5 opacity-70", currentLevel.color)}>
                        다음 단계 → {currentLevel.next}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">아직 학습을 시작하지 않았어요</p>
                    <p className="text-xs mt-1">문제를 풀면 성취도가 측정됩니다</p>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex flex-col gap-2">
                  <Link href="/study" className="block">
                    <Button className="w-full gap-2 text-sm">
                      <BookOpen className="h-4 w-4" />
                      {currentLevel ? "계속 학습하기" : "학습 시작하기"}
                    </Button>
                  </Link>
                  {goal?.has_curriculum && (
                    <Link href="/curriculum" className="block">
                      <Button variant="outline" className="w-full gap-2 text-sm">
                        커리큘럼 상세 보기
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 플랫폼 학습 통계 — 백준·GitHub 연동 데이터 (/api/core/dashboard/) */}
            {hasPlatformStats && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    플랫폼 학습 통계
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* 풀이 통계 */}
                  {solveStats && solveStats.total > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "총 시도", value: solveStats.total.toLocaleString("ko-KR") },
                        { label: "해결",    value: solveStats.solved.toLocaleString("ko-KR") },
                        { label: "정답률",  value: `${Math.round(solveStats.correct_rate)}%` },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border bg-muted/30 p-2.5 text-center">
                          <p className="text-base font-bold text-primary">{s.value}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 주력 언어 Top3 */}
                  {topLanguages.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        주력 언어
                      </p>
                      <div className="space-y-2">
                        {topLanguages.map((lang) => (
                          <div key={lang.stat_key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{lang.stat_key}</span>
                              <span className="text-muted-foreground">
                                정답률 {Math.round(lang.correct_rate ?? 0)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(lang.correct_rate ?? 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 취약 알고리즘 태그 Top3 */}
                  {weakTags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        취약 알고리즘 태그
                      </p>
                      <div className="space-y-2">
                        {weakTags.map((tag) => (
                          <div
                            key={tag.stat_key}
                            className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                              {tag.stat_key}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              <span className="font-semibold text-rose-500">
                                {Math.round(tag.correct_rate ?? 0)}%
                              </span>
                              {" · "}{tag.total_count}회 시도
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 게시판 — 자동 슬라이드 */}
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
              <CardContent>
                {boardPosts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>등록된 게시글이 없습니다.</p>
                  </div>
                ) : (
                  <div
                    onMouseEnter={pauseTimer}
                    onMouseLeave={resumeTimer}
                    className="space-y-3"
                  >
                    {/* 슬라이드 게시글 */}
                    <Link href={`/board/${boardPosts[boardIdx].id}`}>
                      <div className="rounded-xl border bg-muted/30 p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group min-h-[80px]">
                        <div className="flex items-start gap-2 mb-2">
                          <Badge
                            className={cn(
                              categoryColors[boardPosts[boardIdx].category] ?? "bg-gray-100 text-gray-700",
                              "text-xs flex-shrink-0 border-0"
                            )}
                          >
                            {categoryLabels[boardPosts[boardIdx].category] ?? boardPosts[boardIdx].category}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                          {boardPosts[boardIdx].title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(boardPosts[boardIdx].created_at).toLocaleDateString("ko-KR")}
                          {" · "}조회 {boardPosts[boardIdx].view_count?.toLocaleString()}
                        </p>
                      </div>
                    </Link>

                    {/* 네비게이션 */}
                    <div className="flex items-center justify-between">
                      {/* 이전/다음 버튼 */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => goToSlide((boardIdx - 1 + boardPosts.length) % boardPosts.length)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => goToSlide((boardIdx + 1) % boardPosts.length)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>

                      {/* 인디케이터 점 */}
                      <div className="flex items-center gap-1">
                        {boardPosts.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => goToSlide(i)}
                            className={cn(
                              "rounded-full transition-all",
                              i === boardIdx
                                ? "w-4 h-1.5 bg-primary"
                                : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                            )}
                          />
                        ))}
                      </div>

                      <span className="text-xs text-muted-foreground tabular-nums">
                        {boardIdx + 1}/{boardPosts.length}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
