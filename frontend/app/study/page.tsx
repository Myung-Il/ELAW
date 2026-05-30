"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import AppHeader from "@/components/layout/app-header"
import {
  BookOpen, ChevronRight, ChevronDown, Clock,
  GraduationCap, Loader2, ListChecks, SlidersHorizontal,
  FileQuestion, CheckCircle2, Brain, BarChart3, RefreshCw,
  Check, X, AlertTriangle, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { BROAD_CATEGORY_ORDER, mapToBroadCategory, getWeekBroadCategories } from "@/lib/broad-categories"

// ── 타입 ──────────────────────────────────────────────────────

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
  content_json: { total_weeks: number; job_role: string; weeks: CurriculumWeek[] }
}

interface ELAWProblem {
  id: number
  question_id: number
  job_role: string
  category: string
  subcategory: string
  difficulty: string
  question_type: string
  skills_required: string[]
  question: string
  choices: string[]
}

interface QuizQuestion {
  question_id: number
  index: number
  total: number
  difficulty: string
  category: string
  subcategory: string
  question: string
  choices: string[]
}

interface SubmitResult {
  is_correct: boolean
  correct_answer: string
  explanation: string
  progress: {
    answered: number
    total: number
    correct: number
    accuracy: number
    is_completed: boolean
  }
}

interface MLRec {
  question_id: number
  category: string
  subcategory?: string
  difficulty: string
  question: string
  choices: string[]
  scores?: { GKT: number; SAKT: number; DKT: number; total: number }
}

interface RecommendData {
  status: "no_recommend" | "has_recommend"
  zone?: string
  weights?: Record<string, number>
  weak_categories?: Record<string, number>
  recommendations?: MLRec[]
}

