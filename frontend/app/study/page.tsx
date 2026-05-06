"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import AppHeader from "@/components/layout/app-header"
import { api } from "@/lib/api"
import {
  Brain, BookOpen, CheckCircle2, XCircle, ChevronRight,
  Loader2, RefreshCw, Trophy, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Phase = "loading" | "idle" | "solving" | "result"

interface Problem {
  problem_id: number
  original_question_id: number
  job_role: string
  difficulty: string
  question_type: string
  category: string
  subcategory: string
  scenario: string
  question: string
  choices: string[]
  skills_required: string[]
  estimated_mastery_pct: number
  model: string
  reason: string
  rank: number
}

interface SolveResult {
  is_correct: boolean
  correct_answer: string
  explanation: string
  mastery_pct: number
  xp_gained: number
}

const DIFFICULTY_COLOR: Record<string, string> = {
  "대학 기초": "bg-blue-100 text-blue-700",
  "주니어":   "bg-green-100 text-green-700",
  "미들":     "bg-yellow-100 text-yellow-700",
  "시니어":   "bg-red-100 text-red-700",
}

export default function StudyPage() {
  const [phase, setPhase]             = useState<Phase>("loading")
  const [jobRole, setJobRole]         = useState("")
  const [problems, setProblems]       = useState<Problem[]>([])
  const [current, setCurrent]         = useState<Problem | null>(null)
  const [selected, setSelected]       = useState<string | null>(null)
  const [result, setResult]           = useState<SolveResult | null>(null)
  const [solvedCount, setSolvedCount] = useState(0)
  const [xpTotal, setXpTotal]         = useState(0)
  const [error, setError]             = useState("")
  const [submitting, setSubmitting]   = useState(false)
  const [solveStart, setSolveStart]   = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const dashRes = await api.getDashboard()
        if (!dashRes.ok) { setPhase("idle"); return }
        const dash = await dashRes.json()
        const role = dash?.goal?.job_role || ""
        setJobRole(role)
        if (!role) { setPhase("idle"); return }
        const recRes  = await api.getRecommendations(role, 10)
        if (!recRes.ok) { setPhase("idle"); return }
        const recData = await recRes.json()
        setProblems(recData.results || [])
      } catch { /* ignore */ } finally {
        setPhase("idle")
      }
    }
    load()
  }, [])

  const startProblem = (prob: Problem) => {
    setCurrent(prob)
    setSelected(null)
    setResult(null)
    setSolveStart(Date.now())
    setPhase("solving")
  }

  const handleSubmit = async () => {
    if (!selected || !current) return
    setSubmitting(true)
    setError("")
    try {
      const elapsed = Math.round((Date.now() - solveStart) / 1000)
      const res     = await api.solveProblem(current.problem_id, selected, elapsed)
      const data    = await res.json()
      if (!res.ok) throw new Error(data.error || "제출 실패")
      setResult(data)
      if (data.is_correct) {
        setSolvedCount(c => c + 1)
        setXpTotal(x => x + (data.xp_gained || 0))
      }
      setPhase("result")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    const idx  = problems.findIndex(p => p.problem_id === current?.problem_id)
    const next = problems[idx + 1]
    if (next) startProblem(next)
    else { setCurrent(null); setPhase("idle") }
  }

  const refreshProblems = async () => {
    if (!jobRole) return
    setPhase("loading")
    try {
      const res  = await api.getRecommendations(jobRole, 10)
      const data = await res.json()
      setProblems(data.results || [])
    } finally {
      setPhase("idle")
    }
  }

  // ── 로딩 ──
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">AI 추천 문제를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // ── 문제 풀기 ──
  if (phase === "solving" && current) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Badge variant="outline">{current.job_role}</Badge>
            <div className="flex gap-2">
              <Badge className={cn("border-0", DIFFICULTY_COLOR[current.difficulty] || "bg-gray-100 text-gray-700")}>
                {current.difficulty}
              </Badge>
              <Badge variant="secondary">{current.question_type}</Badge>
            </div>
          </div>
          <Card>
            <CardHeader>
              <p className="text-xs text-muted-foreground mb-1">{current.category} &gt; {current.subcategory}</p>
              {current.scenario && (
                <p className="text-sm text-muted-foreground bg-muted rounded p-3 mb-2">{current.scenario}</p>
              )}
              <CardTitle className="text-base leading-relaxed">{current.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {current.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(choice)}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 text-sm transition-all",
                    selected === choice
                      ? "border-primary bg-primary/5 font-medium"
                      : "hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <span className="mr-2 font-semibold text-primary">{i + 1}.</span>{choice}
                </button>
              ))}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setPhase("idle")} className="flex-1">목록으로</Button>
                <Button onClick={handleSubmit} disabled={!selected || submitting} className="flex-1">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}제출
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // ── 결과 ──
  if (phase === "result" && result && current) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              {result.is_correct
                ? <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
                : <XCircle className="h-14 w-14 text-destructive mx-auto" />}
              <div>
                <p className="text-xl font-bold mb-1">{result.is_correct ? "정답!" : "오답"}</p>
                <p className="text-sm text-muted-foreground">
                  정답: <span className="font-semibold text-foreground">{result.correct_answer}</span>
                </p>
              </div>
              {result.xp_gained > 0 && (
                <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold">
                  <Zap className="h-4 w-4" />+{result.xp_gained} XP
                </div>
              )}
              {result.explanation && (
                <div className="text-left bg-muted rounded-lg p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">해설</p>
                  <p className="text-sm">{result.explanation}</p>
                </div>
              )}
              <div className="text-left">
                <p className="text-xs text-muted-foreground mb-1">현재 숙련도</p>
                <Progress value={result.mastery_pct} className="h-2" />
                <p className="text-xs text-right mt-1 text-muted-foreground">{result.mastery_pct}%</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPhase("idle")} className="flex-1">목록으로</Button>
                <Button onClick={handleNext} className="flex-1">
                  다음 문제 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // ── 추천 목록 ──
  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />AI 추천 문제
            </h1>
            <p className="text-sm text-muted-foreground">
              {jobRole ? `${jobRole} · BKT/DKT 기반 약점 우선 추천` : "목표 설정 후 맞춤 문제가 추천됩니다"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span>오늘 {solvedCount}문제 · +{xpTotal} XP</span>
            </div>
            {jobRole && (
              <Button variant="outline" size="sm" onClick={refreshProblems} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" />새로 추천
              </Button>
            )}
          </div>
        </div>

        {!jobRole && (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold mb-1">목표 직무가 설정되지 않았습니다</p>
              <p className="text-sm text-muted-foreground mb-4">목표 설정 후 AI가 맞춤 문제를 추천합니다.</p>
              <Button onClick={() => window.location.href = '/goal-setting'}>목표 설정하기</Button>
            </CardContent>
          </Card>
        )}

        {jobRole && problems.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold mb-1">문제 데이터가 없습니다</p>
              <p className="text-sm text-muted-foreground">
                서버에서 <code>python manage.py load_problems</code> 실행 후 이용 가능합니다.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {problems.map((prob) => (
            <Card
              key={prob.problem_id}
              className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              onClick={() => startProblem(prob)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{prob.rank}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{prob.question}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{prob.category}</span><span>·</span>
                    <span>{prob.subcategory}</span><span>·</span>
                    <span className="text-primary font-medium">{prob.model}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{prob.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge className={cn("border-0 text-xs", DIFFICULTY_COLOR[prob.difficulty] || "bg-gray-100 text-gray-700")}>
                    {prob.difficulty}
                  </Badge>
                  <span className="text-xs text-muted-foreground">숙련도 {prob.estimated_mastery_pct}%</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
