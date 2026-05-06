"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  GraduationCap,
  BookOpen,
  Building2,
  Trophy,
  Brain,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  Play,
  Clock,
  Users,
  Briefcase,
  Award,
  Calendar,
  TrendingUp,
  Sparkles,
  FileText,
  Target,
  Menu,
  X
} from "lucide-react"
import { api } from "@/lib/api"

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dashData, setDashData]       = useState<any>(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    api.getDashboard()
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDashData(d) })
      .finally(() => setLoading(false))
  }, [])

  const solveStats    = dashData?.solve_stats    || { total: 0, solved: 0, correct_rate: 0 }
  const topMatches    = dashData?.top_matches    || []
  const weakTags      = dashData?.weak_tags      || []
  const topLangs      = dashData?.top_languages  || []
  const goalData      = dashData?.goal           || null
  const userName      = dashData?.user?.name     || "사용자"

  return (
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            {/* Logo */}
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

            {/* Navigation */}
            {/* [FE 수정 매뉴얼] 각 사이드바 메뉴의 href="#" 속성을 클릭 시 이동할 실제 페이지 경로(예: /courses, /problems 등)로 변경하세요. */}
            <nav className="flex-1 space-y-1 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">학습</p>
              <Link href="#" className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary">
                <BookOpen className="h-4 w-4" />
                <span className="text-sm font-medium">내 강의실</span>
              </Link>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Target className="h-4 w-4" />
                <span className="text-sm">문제풀이</span>
              </Link>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <FileText className="h-4 w-4" />
                <span className="text-sm">모의시험</span>
              </Link>
              <Link href="/curriculum" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Brain className="h-4 w-4" />
                <span className="text-sm">AI 커리큘럼</span>
              </Link>

              <p className="mb-2 mt-6 text-xs font-semibold uppercase text-muted-foreground">취업</p>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">기업 정보</span>
              </Link>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Briefcase className="h-4 w-4" />
                <span className="text-sm">채용 공고</span>
              </Link>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">AI 매칭</span>
              </Link>

              <p className="mb-2 mt-6 text-xs font-semibold uppercase text-muted-foreground">커뮤니티</p>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Trophy className="h-4 w-4" />
                <span className="text-sm">대회/이벤트</span>
              </Link>
              <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">스터디</span>
              </Link>
            </nav>

            {/* User */}
            <div className="border-t p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">홍</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  {/* [FE/BE 수정 매뉴얼] 로그인 API 연동 후, 전역 상태(Context, Redux 등)에 저장된 유저 정보를 이곳에 바인딩하세요. (예: {user.name}) */}
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
          {/* Top Header */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold">대시보드</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {/* [FE 수정 매뉴얼] 읽지 않은 알림이 있을 때만 이 뱃지(span)가 보이도록 조건부 렌더링 로직 추가 필요 */}
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              </Button>
              <Link href="/login">
                {/* [FE 수정 매뉴얼] 로그아웃 버튼입니다. onClick 이벤트를 달아 로컬 스토리지의 토큰을 지우고 백엔드 로그아웃 API를 호출하세요. */}
                <Button variant="ghost" size="icon">
                  <LogOut className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto max-w-6xl space-y-6">

              {/* Welcome Section */}
              <Card className="border-none bg-primary text-primary-foreground shadow-lg">
                <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
                  <div>
                    {/* [FE/BE 매뉴얼] 로그인한 유저 이름을 동적으로 가져와 렌더링하세요. */}
                    <h2 className="mb-2 text-2xl font-bold">안녕하세요, 홍길동님!</h2>
                    <p className="text-primary-foreground/80">오늘도 ELAW와 함께 성장하세요. AI가 추천하는 학습을 확인해보세요.</p>
                  </div>
                  <Link href="/curriculum">
                    <Button variant="secondary" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI 추천 학습
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column - Learning */}
                <div className="space-y-6 lg:col-span-2">

                  {/* Weak Tags Progress */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            취약 분야 진단
                          </CardTitle>
                          <CardDescription>정답률 기반 AI 분석 결과</CardDescription>
                        </div>
                        <Link href="/study"><Button variant="outline" size="sm">문제 풀기</Button></Link>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {weakTags.length > 0 ? weakTags.map((tag: any) => (
                        <div key={tag.stat_key}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium">{tag.stat_key}</span>
                            <span className="text-muted-foreground">정답률 {Math.round(tag.correct_rate || 0)}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={tag.correct_rate || 0} className="flex-1" />
                            <span className="w-12 text-right text-sm font-medium">{Math.round(tag.correct_rate || 0)}%</span>
                          </div>
                        </div>
                      )) : (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          문제를 풀면 취약 분야를 분석해 드립니다.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Study Recommendations */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            AI 추천 문제
                          </CardTitle>
                          <CardDescription>BKT/DKT 기반 맞춤 문제 추천</CardDescription>
                        </div>
                        <Link href="/study"><Button variant="outline" size="sm">전체 보기</Button></Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {goalData ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            목표 직무 <span className="font-semibold text-foreground">{goalData.job_role}</span> 기반 문제를 추천합니다.
                          </p>
                          <Link href="/study">
                            <Button className="w-full gap-2">
                              <Play className="h-4 w-4" />
                              추천 문제 풀기
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          목표를 설정하면 맞춤 문제를 추천해 드립니다.
                          <Link href="/goal-setting"><Button variant="link" className="px-1">목표 설정</Button></Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">

                  {/* Top Matches */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                        AI 기업 매칭
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {topMatches.length > 0 ? topMatches.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                              {m.company.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{m.company}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{m.posting_title}</p>
                            </div>
                          </div>
                          <Badge variant="default" className="shrink-0">{m.match_score}% 매칭</Badge>
                        </div>
                      )) : (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          <Link href="/jobs"><Button variant="outline" size="sm" className="gap-1"><Briefcase className="h-3.5 w-3.5" />매칭 분석 시작</Button></Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Languages */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        주요 언어 통계
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topLangs.length > 0 ? topLangs.map((lang: any) => (
                        <div key={lang.stat_key} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{lang.stat_key}</span>
                          <span className="text-muted-foreground">정답률 {Math.round(lang.correct_rate || 0)}%</span>
                        </div>
                      )) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          언어 데이터가 없습니다. 백준 계정을 연동하면 자동으로 수집됩니다.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Ad Banner */}
                  <Card className="overflow-hidden">
                    <CardContent className="bg-gradient-to-br from-primary/20 to-accent/20 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        <Badge variant="secondary">광고</Badge>
                      </div>
                      <h3 className="mb-1 font-semibold">삼성 청년 SW 아카데미</h3>
                      <p className="mb-3 text-sm text-muted-foreground">12기 모집 중 - 지금 지원하세요!</p>
                      {/* [FE 수정 매뉴얼] 자세히 보기 버튼 클릭 시 해당 사이트로 이동하는 onClick 이벤트나 Link 래퍼를 추가하세요. */}
                      <Button size="sm" className="w-full">자세히 보기</Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </div>
  )
}