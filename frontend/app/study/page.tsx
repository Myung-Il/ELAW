"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  BookOpen, ChevronRight, ChevronDown, Trophy, Clock,
  Code, GraduationCap, Loader2, BrainCircuit, Filter,
  CheckCircle2, ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"

// ── 타입 정의 ────────────────────────────────────────────────────

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

interface Problem {
  id: number
  original_question_id: number
  difficulty: string
  question_type: string
  category: string
  subcategory: string
  skills_required: string[]
  scenario: string
  question: string
  choices: string[]
  correct_answer: string
  explanation: string
}

interface ProblemsResponse {
  job_role: string
  total: number
  categories: string[]
  limit: number
  offset: number
  has_next: boolean
  data: Problem[]
}

// ── 상수 ─────────────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<string, string> = {
  university_level: "입문",
  junior_level:     "초급",
  middle_level:     "중급",
  senior_level:     "고급",
}

const DIFFICULTY_CLASS: Record<string, string> = {
  university_level: "bg-blue-100 text-blue-700 border-blue-200",
  junior_level:     "bg-green-100 text-green-700 border-green-200",
  middle_level:     "bg-amber-100 text-amber-700 border-amber-200",
  senior_level:     "bg-red-100 text-red-700 border-red-200",
}

const DIFFICULTY_OPTIONS = [
  { value: "",                 label: "전체" },
  { value: "university_level", label: "입문" },
  { value: "junior_level",     label: "초급" },
  { value: "middle_level",     label: "중급" },
  { value: "senior_level",     label: "고급" },
]

const PROBLEMS_LIMIT = 15

// ── 탭 타입 ──────────────────────────────────────────────────────

type Tab = "curriculum" | "problems"

// ── 문제 카드 ─────────────────────────────────────────────────────

