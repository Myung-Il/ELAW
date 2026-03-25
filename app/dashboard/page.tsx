"use client"

import { useState } from "react"
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

/* * =========================================================================
 * [FE/BE/DB 전체 매뉴얼]
 * 하단에 선언된 배열들(learningProgress, recommendedCourses 등)은 현재 화면을 그리기 위해 프론트엔드에 하드코딩된 임시 데이터입니다.
 * * * 👨‍💻 [FE 담당] 화면이 렌더링될 때 useEffect나 React Query를 사용하여 백엔드 API로부터 이 데이터를 받아오도록 수정해야 합니다.
 * * ⚙️ [BE 담당] 아래 데이터 구조를 참고하여 각 섹션에 맞는 API(예: GET /api/v1/dashboard/progress)를 각각 또는 통합하여 개발해 주세요.
 * * 🗄️ [DB 담당] 대시보드는 여러 테이블(유저 활동, 강의, 기업 등)의 조인이 필요할 수 있으므로, 쿼리 최적화 및 적절한 인덱스 생성이 중요합니다.
 * =========================================================================
 */

const learningProgress = [
  { subject: "자료구조", progress: 85, total: 24, completed: 20 },
  { subject: "알고리즘", progress: 62, total: 30, completed: 19 },
  { subject: "운영체제", progress: 45, total: 20, completed: 9 },
  { subject: "데이터베이스", progress: 28, total: 18, completed: 5 },
]

const recommendedCourses = [
  { title: "알고리즘 심화: 동적 프로그래밍", duration: "2시간 30분", difficulty: "중급" },
  { title: "운영체제: 프로세스와 스레드", duration: "1시간 45분", difficulty: "중급" },
  { title: "데이터베이스 설계 기초", duration: "2시간", difficulty: "초급" },
]

const recommendedCompanies = [
  { name: "삼성전자", match: 94, field: "IT/반도체", positions: 120, logo: "S" },
  { name: "네이버", match: 91, field: "IT서비스", positions: 85, logo: "N" },
  { name: "카카오", match: 88, field: "IT서비스", positions: 72, logo: "K" },
  { name: "LG전자", match: 85, field: "전자", positions: 68, logo: "L" },
]

const upcomingEvents = [
  { title: "삼성 SW 역량테스트", date: "2024.03.15", dDay: 5, type: "시험" },
  { title: "전국 대학생 알고리즘 대회", date: "2024.03.22", dDay: 12, type: "대회" },
  { title: "네이버 채용설명회", date: "2024.03.25", dDay: 15, type: "채용" },
]

const recentActivities = [
  { action: "알고리즘 문제 풀이 완료", time: "10분 전", icon: Target },
  { action: "자료구조 강의 시청", time: "1시간 전", icon: Play },
  { action: "이력서 업데이트", time: "3시간 전", icon: FileText },
]

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

                  {/* Learning Progress */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            학습 진행률
                          </CardTitle>
                          <CardDescription>현재 수강 중인 과목의 진행 상황</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">전체 보기</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* [FE 수정 매뉴얼] 상단의 하드코딩된 learningProgress 배열 대신, API에서 받아온 상태값으로 map 함수를 돌리세요. */}
                      {learningProgress.map((item) => (
                          <div key={item.subject}>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-medium">{item.subject}</span>
                              <span className="text-muted-foreground">
                            {item.completed}/{item.total}강 완료
                          </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Progress value={item.progress} className="flex-1" />
                              <span className="w-12 text-right text-sm font-medium">{item.progress}%</span>
                            </div>
                          </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Recommended Courses */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            맞춤 추천 강의
                          </CardTitle>
                          <CardDescription>AI가 분석한 부족한 파트 보충 학습</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">전체 보기</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      {/* [FE/BE 매뉴얼] 추천 강의 API 결과를 렌더링하세요. */}
                      {recommendedCourses.map((course, i) => (
                          <div key={i} className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                            <div className="flex items-start justify-between gap-4">
                              <h3 className="font-medium line-clamp-2">{course.title}</h3>
                              <Badge variant="secondary" className="shrink-0">{course.difficulty}</Badge>
                            </div>
                            <div className="mt-auto flex items-center justify-between pt-4">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {course.duration}
                          </span>
                              <Button size="sm" className="gap-2">
                                <Play className="h-4 w-4" />
                                재생
                              </Button>
                            </div>
                          </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">

                  {/* Recommended Companies */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                        AI 기업 매칭
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* [FE/DB 매뉴얼] 유저의 학습 데이터와 기업 정보를 조인하여 매칭률(match)이 높은 기업 3개를 렌더링하세요. */}
                      {recommendedCompanies.slice(0, 3).map((company, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                                {company.logo}
                              </div>
                              <div>
                                <p className="font-medium">{company.name}</p>
                                <p className="text-xs text-muted-foreground">{company.field}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="default" className="mb-1">{company.match}% 매칭</Badge>
                              <p className="text-xs text-muted-foreground">{company.positions}개 포지션</p>
                            </div>
                          </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Upcoming Events */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                        다가오는 일정
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* [FE/BE 매뉴얼] 일정 API 결과를 렌더링하세요. */}
                      {upcomingEvents.map((event, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-muted">
                              <span className="text-xs text-muted-foreground">D-</span>
                              <span className="font-bold text-primary">{event.dDay}</span>
                            </div>
                            <div>
                              <p className="font-medium">{event.title}</p>
                              <p className="text-xs text-muted-foreground">{event.date} • {event.type}</p>
                            </div>
                          </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Recent Activities */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        최근 활동
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* [FE/BE 매뉴얼] 유저의 최근 활동 로그 테이블 데이터를 렌더링하세요. */}
                      {recentActivities.map((activity, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <activity.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">{activity.action}</p>
                              <p className="text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                          </div>
                      ))}
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