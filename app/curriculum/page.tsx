"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  GraduationCap,
  BookOpen,
  Brain,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  Play,
  Clock,
  CheckCircle2,
  Circle,
  Lock,
  Sparkles,
  Target,
  Menu,
  X,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Trophy,
  TrendingUp
} from "lucide-react"

/* * =========================================================================
 * [FE/BE/DB 전체 매뉴얼]
 * 하단에 선언된 배열들(curriculumWeeks, aiInsights 등)은 현재 프론트엔드에 하드코딩된 임시 데이터입니다.
 * * * 👨‍💻 [FE 담당] 화면이 렌더링될 때 useEffect나 React Query를 사용하여 백엔드 API로부터 커리큘럼 데이터를 받아오도록 수정하세요.
 * * ⚙️ [BE 담당] 아래 JSON 구조에 맞추어 주차별 커리큘럼 목록(GET /api/v1/curriculum) API를 작성해야 합니다.
 * * 🗄️ [DB 담당] 커리큘럼 테이블(모듈), 세부 주제(topics) 테이블, 그리고 유저별 진행률을 저장하는 매핑 테이블의 구조화가 필요합니다.
 * =========================================================================
 */

const curriculumWeeks = [
  {
    week: 1,
    title: "자료구조 기초",
    status: "completed",
    topics: ["배열과 연결리스트", "스택과 큐", "해시 테이블"],
    problems: 15,
    completedProblems: 15,
    estimatedHours: 8,
  },
  {
    week: 2,
    title: "트리 구조",
    status: "completed",
    topics: ["이진 트리", "이진 탐색 트리", "힙"],
    problems: 12,
    completedProblems: 12,
    estimatedHours: 10,
  },
  {
    week: 3,
    title: "그래프 기초",
    status: "completed",
    topics: ["그래프 표현", "BFS", "DFS"],
    problems: 14,
    completedProblems: 14,
    estimatedHours: 12,
  },
  {
    week: 4,
    title: "정렬 알고리즘",
    status: "in-progress",
    topics: ["기본 정렬", "고급 정렬", "정렬 응용"],
    problems: 10,
    completedProblems: 6,
    estimatedHours: 8,
  },
  {
    week: 5,
    title: "탐색 알고리즘",
    status: "locked",
    topics: ["이분 탐색", "투 포인터", "슬라이딩 윈도우"],
    problems: 12,
    completedProblems: 0,
    estimatedHours: 10,
  },
  {
    week: 6,
    title: "동적 프로그래밍 기초",
    status: "locked",
    topics: ["DP 개념", "1차원 DP", "2차원 DP"],
    problems: 15,
    completedProblems: 0,
    estimatedHours: 14,
  },
  {
    week: 7,
    title: "동적 프로그래밍 심화",
    status: "locked",
    topics: ["구간 DP", "트리 DP", "비트마스킹 DP"],
    problems: 12,
    completedProblems: 0,
    estimatedHours: 16,
  },
  {
    week: 8,
    title: "그리디 알고리즘",
    status: "locked",
    topics: ["그리디 개념", "구현 문제", "최적화 문제"],
    problems: 10,
    completedProblems: 0,
    estimatedHours: 8,
  },
  {
    week: 9,
    title: "최단 경로",
    status: "locked",
    topics: ["다익스트라", "벨만-포드", "플로이드-워셜"],
    problems: 12,
    completedProblems: 0,
    estimatedHours: 12,
  },
  {
    week: 10,
    title: "최소 신장 트리",
    status: "locked",
    topics: ["크루스칼", "프림", "유니온 파인드"],
    problems: 10,
    completedProblems: 0,
    estimatedHours: 10,
  },
  {
    week: 11,
    title: "문자열 알고리즘",
    status: "locked",
    topics: ["KMP", "트라이", "해싱"],
    problems: 10,
    completedProblems: 0,
    estimatedHours: 12,
  },
  {
    week: 12,
    title: "종합 문제풀이",
    status: "locked",
    topics: ["기업 코딩테스트 유형", "실전 문제풀이", "시간 복잡도 최적화"],
    problems: 20,
    completedProblems: 0,
    estimatedHours: 16,
  },
]

const aiInsights = [
  { label: "현재 진도", value: "4주차", icon: Calendar },
  { label: "완료율", value: "29%", icon: TrendingUp },
  { label: "예상 완료", value: "8주 후", icon: Target },
  { label: "학습 랭킹", value: "상위 15%", icon: Trophy },
]

