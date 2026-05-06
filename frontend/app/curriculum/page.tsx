"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  GraduationCap, CheckCircle2, Circle, Lock, Sparkles,
  TrendingUp, Users, Trophy, Edit2, BarChart2, Loader2, BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

interface WeekItem {
  week: number
  title: string
  status: "completed" | "in-progress" | "locked"
  topics: string[]
  problems: number
  hours: number
}

const statusConfig = {
  completed:   { icon: CheckCircle2, label: "완료",   className: "text-primary" },
  "in-progress": { icon: Circle,      label: "진행 중", className: "text-accent" },
  locked:      { icon: Lock,         label: "잠김",   className: "text-muted-foreground" },
}

export default function CurriculumPage() {
  const [isEditing, setIsEditing]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [weeks, setWeeks]           = useState<WeekItem[]>([])
  const [goalInfo, setGoalInfo]     = useState<{ job_role: string; field: string } | null>(null)
  const [solvedCount, setSolvedCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const [goalsRes, dashRes] = await Promise.all([api.getGoals(), api.getDashboard()])

        let solved = 0
        if (dashRes.ok) {
          const dash = await dashRes.json()
          solved = dash?.solve_stats?.solved || 0
          setSolvedCount(solved)
        }

        if (!goalsRes.ok) return
        const goals = await goalsRes.json()
        const active = goals[0]
        if (!active?.content_json?.weeks) return

        setGoalInfo({ job_role: active.job_role, field: active.field })

        // Estimate progress: every ~15 solved problems ≈ 1 completed week
        const completedWeeks = Math.min(Math.floor(solved / 15), active.content_json.weeks.length - 1)

        const mapped: WeekItem[] = active.content_json.weeks.map((w: any, i: number) => ({
          week:     w.week,
          title:    w.theme || w.title || `${w.week}주차`,
          status:   i < completedWeeks ? "completed" : i === completedWeeks ? "in-progress" : "locked",
          topics:   w.tasks || [],
          problems: (w.recommended_problems || []).length,
          hours:    w.estimated_hours || 0,
        }))
        setWeeks(mapped)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">커리큘럼을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (weeks.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <main className="container mx-auto px-4 py-16 max-w-lg text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold mb-2">커리큘럼이 없습니다</p>
          <p className="text-sm text-muted-foreground mb-6">목표를 설정하면 AI가 맞춤 커리큘럼을 생성합니다.</p>
          <Button onClick={() => window.location.href = '/goal-setting'}>목표 설정하기</Button>
        </main>
      </div>
    )
  }

  const completedWeeks   = weeks.filter(w => w.status === "completed").length
  const totalProblems    = weeks.reduce((s, w) => s + w.problems, 0)
  const solvedProblems   = weeks.filter(w => w.status === "completed").reduce((s, w) => s + w.problems, 0)
  const progressPercent  = Math.round((completedWeeks / weeks.length) * 100)

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-6xl">
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">커리큘럼 현황</h1>
            <p className="text-sm text-muted-foreground">
              {goalInfo ? `${goalInfo.job_role} · AI 맞춤 ${weeks.length}주 커리큘럼` : "AI가 생성한 맞춤형 학습 커리큘럼"}
            </p>
          </div>
          <Button
            variant={isEditing ? "default" : "outline"}
            className="gap-2"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit2 className="h-4 w-4" />
            {isEditing ? "수정 완료" : "커리큘럼 수정"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── 주간 커리큘럼 목록 ── */}
          <div className="lg:col-span-2 space-y-4">
            {weeks.map((week) => {
              const config = statusConfig[week.status]
              const Icon   = config.icon
              const isLocked = week.status === "locked"

              return (
                <Card
                  key={week.week}
                  className={cn(
                    "shadow-sm transition-all",
                    isLocked ? "opacity-60" : "hover:border-primary/50",
                    week.status === "in-progress" && "border-primary/50 ring-1 ring-primary/20"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                        <Icon className={cn("h-6 w-6", config.className)} />
                        <span className="text-xs text-muted-foreground font-medium">{week.week}주</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <h3 className={cn("font-semibold", isLocked ? "text-muted-foreground" : "text-foreground")}>
                            {week.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={week.status === "in-progress" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {config.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {week.topics.map((topic) => (
                            <span key={topic} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                              {topic}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {week.problems > 0 && (
                            <span className="flex items-center gap-1">
                              <Trophy className="h-3 w-3" />{week.problems}문제
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />예상 {week.hours}시간
                          </span>
                        </div>
                      </div>

                      {isEditing && !isLocked && (
                        <div className="flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">수정</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {isEditing && (
              <Card className="border-primary border-2 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">커리큘럼 수정이 완료되면 확정 버튼을 눌러주세요.</p>
                  <Button className="gap-2" onClick={() => setIsEditing(false)}>
                    <CheckCircle2 className="h-4 w-4" />커리큘럼 확정
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 우측 통계 ── */}
          <div className="space-y-5">
            <Card className="bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-semibold">AI 학습 인사이트</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "진행 주차",  value: `${completedWeeks + 1}주차` },
                    { label: "완료율",     value: `${progressPercent}%` },
                    { label: "해결 문제",  value: `${solvedProblems}/${totalProblems}` },
                    { label: "총 기간",    value: `${weeks.length}주` },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-primary-foreground/70 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />전체 진행률
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">완료</span>
                    <span className="font-bold text-primary">{progressPercent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedWeeks}/{weeks.length}주 완료 · {solvedProblems}/{totalProblems}문제 해결
                </p>
              </CardContent>
            </Card>

            <Link href="/jobs">
              <Button variant="outline" className="w-full gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />기업 기준으로 비교
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