interface StatsData {
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

// ── 상수 ──────────────────────────────────────────────────────

const DIFF_LABEL: Record<string, string> = {
  university_level: "기초",
  junior_level:     "신입",
  middle_level:     "중급",
  senior_level:     "고급",
}
const DIFF_COLOR: Record<string, string> = {
  university_level: "bg-blue-100 text-blue-700",
  junior_level:     "bg-emerald-100 text-emerald-700",
  middle_level:     "bg-amber-100 text-amber-700",
  senior_level:     "bg-rose-100 text-rose-700",
}
const DIFF_ORDER = ["university_level", "junior_level", "middle_level", "senior_level"]

const ZONE_CONFIG: Record<string, { color: string; bg: string; desc: string }> = {
  낮음:   { color: "text-rose-700",    bg: "bg-rose-100",    desc: "기초 개념 집중 학습을 권장합니다." },
  괜찮음: { color: "text-amber-700",   bg: "bg-amber-100",   desc: "취약 분야를 보완하면 좋겠습니다." },
  높음:   { color: "text-emerald-700", bg: "bg-emerald-100", desc: "심화 문제로 실력을 더 올려보세요." },
}


function pickWeekProblems(
  week: CurriculumWeek,
  problems: ELAWProblem[],
  excludeIds: Set<number>,
  count = 3,
): ELAWProblem[] {
  const broads = getWeekBroadCategories(week.theme, problems)
  if (broads.length === 0) return []
  const broadSet = new Set(broads)
  const pool = problems.filter(
    (p) => broadSet.has(mapToBroadCategory(p.category)) && !excludeIds.has(p.id)
  )
  if (pool.length === 0) return []
  const result: ELAWProblem[] = []
  const offset = week.week * count
  for (let i = 0; i < count; i++) {
    result.push(pool[(offset + i) % pool.length])
  }
  return result
}

type QuizSection = "checking" | "no_quiz" | "in_progress" | "has_recommend"

// ── 컴포넌트 ──────────────────────────────────────────────────

export default function StudyPage() {
  // 커리큘럼
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [weeks, setWeeks] = useState<CurriculumWeek[]>([])
  const [jobRole, setJobRole] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // ELAW 문제
  const [elawProblems, setElawProblems] = useState<ELAWProblem[]>([])

  // 전체 문제 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState("전체")
  const [filterDifficulty, setFilterDifficulty] = useState("전체")
  const [searchQuery, setSearchQuery] = useState("")

  // ── AI 진단 ──
  const [quizSection, setQuizSection] = useState<QuizSection>("checking")
  const [recData, setRecData] = useState<RecommendData | null>(null)

  // 퀴즈 다이얼로그
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<string>("")
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [recListOpen, setRecListOpen] = useState(false)

  // 학습 통계
  const [statsData, setStatsData] = useState<StatsData | null>(null)

  // 추천 문제 인라인 풀기
  const [activeRecIdx, setActiveRecIdx] = useState<number | null>(null)
  const [recChoice, setRecChoice] = useState<string>("")
  const [recSubmitting, setRecSubmitting] = useState(false)
  const [recFeedback, setRecFeedback] = useState<
    Record<number, { is_correct: boolean; correct_answer: string; explanation: string }>
  >({})
  const [isRerolling, setIsRerolling] = useState(false)
  const [pendingReroll, setPendingReroll] = useState<
    Record<number, { rec: MLRec; is_correct: boolean }>
  >({})

  // 주차별 추천 문제 풀기
  const [activeWeekProblem, setActiveWeekProblem] = useState<string | null>(null)
  const [weekChoice, setWeekChoice] = useState<Record<string, string>>({})
  const [weekSubmitting, setWeekSubmitting] = useState(false)
  const [weekFeedback, setWeekFeedback] = useState<
    Record<string, { is_correct: boolean; correct_answer: string; explanation: string }>
  >({})

  // 주차별 추천 문제 목록 (대분류 기반, reroll 지원)
  const [weekRecs, setWeekRecs] = useState<Record<number, ELAWProblem[]>>({})
  // 주차별 이미 노출된 문제 ID (reroll 시 중복 방지)
  const [weekUsedIds, setWeekUsedIds] = useState<Record<number, Set<number>>>({})
  // 주차 전용 문제 다이얼로그
  const [weekAllOpen, setWeekAllOpen] = useState(false)
  const [weekAllData, setWeekAllData] = useState<{ week: CurriculumWeek; displayNum: number; problems: ELAWProblem[] } | null>(null)
  const [weekAllDiff, setWeekAllDiff] = useState("전체")
  const [weekAllSearch, setWeekAllSearch] = useState("")

  // ── 통계 로드 ────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const data = await api.get<StatsData>("/api/core/quiz/stats/")
      if (data.total_attempts > 0) setStatsData(data)
    } catch { /* ignore */ }
  }

  // ── 데이터 로드 ──────────────────────────────────────────────

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const goals = await api.get<Goal[]>("/api/core/goals/")
        const active = Array.isArray(goals) ? goals[0] : null
        if (!active?.curriculum_id) return

        setJobRole(active.job_role)

        // 커리큘럼과 문제를 병렬로 가져와 isLoading=false 전에 모두 준비
        const [curriculaData, problemsData] = await Promise.all([
          api.get<CurriculumRecord[]>("/api/db/curricula/"),
          api.get<ELAWProblem[]>("/api/core/problems/?limit=2000").catch(() => [] as ELAWProblem[]),
        ])

        const mine = Array.isArray(curriculaData)
          ? curriculaData.find((c) => c.id === active.curriculum_id)
          : null
        if (mine?.content_json?.weeks) {
          setWeeks(mine.content_json.weeks)
        }

        setElawProblems(Array.isArray(problemsData) ? problemsData : [])
      } catch (err) {
        console.error("공부 목록 로드 실패:", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // 주차별 추천 문제 초기화 (문제·주차 둘 다 준비됐을 때)
  useEffect(() => {
    if (elawProblems.length === 0 || weeks.length === 0) return
    setWeekRecs((prev) => {
      const next: Record<number, ELAWProblem[]> = { ...prev }
      for (const week of weeks) {
        if (!next[week.week]) {
          next[week.week] = pickWeekProblems(week, elawProblems, new Set(), 3)
        }
      }
      return next
    })
  }, [elawProblems, weeks])

  // AI 진단 상태 체크
  useEffect(() => {
    const checkStatus = async () => {
      // 추천 결과가 있으면 바로 표시
      try {
        const rec = await api.get<RecommendData>("/api/core/quiz/recommend/")
        if (rec.status === "has_recommend") {
          setRecData(rec)
          setQuizSection("has_recommend")
          return
        }
      } catch { /* ML 미사용 가능 */ }

      // 진행 중인 퀴즈 세션 확인
      try {
        const prog = await api.get<{ has_session?: boolean }>("/api/core/quiz/progress/")
        setQuizSection(prog?.has_session === false ? "no_quiz" : "in_progress")
      } catch {
        setQuizSection("no_quiz")
      }
    }
    checkStatus()
  }, [])

  // ── 퀴즈 핸들러 ─────────────────────────────────────────────

  const startQuiz = async () => {
    setIsStarting(true)
    try {
      const data = await api.post<{
        job_role: string
        questions: QuizQuestion[]
        total: number
      }>("/api/core/quiz/start/", {})

      if (!data.questions?.length) {
        setQuizSection("no_quiz")
        return
      }
      setQuizQuestions(data.questions)
      setQuizIdx(0)
      setSelectedChoice("")
      setSubmitResult(null)
      setQuizCompleted(false)
      setQuizSection("in_progress")
      setQuizOpen(true)
    } catch {
      setQuizSection("no_quiz")
    } finally {
      setIsStarting(false)
    }
  }

  const continueQuiz = async () => {
    setIsStarting(true)
    try {
      const data = await api.get<{
        questions: QuizQuestion[]
        total: number
        progress: { answered: number; total: number; is_completed: boolean }
      }>("/api/core/quiz/questions/")

      setQuizQuestions(data.questions)
      setQuizIdx(data.progress.answered < data.total ? data.progress.answered : data.total - 1)
      setSelectedChoice("")
      setSubmitResult(null)
      setQuizCompleted(data.progress.is_completed)
      setQuizOpen(true)
    } catch {
      // 세션 만료 → 새로 시작
      await startQuiz()
    } finally {
      setIsStarting(false)
    }
  }

  const submitAnswer = async () => {
    if (!selectedChoice || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await api.post<SubmitResult>("/api/core/quiz/submit/", {
        index: quizIdx,
        answer: selectedChoice,
      })
      setSubmitResult(result)
      if (result.progress.is_completed) setQuizCompleted(true)
    } catch {
      /* ignore */
    } finally {
      setIsSubmitting(false)
    }
  }

  const goNextQuestion = () => {
    setQuizIdx((prev) => prev + 1)
    setSelectedChoice("")
    setSubmitResult(null)
  }

  const completeQuiz = async () => {
    setIsCompleting(true)
    try {
      const data = await api.post<{
        accuracy: number
        zone: string
        weights: Record<string, number>
        weak_categories: Record<string, number>
        recommendations: MLRec[]
      }>("/api/core/quiz/complete/", {})

      setRecData({
        status: "has_recommend",
        zone: data.zone,
        weights: data.weights,
        weak_categories: data.weak_categories,
        recommendations: data.recommendations,
      })
      setRecFeedback({})
      setActiveRecIdx(null)
      setQuizSection("has_recommend")
      setRecListOpen(true)
      setQuizOpen(false)
    } catch {
      /* ignore */
    } finally {
      setIsCompleting(false)
    }
  }

  // ── 추천 문제 풀기 ───────────────────────────────────────────

  const submitRecAnswer = async (recIdx: number, rec: MLRec) => {
    if (!recChoice || recSubmitting) return
    setRecSubmitting(true)
    try {
      const check = await api.post<{
        is_correct: boolean
        correct_answer: string
        explanation: string
      }>("/api/core/quiz/answer/", {
        question_id: rec.question_id,
        answer: recChoice,
      })

      setRecFeedback((prev) => ({
        ...prev,
        [recIdx]: {
          is_correct: check.is_correct,
          correct_answer: check.correct_answer,
          explanation: check.explanation,
        },
      }))
      setPendingReroll((prev) => ({ ...prev, [recIdx]: { rec, is_correct: check.is_correct } }))
      setActiveRecIdx(null)
      setRecChoice("")
    } catch {
      /* ignore */
    } finally {
      setRecSubmitting(false)
    }
  }

  const rerollProblem = async (recIdx: number) => {
    const pending = pendingReroll[recIdx]
    if (!pending || isRerolling) return
    setIsRerolling(true)
    try {
      const updated = await api.post<{ recommendations: MLRec[] }>(
        "/api/core/quiz/recommend/update/",
        {
          question_id: pending.rec.question_id,
          is_correct:  pending.is_correct,
          category:    pending.rec.category,
          subcategory: pending.rec.subcategory || "",
          top_n: 10,
        }
      )

      // 현재 표시 중인 다른 문제 ID 집합 (리롤 대상 제외)
      const currentRecs = recData?.recommendations ?? []
      const keptIds = new Set(
        currentRecs
          .filter((_, idx) => idx !== recIdx)
          .map((r) => r.question_id)
      )

      // 이미 표시 중이지 않은 첫 번째 추천 문제로 교체
      const replacement = updated.recommendations.find(
        (r) => !keptIds.has(r.question_id)
      )

      if (replacement) {
        setRecData((prev) => {
          if (!prev) return prev
          const next = [...(prev.recommendations ?? [])]
          next[recIdx] = replacement
          return { ...prev, recommendations: next }
        })
      }

      // 해당 인덱스 피드백만 제거, 나머지 유지
      setRecFeedback((prev) => { const n = { ...prev }; delete n[recIdx]; return n })
      setPendingReroll((prev) => { const n = { ...prev }; delete n[recIdx]; return n })
    } catch {
      /* ignore */
    } finally {
      setIsRerolling(false)
    }
  }

  const submitWeekAnswer = async (key: string, p: ELAWProblem) => {
    const choice = weekChoice[key]
    if (!choice || weekSubmitting) return
    setWeekSubmitting(true)
    try {
      const result = await api.post<{
        is_correct: boolean
        correct_answer: string
        explanation: string
      }>("/api/core/quiz/answer/", {
        question_id: p.question_id,
        answer: choice,
      })
      setWeekFeedback((prev) => ({ ...prev, [key]: result }))
      setActiveWeekProblem(null)
    } catch {
      /* ignore */
    } finally {
      setWeekSubmitting(false)
    }
  }

  // ── 전체 문제 다이얼로그 필터 ────────────────────────────────

  const categories = useMemo(() => {
    const broadCats = new Set(elawProblems.map((p) => mapToBroadCategory(p.category)))
    return ["전체", ...BROAD_CATEGORY_ORDER.filter((c) => broadCats.has(c))]
  }, [elawProblems])

  const filteredProblems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return elawProblems.filter((p) => {
      const broad = mapToBroadCategory(p.category)
      const catOk = filterCategory === "전체" || broad === filterCategory
      const diffOk = filterDifficulty === "전체" || p.difficulty === filterDifficulty
      const searchOk = !q ||
        p.question.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory?.toLowerCase().includes(q) ?? false) ||
        p.skills_required?.some((s) => s.toLowerCase().includes(q))
      return catOk && diffOk && searchOk
    })
  }, [elawProblems, filterCategory, filterDifficulty, searchQuery])

  // 대분류별 문제 수 (카테고리 필터 제외, 검색·난이도만 적용)
  const categoryStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return elawProblems.reduce((acc, p) => {
      const diffOk = filterDifficulty === "전체" || p.difficulty === filterDifficulty
      const searchOk = !q ||
        p.question.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory?.toLowerCase().includes(q) ?? false) ||
        p.skills_required?.some((s) => s.toLowerCase().includes(q))
      if (diffOk && searchOk) {
        const broad = mapToBroadCategory(p.category)
        acc[broad] = (acc[broad] ?? 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
  }, [elawProblems, filterDifficulty, searchQuery])

  // 대분류 → 원본 카테고리 그룹 (filteredProblems 기반)
  const groupedByCategory = useMemo(() => {
    if (filterCategory === "전체") {
      const broadMap: Record<string, Record<string, ELAWProblem[]>> = {}
      for (const p of filteredProblems) {
        const broad = mapToBroadCategory(p.category)
        if (!broadMap[broad]) broadMap[broad] = {}
        if (!broadMap[broad][p.category]) broadMap[broad][p.category] = []
        broadMap[broad][p.category].push(p)
      }
      return BROAD_CATEGORY_ORDER
        .filter((broad) => broad in broadMap)
        .map((broad) => ({
          category: broad,
          total: Object.values(broadMap[broad]).flat().length,
          subGroups: Object.entries(broadMap[broad])
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([sub, problems]) => ({ sub, problems })),
        }))
    } else {
      const origMap: Record<string, ELAWProblem[]> = {}
      for (const p of filteredProblems) {
        if (!origMap[p.category]) origMap[p.category] = []
        origMap[p.category].push(p)
      }
      return [{
        category: filterCategory,
        total: filteredProblems.length,
        subGroups: Object.entries(origMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([sub, problems]) => ({ sub, problems })),
      }]
    }
  }, [filteredProblems, filterCategory])

  const openDialog = () => {
    setFilterCategory("전체")
    setFilterDifficulty("전체")
    setSearchQuery("")
    setDialogOpen(true)
  }

  const openWeekProblemDialog = (week: CurriculumWeek, displayNum: number) => {
    const broads = getWeekBroadCategories(week.theme, elawProblems)
    const broadSet = new Set(broads)
    const weekProblems = elawProblems.filter((p) => broadSet.has(mapToBroadCategory(p.category)))
    setWeekAllData({ week, displayNum, problems: weekProblems })
    setWeekAllDiff("전체")
    setWeekAllSearch("")
    setWeekAllOpen(true)
  }

  const rerollWeekProblem = (weekNum: number, problemId: number, week: CurriculumWeek) => {
    setWeekRecs((prevRecs) => {
      setWeekUsedIds((prevUsed) => {
        const used = new Set(prevUsed[weekNum] ?? [])
        used.add(problemId)
        const current = prevRecs[weekNum] ?? []
        const allUsed = new Set([...current.map((p) => p.id), ...used])
        const replacement = pickWeekProblems(week, elawProblems, allUsed, 1)
        if (replacement.length === 0) return prevUsed
        const idx = current.findIndex((p) => p.id === problemId)
        if (idx === -1) return prevUsed
        const next = [...current]
        next[idx] = replacement[0]
        setWeekRecs({ ...prevRecs, [weekNum]: next })
        // 피드백·선택·활성 상태 초기화
        const oldKey = `${weekNum}-${problemId}`
        const newKey = `${weekNum}-${replacement[0].id}`
        setWeekFeedback((f) => { const n = { ...f }; delete n[oldKey]; return n })
        setWeekChoice((c) => { const n = { ...c }; delete n[oldKey]; n[newKey] = ""; return n })
        setActiveWeekProblem(null)
        return { ...prevUsed, [weekNum]: used }
      })
      return prevRecs
    })
  }

  // ── 로딩 / 빈 상태 ───────────────────────────────────────────

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

  // ── 렌더 ────────────────────────────────────────────────────

  const currentQ = quizQuestions[quizIdx]
  const weakCats = Object.entries(recData?.weak_categories ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat]) => cat)
  const zoneInfo = ZONE_CONFIG[recData?.zone ?? ""] ?? null

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">
        {/* ── 헤더 ─────────────────────────────────────── */}
        <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1">공부 목록</h1>
            <p className="text-sm text-muted-foreground">
              {jobRole} 커리큘럼 · {weeks.length}주 학습 주제
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={openDialog}
          >
            <ListChecks className="h-4 w-4" />
            전체 문제 보기
            {elawProblems.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {elawProblems.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* ── AI 진단 섹션 ──────────────────────────────── */}
        <div className="mb-6">
          {quizSection === "checking" && (
            <Card className="border-primary/20">
              <CardContent className="flex items-center gap-3 p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">AI 진단 상태 확인 중...</span>
              </CardContent>
            </Card>
          )}

          {quizSection === "no_quiz" && (
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">AI 진단 퀴즈</p>
                  <p className="text-sm text-muted-foreground">
                    10문제 진단으로 나에게 맞는 문제를 추천받으세요. (GKT · SAKT · DKT 앙상블)
                  </p>
                </div>
                <Button onClick={startQuiz} disabled={isStarting} className="flex-shrink-0">
                  {isStarting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />로딩 중</>
                    : "퀴즈 시작"
                  }
                </Button>
              </CardContent>
            </Card>
          )}

          {quizSection === "in_progress" && (
            <Card className="border-amber-300/60 bg-amber-50/50">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 flex-shrink-0">
                  <Brain className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">진단 퀴즈 진행 중</p>
                  <p className="text-sm text-amber-700/80">이전에 시작한 퀴즈가 있습니다.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    className="border-amber-300 hover:bg-amber-100"
                    onClick={continueQuiz}
                    disabled={isStarting}
                  >
                    {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : "계속하기"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={startQuiz}
                    disabled={isStarting}
                  >
                    새로 시작
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {quizSection === "has_recommend" && recData && (
            <Card className="border-primary/20">
              <CardContent className="p-5">
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold">AI 맞춤 추천 문제</span>
                  {recData.zone && zoneInfo && (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", zoneInfo.bg, zoneInfo.color)}>
                      수준: {recData.zone}
                    </span>
                  )}
                  {recData.zone && zoneInfo && (
                    <span className="text-xs text-muted-foreground">{zoneInfo.desc}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto gap-1 text-xs text-muted-foreground"
                    onClick={startQuiz}
                    disabled={isStarting}
                  >
                    <RefreshCw className="h-3 w-3" />
                    재진단
                  </Button>
                </div>

                {/* 취약 카테고리 */}
                {weakCats.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">취약 분야</span>
                    {weakCats.map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="text-xs border-amber-200 bg-amber-50 text-amber-700"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* 모델 가중치 */}
                {recData.weights && (
                  <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground flex-wrap">
                    <BarChart3 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>모델 가중치</span>
                    {Object.entries(recData.weights).map(([model, w]) => (
                      <span key={model} className="font-mono">
                        {model} {Math.round(w * 100)}%
                      </span>
                    ))}
                  </div>
                )}

                {/* 추천 문제 토글 버튼 */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => setRecListOpen((v) => !v)}
                >
                  <span className="font-medium">
                    추천 문제 {recData.recommendations?.length ?? 0}개
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    recListOpen && "rotate-180"
                  )} />
                </button>

                {/* 추천 문제 목록 */}
                {recListOpen && (recData.recommendations && recData.recommendations.length > 0 ? (
                  <div className="space-y-2">
                    {recData.recommendations.map((rec, i) => {
                      const isActive = activeRecIdx === i
                      const feedback = recFeedback[i]

                      return (
                        <div
                          key={`rec-${rec.question_id}`}
                          className={cn(
                            "rounded-lg border transition-all",
                            isActive ? "border-primary/40 bg-primary/5" : "bg-card"
                          )}
                        >
                          {/* 문제 헤더 */}
                          <div className="flex items-start gap-3 px-4 py-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-primary">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <span className="text-xs font-medium text-muted-foreground">{mapToBroadCategory(rec.category)}</span>
                                <span className={cn(
                                  "rounded px-1.5 py-0 text-xs font-medium",
                                  DIFF_COLOR[rec.difficulty]
                                )}>
                                  {DIFF_LABEL[rec.difficulty] ?? rec.difficulty}
                                </span>
                                {rec.scores && (
                                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                                    점수 {(rec.scores.total * 100).toFixed(0)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-foreground/80 line-clamp-2">{rec.question}</p>
                            </div>
                            {!feedback && (
                              <Button
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                className="flex-shrink-0 h-7 text-xs"
                                onClick={() => {
                                  if (isActive) {
                                    setActiveRecIdx(null)
                                    setRecChoice("")
                                  } else {
                                    setActiveRecIdx(i)
                                    setRecChoice("")
                                  }
                                }}
                              >
                                {isActive ? "닫기" : "풀기"}
                              </Button>
                            )}
                            {feedback && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className={cn(
                                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
                                  feedback.is_correct
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                )}>
                                  {feedback.is_correct
                                    ? <><Check className="h-3 w-3" />정답</>
                                    : <><X className="h-3 w-3" />오답</>
                                  }
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => rerollProblem(i)}
                                  disabled={isRerolling}
                                >
                                  {isRerolling
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <RefreshCw className="h-3 w-3" />
                                  }
                                  다른 문제
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* 선택지 (펼쳐진 상태) */}
                          {isActive && !feedback && (
                            <div className="px-4 pb-4 border-t pt-3 space-y-2">
                              {rec.choices.map((choice) => (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => setRecChoice(choice)}
                                  className={cn(
                                    "w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all",
                                    recChoice === choice
                                      ? "border-primary bg-primary/10 font-medium"
                                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                                  )}
                                >
                                  {choice}
                                </button>
                              ))}
                              <Button
                                className="w-full mt-1"
                                disabled={!recChoice || recSubmitting}
                                onClick={() => submitRecAnswer(i, rec)}
                              >
                                {recSubmitting
                                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />제출 중...</>
                                  : "제출"
                                }
                              </Button>
                            </div>
                          )}

                          {/* 피드백 — 정답/오답 모두 해설 표시 */}
                          {feedback && (feedback.explanation || !feedback.is_correct) && (
                            <div className="px-4 pb-3 border-t pt-2.5 space-y-1">
                              {!feedback.is_correct && (
                                <p className="text-xs text-muted-foreground">
                                  정답: <span className="font-medium text-foreground">{feedback.correct_answer}</span>
                                </p>
                              )}
                              {feedback.explanation && (
                                <p className="text-xs text-muted-foreground">{feedback.explanation}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    추천 문제가 없습니다.
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 주차 아코디언 목록 ────────────────────────── */}
        <div className="space-y-3">
          {weeks
            .filter((week) => elawProblems.length > 0 && getWeekBroadCategories(week.theme, elawProblems).length > 0)
            .map((week, displayIdx) => {
            const displayNum = displayIdx + 1
            const isExpanded = expandedWeek === week.week
            const recommended = weekRecs[week.week] ?? []

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
                          {displayNum}주차
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileQuestion className="h-3 w-3" />
                          추천 문제 {recommended.length}개
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
                  <div className="border-t px-4 pb-5 pt-4 bg-muted/20 space-y-5">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        학습 내용
                      </h4>
                      <ul className="space-y-1.5">
                        {week.tasks.map((task) => (
                          <li key={task} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary/50 flex-shrink-0" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          ELAW 추천 문제
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 text-primary hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); openWeekProblemDialog(week, displayNum) }}
                        >
                          <ListChecks className="h-3 w-3" />
                          전체 문제 보기
                        </Button>
                      </div>

                      {recommended.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          문제 데이터가 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {recommended.map((p) => {
                            const wkey = `${week.week}-${p.id}`
                            const wActive = activeWeekProblem === wkey
                            const wFeedback = weekFeedback[wkey]
                            return (
                              <div
                                key={wkey}
                                className={cn(
                                  "rounded-lg border transition-all",
                                  wActive ? "border-primary/40 bg-primary/5" : "bg-card"
                                )}
                              >
                                {/* 문제 헤더 */}
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-primary">Q{p.question_id}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span className="text-xs font-medium text-muted-foreground">{p.category}</span>
                                      {p.subcategory && (
                                        <span className="text-xs text-muted-foreground/60">· {p.subcategory}</span>
                                      )}
                                      <span className={cn(
                                        "rounded px-1.5 py-0 text-xs font-medium",
                                        DIFF_COLOR[p.difficulty]
                                      )}>
                                        {DIFF_LABEL[p.difficulty] ?? p.difficulty}
                                      </span>
                                    </div>
                                    <p className="text-sm line-clamp-2 text-foreground/80">{p.question}</p>
                                  </div>
                                  {/* 풀기 / 닫기 / 결과 뱃지 + 리롤 */}
                                  {!wFeedback ? (
                                    <Button
                                      variant={wActive ? "default" : "outline"}
                                      size="sm"
                                      className="flex-shrink-0 h-7 text-xs"
                                      onClick={() => {
                                        if (wActive) {
                                          setActiveWeekProblem(null)
                                        } else {
                                          setActiveWeekProblem(wkey)
                                          setWeekChoice((prev) => ({ ...prev, [wkey]: "" }))
                                        }
                                      }}
                                    >
                                      {wActive ? "닫기" : "풀기"}
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <div className={cn(
                                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
                                        wFeedback.is_correct
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-rose-100 text-rose-700"
                                      )}>
                                        {wFeedback.is_correct
                                          ? <><Check className="h-3 w-3" />정답</>
                                          : <><X className="h-3 w-3" />오답</>
                                        }
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => rerollWeekProblem(week.week, p.id, week)}
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                        다른 문제
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* 선택지 */}
                                {wActive && !wFeedback && (
                                  <div className="px-3 pb-3 border-t pt-3 space-y-2">
                                    {p.choices.map((choice) => (
                                      <button
                                        key={choice}
                                        type="button"
                                        onClick={() => setWeekChoice((prev) => ({ ...prev, [wkey]: choice }))}
                                        className={cn(
                                          "w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all",
                                          weekChoice[wkey] === choice
                                            ? "border-primary bg-primary/10 font-medium"
                                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                                        )}
                                      >
                                        {choice}
                                      </button>
                                    ))}
                                    <Button
                                      className="w-full mt-1"
                                      disabled={!weekChoice[wkey] || weekSubmitting}
                                      onClick={() => submitWeekAnswer(wkey, p)}
                                    >
                                      {weekSubmitting
                                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />제출 중...</>
                                        : "제출"
                                      }
                                    </Button>
                                  </div>
                                )}

                                {/* 피드백 */}
                                {wFeedback && (wFeedback.explanation || !wFeedback.is_correct) && (
                                  <div className="px-3 pb-3 border-t pt-2.5 space-y-1">
                                    {!wFeedback.is_correct && (
                                      <p className="text-xs text-muted-foreground">
                                        정답: <span className="font-medium text-foreground">{wFeedback.correct_answer}</span>
                                      </p>
                                    )}
                                    {wFeedback.explanation && (
                                      <p className="text-xs text-muted-foreground">{wFeedback.explanation}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </main>

      {/* ── 퀴즈 다이얼로그 ──────────────────────────────── */}
      <Dialog open={quizOpen} onOpenChange={(v) => { if (!v && !isSubmitting && !isCompleting) setQuizOpen(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI 진단 퀴즈
            </DialogTitle>
          </DialogHeader>

          {quizQuestions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quizCompleted && !submitResult ? (
            // 모든 문제 완료 — complete 버튼
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">진단 완료!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {quizQuestions.length}문제를 모두 풀었습니다. 결과를 분석합니다.
                </p>
              </div>
              <Button onClick={completeQuiz} disabled={isCompleting} className="w-full">
                {isCompleting
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />분석 중...</>
                  : "결과 보기 & 추천 받기"
                }
              </Button>
            </div>
          ) : currentQ ? (
            <div className="space-y-4">
              {/* 진행 바 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>문제 {quizIdx + 1} / {quizQuestions.length}</span>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 font-medium",
                    DIFF_COLOR[currentQ.difficulty]
                  )}>
                    {DIFF_LABEL[currentQ.difficulty] ?? currentQ.difficulty}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${((quizIdx) / quizQuestions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* 카테고리 */}
              <p className="text-xs text-muted-foreground">
                {mapToBroadCategory(currentQ.category)}
              </p>

              {/* 문제 */}
              <p className="text-sm font-medium leading-relaxed">{currentQ.question}</p>

              {/* 선택지 */}
              {!submitResult ? (
                <div className="space-y-2">
                  {currentQ.choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSelectedChoice(choice)}
                      disabled={isSubmitting}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all",
                        selectedChoice === choice
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                      )}
                    >
                      {choice}
                    </button>
                  ))}
                  <Button
                    className="w-full"
                    onClick={submitAnswer}
                    disabled={!selectedChoice || isSubmitting}
                  >
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />채점 중...</>
                      : "제출"
                    }
                  </Button>
                </div>
              ) : (
                // 채점 결과
                <div className="space-y-3">
                  {/* 선택지 — 정답/오답 표시 */}
                  <div className="space-y-2">
                    {currentQ.choices.map((choice) => {
                      const isSelected = choice === selectedChoice
                      const isCorrect = choice === submitResult.correct_answer
                      return (
                        <div
                          key={choice}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                            isCorrect
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : isSelected
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : "border-border bg-card text-muted-foreground"
                          )}
                        >
                          {isCorrect
                            ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                            : isSelected
                            ? <X className="h-3.5 w-3.5 flex-shrink-0 text-rose-500" />
                            : <span className="h-3.5 w-3.5 flex-shrink-0" />
                          }
                          {choice}
                        </div>
                      )
                    })}
                  </div>

                  {/* 결과 배너 */}
                  <div className={cn(
                    "rounded-lg p-3 text-sm",
                    submitResult.is_correct
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  )}>
                    <p className="font-semibold mb-0.5">
                      {submitResult.is_correct ? "정답입니다!" : "오답입니다."}
                    </p>
                    {submitResult.explanation && (
                      <p className="text-xs opacity-80">{submitResult.explanation}</p>
                    )}
                  </div>

                  {/* 다음 / 완료 버튼 */}
                  {quizCompleted ? (
                    <Button onClick={completeQuiz} disabled={isCompleting} className="w-full">
                      {isCompleting
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />분석 중...</>
                        : "결과 보기 & 추천 받기"
                      }
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={goNextQuestion}
                    >
                      다음 문제
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── 전체 문제 다이얼로그 ─────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">

          {/* 헤더 & 필터 */}
          <div className="px-5 pt-5 pb-3 border-b shrink-0 space-y-2.5 pr-12">
            <DialogTitle className="sr-only">직무별 문제 목록</DialogTitle>

            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                className="w-full h-8 pl-8 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                placeholder="문제 내용, 카테고리, 스킬 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 난이도 필터 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">난이도</span>
              {["전체", ...DIFF_ORDER].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFilterDifficulty(d)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                    filterDifficulty === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  {d === "전체" ? "전체" : DIFF_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 사이드바 + 문제 목록 */}
          <div className="flex flex-1 min-h-0">

            {/* 카테고리 사이드바 */}
            <nav className="w-44 border-r shrink-0 overflow-y-auto py-1.5 bg-muted/20">
              <button
                type="button"
                onClick={() => setFilterCategory("전체")}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors",
                  filterCategory === "전체"
                    ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                    : "hover:bg-muted/60 text-foreground"
                )}
              >
                <span>전체</span>
                <span className={cn(
                  "text-xs tabular-nums shrink-0",
                  filterCategory === "전체" ? "text-primary font-semibold" : "text-muted-foreground"
                )}>
                  {filteredProblems.length}
                </span>
              </button>

              <div className="my-1.5 mx-3 border-t" />

              {categories
                .filter((c) => c !== "전체")
                .map((cat) => {
                  const count = categoryStats[cat] ?? 0
                  const isActive = filterCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => count > 0 && setFilterCategory(cat)}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-2 transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                          : count === 0
                          ? "opacity-35 cursor-default"
                          : "hover:bg-muted/60 text-foreground"
                      )}
                    >
                      <span className="truncate leading-snug">{cat}</span>
                      <span className={cn(
                        "text-xs tabular-nums shrink-0 rounded-full px-1.5 py-0.5 min-w-[1.5rem] text-center",
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    </button>
                  )
                })}
            </nav>

            {/* 문제 목록 */}
            <div className="flex-1 overflow-y-auto">
              {filteredProblems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <FileQuestion className="h-10 w-10 opacity-30" />
                  <p className="text-sm">해당 조건의 문제가 없습니다.</p>
                  {(searchQuery || filterDifficulty !== "전체") && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => { setSearchQuery(""); setFilterDifficulty("전체") }}
                    >
                      필터 초기화
                    </button>
                  )}
                </div>
              ) : filterCategory === "전체" ? (
                /* 전체 보기: 카테고리 → 서브카테고리 그룹 */
                <div className="p-4 space-y-6">
                  {groupedByCategory.map(({ category, total, subGroups }) => (
                    <div key={category}>
                      {/* 카테고리 헤더 */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">
                            {category}
                          </span>
                          <Badge variant="outline" className="text-xs font-normal h-4 px-1.5">
                            {total}개
                          </Badge>
                        </div>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      {/* 원본 카테고리별 문제 */}
                      <div className="space-y-3">
                        {subGroups.map(({ sub, problems }) => (
                          <div key={sub}>
                            <p className="text-xs font-semibold text-muted-foreground mb-1.5 pl-0.5 flex items-center gap-1">
                              <span className="inline-block w-1 h-1 rounded-full bg-primary/50" />
                              {sub}
                              <span className="font-normal text-muted-foreground/60">({problems.length})</span>
                            </p>
                            <div className="space-y-1.5">
                              {problems.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
                                >
                                  <div className="flex h-7 w-10 items-center justify-center rounded-md bg-primary/10 flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-primary">Q{p.question_id}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className={cn(
                                        "rounded px-1.5 py-0 text-xs font-medium ml-auto shrink-0",
                                        DIFF_COLOR[p.difficulty]
                                      )}>
                                        {DIFF_LABEL[p.difficulty] ?? p.difficulty}
                                      </span>
                                    </div>
                                    <p className="text-sm line-clamp-2 text-foreground/80">{p.question}</p>
                                    {p.skills_required?.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {p.skills_required.slice(0, 3).map((s) => (
                                          <span key={s} className="rounded bg-muted px-1.5 py-0 text-xs text-muted-foreground">
                                            {s}
                                          </span>
                                        ))}
                                        {p.skills_required.length > 3 && (
                                          <span className="text-xs text-muted-foreground">
                                            +{p.skills_required.length - 3}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 특정 카테고리: 서브카테고리별 그룹 */
                <div className="p-4 space-y-4">
                  {/* 카테고리 제목 */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{filterCategory}</h3>
                    <Badge variant="secondary" className="font-normal text-xs">
                      {filteredProblems.length}개
                    </Badge>
                  </div>

                  {groupedByCategory[0]?.subGroups.map(({ sub, problems }) => (
                    <div key={sub}>
                      {/* 원본 카테고리 헤더 */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {sub}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {problems.length}개
                        </span>
                        <div className="h-px flex-1 bg-border/60" />
                      </div>

                      <div className="space-y-1.5">
                        {problems.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
                          >
                            <div className="flex h-7 w-10 items-center justify-center rounded-md bg-primary/10 flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-primary">Q{p.question_id}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center mb-0.5">
                                <span className={cn(
                                  "rounded px-1.5 py-0 text-xs font-medium ml-auto shrink-0",
                                  DIFF_COLOR[p.difficulty]
                                )}>
                                  {DIFF_LABEL[p.difficulty] ?? p.difficulty}
                                </span>
                              </div>
                              <p className="text-sm line-clamp-2 text-foreground/80">{p.question}</p>
                              {p.skills_required?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {p.skills_required.slice(0, 3).map((s) => (
                                    <span key={s} className="rounded bg-muted px-1.5 py-0 text-xs text-muted-foreground">
                                      {s}
                                    </span>
                                  ))}
                                  {p.skills_required.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{p.skills_required.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 주차별 전체 문제 다이얼로그 ───────────────────── */}
      {weekAllData && (() => {
        const { week, displayNum: wDisplayNum, problems } = weekAllData
        const q = weekAllSearch.trim().toLowerCase()
        const filtered = problems.filter((p) => {
          const diffOk = weekAllDiff === "전체" || p.difficulty === weekAllDiff
          const searchOk = !q ||
            p.question.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.skills_required?.some((s) => s.toLowerCase().includes(q))
          return diffOk && searchOk
        })
        const grouped = Object.entries(
          filtered.reduce<Record<string, ELAWProblem[]>>((acc, p) => {
            if (!acc[p.category]) acc[p.category] = []
            acc[p.category].push(p)
            return acc
          }, {})
        ).sort((a, b) => a[0].localeCompare(b[0]))

        return (
          <Dialog open={weekAllOpen} onOpenChange={setWeekAllOpen}>
            <DialogContent className="max-w-2xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
              {/* 헤더 */}
              <div className="px-5 pt-5 pb-3 border-b shrink-0 space-y-3 pr-12">
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {wDisplayNum}주차 관련 문제
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{week.theme} · 총 {problems.length}개</p>
                </div>

                {/* 검색 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    className="w-full h-8 pl-8 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="문제 내용, 카테고리, 스킬 검색..."
                    value={weekAllSearch}
                    onChange={(e) => setWeekAllSearch(e.target.value)}
                  />
                  {weekAllSearch && (
                    <button type="button" onClick={() => setWeekAllSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* 난이도 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">난이도</span>
                  {["전체", ...DIFF_ORDER].map((d) => (
                    <button key={d} type="button" onClick={() => setWeekAllDiff(d)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                        weekAllDiff === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/50"
                      )}>
                      {d === "전체" ? "전체" : DIFF_LABEL[d]}
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{filtered.length}개</span>
                </div>
              </div>

              {/* 문제 목록 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <FileQuestion className="h-10 w-10 opacity-30" />
                    <p className="text-sm">해당 조건의 문제가 없습니다.</p>
                  </div>
                ) : grouped.map(([cat, catProblems]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">{cat}</span>
                      <span className="text-xs text-muted-foreground/60">{catProblems.length}개</span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="space-y-1.5">
                      {catProblems.map((p) => (
                        <div key={p.id}
                          className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 hover:bg-primary/[0.02] transition-colors">
                          <div className="flex h-7 w-10 items-center justify-center rounded-md bg-primary/10 flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">Q{p.question_id}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={cn(
                                "rounded px-1.5 py-0 text-xs font-medium ml-auto shrink-0",
                                DIFF_COLOR[p.difficulty]
                              )}>
                                {DIFF_LABEL[p.difficulty] ?? p.difficulty}
                              </span>
                            </div>
                            <p className="text-sm line-clamp-2 text-foreground/80">{p.question}</p>
                            {p.skills_required?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {p.skills_required.slice(0, 3).map((s) => (
                                  <span key={s} className="rounded bg-muted px-1.5 py-0 text-xs text-muted-foreground">{s}</span>
                                ))}
                                {p.skills_required.length > 3 && (
                                  <span className="text-xs text-muted-foreground">+{p.skills_required.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