export default function CurriculumPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // [FE 수정 매뉴얼] 목표 변경(Select) 시, 새로운 목표에 맞는 커리큘럼 데이터를 다시 패칭하는 로직을 추가하세요.
  const [selectedGoal, setSelectedGoal] = useState("coding-test")

  const totalProblems = curriculumWeeks.reduce((acc, week) => acc + week.problems, 0)
  const completedProblems = curriculumWeeks.reduce((acc, week) => acc + week.completedProblems, 0)
  const overallProgress = Math.round((completedProblems / totalProblems) * 100)

  return (
      <div className="flex min-h-screen bg-background">
        {/* Sidebar - Same as dashboard */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <GraduationCap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-primary">ELAW</span>
              </Link>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 space-y-1 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">학습</p>
              <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <BookOpen className="h-4 w-4" />
                <span className="text-sm font-medium">내 강의실</span>
              </Link>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Target className="h-4 w-4" />
                <span className="text-sm">문제풀이</span>
              </Link>
              <Link href="/curriculum" className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary">
                <Brain className="h-4 w-4" />
                <span className="text-sm">AI 커리큘럼</span>
              </Link>
            </nav>

            <div className="border-t p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">홍</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">홍길동</p>
                  <p className="text-xs text-muted-foreground">컴퓨터공학과</p>
                </div>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Header (Top Nav) */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Link href="/dashboard">
                  <Button variant="ghost" size="icon" className="mr-2">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h1 className="text-lg font-semibold">AI 커리큘럼</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto max-w-4xl">
              {/* Page Title & Goal Selection */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold">
                    <Brain className="h-6 w-6 text-primary" />
                    AI 커리큘럼
                  </h1>
                  <p className="text-muted-foreground">AI가 분석한 맞춤형 12주 학습 계획</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* [BE 매뉴얼] 목표(selectedGoal) 값이 변경될 때마다 그에 맞는 새로운 커리큘럼 데이터를 반환해야 합니다. */}
                  <Select value={selectedGoal} onValueChange={setSelectedGoal}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="학습 목표 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coding-test">코딩테스트 준비</SelectItem>
                      <SelectItem value="cs-fundamental">CS 기초 다지기</SelectItem>
                      <SelectItem value="job-interview">취업 면접 준비</SelectItem>
                      <SelectItem value="certification">자격증 취득</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* [FE 매뉴얼] 새로고침 버튼에 커리큘럼 API 재요청(refetch) 이벤트를 연결하세요. */}
                  <Button variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* AI Insights */}
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {aiInsights.map((insight) => (
                    <Card key={insight.label}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <insight.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{insight.label}</p>
                          <p className="font-bold">{insight.value}</p>
                        </div>
                      </CardContent>
                    </Card>
                ))}
              </div>

              {/* Overall Progress */}
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">전체 진행률</span>
                    <span className="font-bold text-primary">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-3" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    총 {totalProblems}문제 중 {completedProblems}문제 완료
                  </p>
                </CardContent>
              </Card>

              {/* Curriculum List */}
              <div className="grid gap-4">
                {/* [FE 수정 매뉴얼] API로부터 받아온 커리큘럼 상태 배열을 map으로 순회합니다. */}
                {curriculumWeeks.map((week) => {
                  const isLocked = week.status === "locked"
                  const isCompleted = week.status === "completed"
                  const weekProgress = Math.round((week.completedProblems / week.problems) * 100)

                  return (
                      // [FE 수정 매뉴얼] 잠긴(locked) 주차는 투명도(opacity)를 낮춰 시각적으로 구분합니다.
                      <Card key={week.week} className={isLocked ? "opacity-60" : ""}>
                        <CardContent className="p-6">
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isCompleted ? (
                                  <CheckCircle2 className="h-6 w-6 text-primary" />
                              ) : isLocked ? (
                                  <Lock className="h-6 w-6 text-muted-foreground" />
                              ) : (
                                  <Circle className="h-6 w-6 text-primary" />
                              )}
                              <h3 className="text-lg font-bold">{week.week}주차: {week.title}</h3>
                            </div>
                            <Badge variant={isCompleted ? "default" : isLocked ? "secondary" : "outline"}>
                              {isCompleted ? "완료" : isLocked ? "잠금" : "진행중"}
                            </Badge>
                          </div>

                          <div className="mb-4 flex flex-wrap gap-2">
                            {week.topics.map((topic) => (
                                <Badge key={topic} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                            ))}
                          </div>

                          <div className="mb-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Target className="h-3 w-3" />
                          {week.completedProblems} / {week.problems} 문제
                        </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                              {week.estimatedHours}시간
                        </span>
                          </div>

                          {!isLocked && (
                              <div className="flex items-center gap-2">
                                <Progress value={weekProgress} className="flex-1" />
                                <span className="text-sm font-medium">{weekProgress}%</span>
                              </div>
                          )}
                          {isLocked && (
                              <p className="text-center text-sm text-muted-foreground">
                                이전 주차 완료 후 잠금 해제
                              </p>
                          )}
                        </CardContent>

                        {/* [FE 매뉴얼] 잠금 해제된 주차에만 학습 버튼을 렌더링하고, 클릭 시 해당 주차의 학습 페이지로 라우팅되도록 이벤트(또는 Link)를 추가하세요. */}
                        {!isLocked && (
                            <div className="border-t bg-muted/30 p-3">
                              <Button variant="ghost" size="sm" className="w-full gap-2">
                                {isCompleted ? "복습하기" : "학습 계속하기"}
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                        )}
                      </Card>
                  )
                })}
              </div>
            </div>
          </main>
        </div>

        {sidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </div>
  )
}