"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  BookOpen, ChevronRight, ChevronDown, Trophy, Clock,
  Code, GraduationCap, Loader2,
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
  job_role: string
  curriculum_id: number | null
  has_curriculum: boolean
}

interface CurriculumRecord {
  id: number
  content_json: {
    total_weeks: number
    job_role: string
    weeks: CurriculumWeek[]
  }
}

export default function StudyPage() {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [weeks, setWeeks] = useState<CurriculumWeek[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [jobRole, setJobRole] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const goals = await api.get<Goal[]>("/api/core/goals/")
        const active = Array.isArray(goals) ? goals[0] : null
        if (!active?.curriculum_id) return

        setJobRole(active.job_role)
        const curricula = await api.get<CurriculumRecord[]>("/api/db/curricula/")
        const mine = Array.isArray(curricula)
          ? curricula.find((c) => c.id === active.curriculum_id)
          : null
        if (mine?.content_json?.weeks) {
          setWeeks(mine.content_json.weeks)
        }
      } catch (err) {
        console.error("공부 목록 로드 실패:", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
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

  if (weeks.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-2xl font-bold mb-6">공부 목록</h1>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <BookOpen className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">커리큘럼이 없습니다.</p>
              <p className="text-sm text-muted-foreground">목표를 설정하면 AI가 학습 주제를 생성합니다.</p>
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

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">공부 목록</h1>
          <p className="text-sm text-muted-foreground">
            {jobRole} 커리큘럼 · {weeks.length}주 학습 주제 · 클릭하면 상세 내용을 볼 수 있어요
          </p>
        </div>

        <div className="space-y-3">
          {weeks.map((week) => {
            const isExpanded = expandedWeek === week.week

            return (
              <Card key={week.week} className={cn(
                "shadow-sm overflow-hidden transition-all",
                isExpanded && "border-primary/50 ring-1 ring-primary/20"
              )}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{week.theme}</p>
                        <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1">
                          <GraduationCap className="h-2.5 w-2.5" />
                          {week.week}주차
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {week.recommended_problems.length}문제
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {week.estimated_hours}시간
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </CardContent>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-4 bg-muted/20">
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        학습 내용
                      </h4>
                      <ul className="space-y-1">
                        {week.tasks.map((task) => (
                          <li key={task} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {week.recommended_problems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          추천 문제 (백준)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {week.recommended_problems.map((pid) => (
                            <span
                              key={pid}
                              className="flex items-center gap-1 rounded-lg bg-card border px-3 py-1.5 text-sm"
                            >
                              <Code className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              {pid}번
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
