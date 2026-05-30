"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import AppHeader from "@/components/layout/app-header"
import {
  GraduationCap, CheckCircle2, Sparkles,
  TrendingUp, Trophy, Edit2, BarChart2, Loader2, BookOpen, Save,
  FileQuestion, Tag, Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { getTopicsForJobRole, studyTopics as allTopics } from "@/lib/study-topics"
import type { StudyTopic } from "@/lib/study-topics"
import { mapToBroadCategory, BROAD_CATEGORY_ORDER, BROAD_CATEGORY_COLORS, getWeekBroadCategories } from "@/lib/broad-categories"

interface CurriculumWeek {
  week: number
  theme: string
  tasks: string[]
  recommended_problems: string[]
  estimated_hours: number
}

interface Goal {
  id: number
  field: string
  job_role: string
  duration_weeks: number
  curriculum_id: number | null
  has_curriculum: boolean
}

interface CurriculumRecord {
  id: number
  user_id: number
  content_json: {
    total_weeks: number
    field: string
    job_role: string
    weeks: CurriculumWeek[]
  }
}

interface ELAWProblem {
  id: number
  category: string
  subcategory: string
}

function getWeekProblemCount(week: CurriculumWeek, problems: ELAWProblem[]): number {
  const broads = getWeekBroadCategories(week.theme, problems)
  if (broads.length === 0) return 0
  const broadSet = new Set(broads)
  return problems.filter((p) => broadSet.has(mapToBroadCategory(p.category))).length
}

const DIFFICULTY_COLOR: Record<string, string> = {
  "하": "bg-emerald-100 text-emerald-700",
  "중": "bg-amber-100 text-amber-700",
  "상": "bg-rose-100 text-rose-700",
}

export default function CurriculumPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [weeks, setWeeks] = useState<CurriculumWeek[]>([])
  const [goal, setGoal] = useState<Goal | null>(null)
  const [elawProblems, setElawProblems] = useState<ELAWProblem[]>([])

  // 주차 선택 상태
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set())

  // 수정 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTopics, setEditTopics] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")

  useEffect(() => {
    const load = async () => {
      try {
        const goals = await api.get<Goal[]>("/api/core/goals/")
        const active = Array.isArray(goals) ? goals[0] : null
        setGoal(active ?? null)

        if (!active?.curriculum_id) return

        const curricula = await api.get<CurriculumRecord[]>("/api/db/curricula/")
        const mine = Array.isArray(curricula)
          ? curricula.find((c) => c.id === active.curriculum_id)
          : null
        if (mine?.content_json?.weeks) {
          setWeeks(mine.content_json.weeks)
        }

        // ELAW 문제 로드 (주차별 관련 문제 수 계산용)
        try {
          const problems = await api.get<ELAWProblem[]>("/api/core/problems/?limit=2000")
          setElawProblems(Array.isArray(problems) ? problems : [])
        } catch {
          // 문제 로드 실패 시 무시 (카운트만 0으로 표시)
        }
      } catch (err) {
        console.error("커리큘럼 로드 실패:", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // 필터된 주차 (실제 문제가 있는 주차만)
  const displayWeeks = useMemo(
    () => weeks.filter(
      (w) => elawProblems.length > 0 && getWeekBroadCategories(w.theme, elawProblems).length > 0
    ),
    [weeks, elawProblems]
  )

  // 커리큘럼 전체 풀 수 있는 문제 수 (중복 제거)
  const totalCurriculumProblems = useMemo(() => {
    if (elawProblems.length === 0) return 0
    const seen = new Set<number>()
    for (const week of displayWeeks) {
      const broads = new Set(getWeekBroadCategories(week.theme, elawProblems))
      elawProblems
        .filter((p) => broads.has(mapToBroadCategory(p.category)))
        .forEach((p) => seen.add(p.id))
    }
    return seen.size
  }, [displayWeeks, elawProblems])

  // 커리큘럼이 커버하는 대분류 수
  const coveredBroads = useMemo(() => {
    const broads = new Set<string>()
    for (const week of displayWeeks) {
      getWeekBroadCategories(week.theme, elawProblems).forEach((b) => broads.add(b))
    }
    return broads.size
  }, [displayWeeks, elawProblems])

  // 주차별 문제 수 (bar chart용)
  const weekProblemCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const week of displayWeeks) {
      counts[week.week] = getWeekProblemCount(week, elawProblems)
    }
    return counts
  }, [displayWeeks, elawProblems])

  const maxWeekProblems = useMemo(
    () => Math.max(...Object.values(weekProblemCounts), 1),
    [weekProblemCounts]
  )

  const toggleWeek = (weekNum: number) => {
    setSelectedWeeks((prev) => {
      const next = new Set(prev)
      next.has(weekNum) ? next.delete(weekNum) : next.add(weekNum)
      return next
    })
  }

  const openEditDialog = () => {
    setEditTopics([])
    setDialogOpen(true)
  }

  const toggleEditTopic = (id: string) => {
    setEditTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  const applyEdit = async () => {
    if (editTopics.length === 0 || !goal?.curriculum_id) return
    const names = editTopics.map((id) => allTopics.find((t) => t.id === id)?.name ?? id)
    const newTheme = names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}개`
    const newTasks = names.flatMap((n) => [`${n} 개념 학습`, `${n} 실습`])

    const updatedWeeks = weeks.map((w) =>
      selectedWeeks.has(w.week) ? { ...w, theme: newTheme, tasks: newTasks } : w
    )

    setWeeks(updatedWeeks)
    setSelectedWeeks(new Set())
    setDialogOpen(false)

    setIsSaving(true)
    setSaveStatus("idle")
    try {
      await api.patch(`/api/core/curriculum/${goal.curriculum_id}/`, { weeks: updatedWeeks })
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (err) {
      console.error("커리큘럼 저장 실패:", err)
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  // 현재 직무에 맞는 토픽 (수정 다이얼로그용)
  const availableTopics: StudyTopic[] = goal?.job_role
    ? getTopicsForJobRole(goal.job_role)
    : allTopics
  const topicCategories = [...new Set(availableTopics.map((t) => t.category))]

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

  if (!goal || !goal.has_curriculum || weeks.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <main className="container mx-auto px-4 lg:px-8 py-8 max-w-6xl">
          <h1 className="text-2xl font-bold mb-6">커리큘럼 현황</h1>
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">아직 커리큘럼이 없습니다.</p>
              <p className="text-sm text-muted-foreground">목표를 설정하면 AI가 맞춤 커리큘럼을 생성합니다.</p>
              <Link href="/goal-setting">
                <Button className="mt-2">목표 설정하러 가기</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-6xl">
        {/* 페이지 헤더 */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">커리큘럼 현황</h1>
            <p className="text-sm text-muted-foreground">
              {goal.job_role} 목표 · {displayWeeks.length}주 AI 맞춤 커리큘럼
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 저장 상태 표시 */}
            {isSaving && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                저장 중...
              </span>
            )}
            {!isSaving && saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <Save className="h-3.5 w-3.5" />
                저장되었습니다
              </span>
            )}
            {!isSaving && saveStatus === "error" && (
              <span className="text-sm text-destructive">저장 실패 — 다시 시도해주세요</span>
            )}
            {selectedWeeks.size > 0 && saveStatus === "idle" && !isSaving && (
              <span className="text-sm text-muted-foreground">
                {selectedWeeks.size}개 주차 선택됨
              </span>
            )}
            <Button
              variant={selectedWeeks.size > 0 ? "default" : "outline"}
              className="gap-2"
              disabled={selectedWeeks.size === 0 || isSaving}
              onClick={openEditDialog}
            >
              <Edit2 className="h-4 w-4" />
              커리큘럼 수정
            </Button>
          </div>
        </div>

        {/* 주차 선택 안내 */}
        {selectedWeeks.size === 0 && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary/60 flex-shrink-0" />
            수정하고 싶은 주차 카드를 클릭해 선택한 후 <span className="font-medium text-foreground">커리큘럼 수정</span> 버튼을 눌러주세요.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── 좌측: 주간 커리큘럼 목록 ────────────────────── */}
          <div className="lg:col-span-2 space-y-3">
            {weeks
              .filter((week) => elawProblems.length === 0 || getWeekBroadCategories(week.theme, elawProblems).length > 0)
              .map((week, displayIdx) => {
              const displayNum = displayIdx + 1
              const isSelected = selectedWeeks.has(week.week)
              const weekCats = getWeekBroadCategories(week.theme, elawProblems)
              const problemCount = getWeekProblemCount(week, elawProblems)

              return (
                <Card
                  key={week.week}
                  onClick={() => toggleWeek(week.week)}
                  className={cn(
                    "cursor-pointer shadow-sm transition-all select-none",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-md"
                      : "hover:border-primary/50 hover:shadow-md"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* 주차 + 체크박스 */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30 text-muted-foreground"
                          )}
                        >
                          {isSelected
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <span className="text-xs font-semibold">{displayNum}</span>
                          }
                        </div>
                        <span className="text-xs text-muted-foreground">주차</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <h3 className={cn(
                            "font-semibold transition-colors",
                            isSelected && "text-primary"
                          )}>
                            {week.theme}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {displayNum}주차
                          </Badge>
                        </div>

                        {/* 대분류 카테고리 배지 */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {weekCats.map((cat: string) => (
                            <span
                              key={cat}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                BROAD_CATEGORY_COLORS[cat] ?? "border-border bg-muted text-muted-foreground"
                              )}
                            >
                              {cat}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className={cn(
                            "flex items-center gap-1 font-medium",
                            problemCount > 0 ? "text-primary" : "text-muted-foreground"
                          )}>
                            <Trophy className="h-3 w-3" />
                            {problemCount}문제
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            예상 {week.estimated_hours}시간
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* ── 우측: 통계 ────────────────────────────────── */}
          <div className="space-y-5">
            {/* AI 학습 인사이트 */}
            <Card className="bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-semibold">AI 학습 인사이트</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                    <p className="text-2xl font-bold">{displayWeeks.length}</p>
                    <p className="text-xs text-primary-foreground/70 mt-0.5">학습 주차</p>
                  </div>
                  <div className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                    <p className="text-lg font-bold truncate">{goal.job_role}</p>
                    <p className="text-xs text-primary-foreground/70 mt-0.5">목표 직무</p>
                  </div>
                  <div className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                    <p className="text-2xl font-bold">{totalCurriculumProblems.toLocaleString()}</p>
                    <p className="text-xs text-primary-foreground/70 mt-0.5">총 문제 수</p>
                  </div>
                  <div className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                    <p className="text-2xl font-bold">{coveredBroads}</p>
                    <p className="text-xs text-primary-foreground/70 mt-0.5">기술 분야 수</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 커리큘럼 구성 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  커리큘럼 구성
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayWeeks.map((week, chartIdx) => {
                  const cnt = weekProblemCounts[week.week] ?? 0
                  const barPct = Math.round((cnt / maxWeekProblems) * 100)
                  const broads = getWeekBroadCategories(week.theme, elawProblems)
                  const isSelected = selectedWeeks.has(week.week)
                  return (
                    <div key={week.week} className={cn(
                      "rounded-lg p-2.5 transition-colors",
                      isSelected ? "bg-primary/5 border border-primary/20" : ""
                    )}>
                      {/* 주차 + 문제 수 */}
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className={cn(
                          "font-medium truncate",
                          isSelected ? "text-primary" : "text-foreground"
                        )}>
                          {chartIdx + 1}주 · {week.theme}
                        </span>
                        <span className="flex items-center gap-0.5 text-muted-foreground ml-2 flex-shrink-0">
                          <FileQuestion className="h-3 w-3" />
                          {cnt}
                        </span>
                      </div>
                      {/* 문제 수 비례 바 */}
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted mb-1.5">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isSelected ? "bg-primary" : "bg-primary/50"
                          )}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      {/* 관련 대분류 태그 */}
                      {broads.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {broads.slice(0, 2).map((b) => (
                            <span
                              key={b}
                              className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground leading-none"
                            >
                              {b}
                            </span>
                          ))}
                          {broads.length > 2 && (
                            <span className="text-[10px] text-muted-foreground/60">
                              +{broads.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* 분야 커버리지 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  학습 분야 요약
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const broadMap: Record<string, number> = {}
                    for (const week of displayWeeks) {
                      const broads = getWeekBroadCategories(week.theme, elawProblems)
                      const broadSet = new Set(broads)
                      const cnt = elawProblems.filter(
                        (p) => broadSet.has(mapToBroadCategory(p.category))
                      ).length
                      for (const b of broads) {
                        broadMap[b] = Math.max(broadMap[b] ?? 0, cnt)
                      }
                    }
                    return Object.entries(broadMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([broad, cnt]) => (
                        <div
                          key={broad}
                          className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs"
                        >
                          <Tag className="h-2.5 w-2.5 text-primary/60 flex-shrink-0" />
                          <span className="font-medium">{broad}</span>
                          <span className="text-muted-foreground">{cnt.toLocaleString()}개</span>
                        </div>
                      ))
                  })()}
                </div>
              </CardContent>
            </Card>

            <Link href="/jobs">
              <Button variant="outline" className="w-full gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                취업 공고 보러가기
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* ── 커리큘럼 수정 다이얼로그 ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              커리큘럼 수정
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              선택한 {selectedWeeks.size}개 주차({[...selectedWeeks].sort((a,b)=>a-b).join(", ")}주차)에
              적용할 공부 분야를 선택해주세요.
            </p>
          </DialogHeader>

          {/* 직무 배지 */}
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">현재 직무 목표:</span>
            <Badge variant="secondary" className="text-xs font-medium">{goal.job_role}</Badge>
            <span className="text-xs text-muted-foreground ml-auto">관련 분야만 표시됩니다</span>
          </div>

          {/* 토픽 목록 (스크롤 영역) */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {topicCategories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableTopics
                    .filter((t) => t.category === category)
                    .map((topic) => {
                      const isSelected = editTopics.includes(topic.id)
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => toggleEditTopic(topic.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card hover:border-primary hover:bg-primary/5"
                          )}
                        >
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {topic.name}
                          <span
                            className={cn(
                              "rounded px-1.5 py-0 text-xs",
                              isSelected
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : DIFFICULTY_COLOR[topic.difficulty]
                            )}
                          >
                            {topic.difficulty}
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* 선택 요약 */}
          {editTopics.length > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
              <p className="text-xs font-medium text-primary mb-1.5">
                선택된 분야 ({editTopics.length}개)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {editTopics.map((id) => {
                  const t = allTopics.find((x) => x.id === id)
                  return (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {t?.name}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={applyEdit}
              disabled={editTopics.length === 0 || isSaving}
              className="gap-2"
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" />저장 중...</>
                : <><Sparkles className="h-4 w-4" />선택한 분야로 수정하기</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