function ProblemCard({ problem, isExpanded, onToggle, showAnswer }: {
  problem: Problem
  isExpanded: boolean
  onToggle: () => void
  showAnswer: boolean
}) {
  return (
    <Card className={cn(
      "overflow-hidden shadow-sm transition-all",
      isExpanded && "border-primary/40 ring-1 ring-primary/20"
    )}>
      <button type="button" className="w-full text-left" onClick={onToggle}>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
            <BrainCircuit className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {problem.category}
              </Badge>
              {problem.subcategory && problem.subcategory !== problem.category && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {problem.subcategory}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn("text-xs px-1.5 py-0 border", DIFFICULTY_CLASS[problem.difficulty])}
              >
                {DIFFICULTY_LABEL[problem.difficulty] ?? problem.difficulty}
              </Badge>
            </div>
            <p className="text-sm font-medium line-clamp-2">{problem.question}</p>
          </div>
          <div className="flex-shrink-0 mt-1">
            {isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </CardContent>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/20 px-4 pb-5 pt-4 space-y-4">
          {/* 시나리오 */}
          {problem.scenario && (
            <div className="rounded-lg bg-card border px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">상황</p>
              <p className="text-sm text-muted-foreground">{problem.scenario}</p>
            </div>
          )}

          {/* 질문 */}
          <div>
            <p className="text-sm font-semibold mb-3">{problem.question}</p>
            <div className="space-y-2">
              {problem.choices.map((choice, i) => {
                const isCorrect = choice === problem.correct_answer
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      showAnswer && isCorrect
                        ? "border-green-400 bg-green-50 text-green-800"
                        : "border-border bg-card"
                    )}
                  >
                    <span className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      showAnswer && isCorrect
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-muted-foreground/40 text-muted-foreground"
                    )}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{choice}</span>
                    {showAnswer && isCorrect && (
                      <CheckCircle2 className="ml-auto h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 해설 */}
          {showAnswer && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs font-semibold text-primary mb-1">해설</p>
              <p className="text-sm text-foreground">{problem.explanation}</p>
              {problem.skills_required?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {problem.skills_required.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs px-1.5 py-0">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────

export default function StudyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("curriculum")

  // 커리큘럼 탭 상태
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [weeks, setWeeks] = useState<CurriculumWeek[]>([])
  const [curriculumLoading, setCurriculumLoading] = useState(true)
  const [jobRole, setJobRole] = useState("")

  // 문제 탭 상태
  const [problems, setProblems] = useState<Problem[]>([])
  const [totalProblems, setTotalProblems] = useState(0)
  const [problemJobRole, setProblemJobRole] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedDifficulty, setSelectedDifficulty] = useState("")
  const [problemsOffset, setProblemsOffset] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [problemsLoading, setProblemsLoading] = useState(false)
  const [expandedProblem, setExpandedProblem] = useState<number | null>(null)
  const [showAnswerFor, setShowAnswerFor] = useState<Set<number>>(new Set())

  // ── 커리큘럼 로드 ─────────────────────────────
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
        console.error("커리큘럼 로드 실패:", err)
      } finally {
        setCurriculumLoading(false)
      }
    }
    load()
  }, [])

  // ── 문제 로드 ─────────────────────────────────
  const loadProblems = useCallback(async (offset: number, category: string, difficulty: string) => {
    setProblemsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PROBLEMS_LIMIT),
        offset: String(offset),
        ...(category && { category }),
        ...(difficulty && { difficulty }),
      })
      const res = await api.get<ProblemsResponse>(`/api/core/problems/?${params}`)
      setProblems(res.data ?? [])
      setTotalProblems(res.total ?? 0)
      setProblemJobRole(res.job_role ?? "")
      setCategories(res.categories ?? [])
      setHasNext(res.has_next ?? false)
      setExpandedProblem(null)
      setShowAnswerFor(new Set())
    } catch (err) {
      console.error("문제 로드 실패:", err)
    } finally {
      setProblemsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "problems") {
      loadProblems(problemsOffset, selectedCategory, selectedDifficulty)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const applyFilter = (category: string, difficulty: string) => {
    setSelectedCategory(category)
    setSelectedDifficulty(difficulty)
    setProblemsOffset(0)
    loadProblems(0, category, difficulty)
  }

  const goPage = (newOffset: number) => {
    setProblemsOffset(newOffset)
    loadProblems(newOffset, selectedCategory, selectedDifficulty)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const toggleShowAnswer = (id: number) => {
    setShowAnswerFor((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 공통 레이아웃 래퍼 ────────────────────────
  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">{children}</main>
    </div>
  )

  if (curriculumLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    )
  }

  const currentPage = Math.floor(problemsOffset / PROBLEMS_LIMIT) + 1
  const totalPages  = Math.ceil(totalProblems / PROBLEMS_LIMIT)

  return (
    <Layout>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">공부 목록</h1>
        <p className="text-sm text-muted-foreground">
          {jobRole || problemJobRole} · 커리큘럼 & 직무 문제 학습
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("curriculum")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "curriculum"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-4 w-4" />
          커리큘럼
          {weeks.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{weeks.length}주</Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("problems")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "problems"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BrainCircuit className="h-4 w-4" />
          직무 문제
          {totalProblems > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{totalProblems}</Badge>
          )}
        </button>
      </div>

      {/* ── 탭 1: 커리큘럼 ──────────────────────── */}
      {activeTab === "curriculum" && (
        <>
          {weeks.length === 0 ? (
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
          ) : (
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
          )}
        </>
      )}

      {/* ── 탭 2: 직무 문제 ─────────────────────── */}
      {activeTab === "problems" && (
        <div className="space-y-5">
          {/* 직무 & 총 문제 수 */}
          {problemJobRole && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge className="text-sm px-3 py-1">{problemJobRole}</Badge>
                <span className="text-sm text-muted-foreground">총 {totalProblems}문제</span>
              </div>
            </div>
          )}

          {/* 난이도 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {DIFFICULTY_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => applyFilter(selectedCategory, d.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  selectedDifficulty === d.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary hover:bg-primary/5"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* 카테고리 필터 (가로 스크롤) */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => applyFilter("", selectedDifficulty)}
                className={cn(
                  "flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all whitespace-nowrap",
                  selectedCategory === ""
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary hover:bg-primary/5"
                )}
              >
                전체 카테고리
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => applyFilter(cat, selectedDifficulty)}
                  className={cn(
                    "flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all whitespace-nowrap",
                    selectedCategory === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary hover:bg-primary/5"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* 문제 목록 */}
          {problemsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : problems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <BrainCircuit className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">해당 조건의 문제가 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {problems.map((p) => (
                <div key={p.id}>
                  <ProblemCard
                    problem={p}
                    isExpanded={expandedProblem === p.id}
                    onToggle={() => setExpandedProblem(expandedProblem === p.id ? null : p.id)}
                    showAnswer={showAnswerFor.has(p.id)}
                  />
                  {expandedProblem === p.id && (
                    <div className="flex justify-end mt-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => toggleShowAnswer(p.id)}
                        className={cn(
                          "text-xs font-medium rounded-full border px-3 py-1 transition-all",
                          showAnswerFor.has(p.id)
                            ? "border-green-400 bg-green-50 text-green-700"
                            : "border-border bg-card hover:border-primary text-muted-foreground"
                        )}
                      >
                        {showAnswerFor.has(p.id) ? "✓ 정답 확인 중" : "정답 보기"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={problemsOffset === 0 || problemsLoading}
                onClick={() => goPage(Math.max(0, problemsOffset - PROBLEMS_LIMIT))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages} 페이지
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || problemsLoading}
                onClick={() => goPage(problemsOffset + PROBLEMS_LIMIT)}
                className="gap-1"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
