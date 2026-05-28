"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  GraduationCap, Circle, Sparkles,
  TrendingUp, Trophy, Edit2, BarChart2, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"

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

export default function CurriculumPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [weeks, setWeeks] = useState<CurriculumWeek[]>([])
  const [goal, setGoal] = useState<Goal | null>(null)

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
      } catch (err) {
        console.error("커리큘럼 로드 실패:", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const totalProblems = weeks.reduce((s, w) => s + w.recommended_problems.length, 0)
  const totalHours    = weeks.reduce((s, w) => s + w.estimated_hours, 0)

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
              {goal.job_role} 목표 · {weeks.length}주 AI 맞춤 커리큘럼
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
          {/* ── 좌측: 주간 커리큘럼 목록 ────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {weeks.map((week) => (
              <Card key={week.week} className="shadow-sm transition-all hover:border-primary/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                      <Circle className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{week.week}주</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <h3 className="font-semibold">{week.theme}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {week.week}주차
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {week.tasks.map((task) => (
                          <span key={task} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            {task}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {week.recommended_problems.length}문제
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          예상 {week.estimated_hours}시간
                        </span>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                          수정
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── 우측: 통계 ────────────────────────────────── */}
          <div className="space-y-5">
            {/* AI 인사이트 카드 */}
            <Card className="bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-semibold">AI 학습 인사이트</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "전체 주차", value: `${weeks.length}주` },
                    { label: "목표 직무", value: goal.job_role },
                    { label: "추천 문제", value: `${totalProblems}문제` },
                    { label: "예상 시간", value: `${totalHours}시간` },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                      <p className="text-lg font-bold truncate">{stat.value}</p>
                      <p className="text-xs text-primary-foreground/70 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 전체 구성 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  커리큘럼 구성
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weeks.map((week) => (
                  <div key={week.week}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground truncate">{week.week}주 · {week.theme}</span>
                      <span className="font-medium text-primary ml-2 flex-shrink-0">{week.estimated_hours}h</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.min((week.estimated_hours / totalHours) * 100 * weeks.length, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
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
    </div>
  )
}
