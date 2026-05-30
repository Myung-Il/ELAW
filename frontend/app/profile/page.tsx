"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import AppHeader from "@/components/layout/app-header"
import {
  User, Settings, Building2, MessageSquare, GraduationCap,
  Edit2, Save, CheckCircle, Clock, ChevronRight, Loader2,
  BookOpen, Target, Trophy, Eye, Heart, BarChart3, Brain,
  ArrowRight, FileQuestion,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"
import { z } from "zod"
import { CATEGORY_STYLE, CATEGORY_LABELS } from "@/lib/constants"

// ── 스키마 ──────────────────────────────────────────────────────────
const passwordSchema = z
  .object({
    current: z.string().min(1, "현재 비밀번호를 입력해주세요."),
    next:    z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "새 비밀번호가 일치하지 않습니다.",
    path: ["confirm"],
  })

// ── 타입 ─────────────────────────────────────────────────────────────
interface Profile {
  id: number; name: string; email: string; role: string
  phone: string; ai_consent: boolean; privacy_consent: boolean; created_at: string
}
interface Application {
  id: number
  posting: { id: number; title: string; company: { name: string } }
  match_score: number | null; status: string
  applied_at: string | null; updated_at: string
}
interface Goal {
  job_role: string; duration_weeks: number; has_curriculum: boolean
}
interface QuizStats {
  total_attempts: number; correct_count: number; accuracy: number
}
interface MyPost {
  id: number; title: string; category: string
  view_count: number; like_count: number; comment_count: number; created_at: string
}
interface CurriculumRecord {
  id: number; content_json: { total_weeks: number; weeks: { week: number }[] }
}

// ── 상수 ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",      label: "내 정보",    icon: User },
  { id: "curriculum",    label: "학습 현황",  icon: GraduationCap },
  { id: "applications",  label: "지원 현황",  icon: Building2 },
  { id: "posts",         label: "작성한 글",  icon: MessageSquare },
  { id: "settings",      label: "계정 설정",  icon: Settings },
]

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  recommended: { label: "추천",     cls: "bg-gray-100 text-gray-700",   icon: Clock },
  viewed:      { label: "열람",     cls: "bg-blue-100 text-blue-700",   icon: Clock },
  scrapped:    { label: "스크랩",   cls: "bg-yellow-100 text-yellow-700", icon: CheckCircle },
  applied:     { label: "지원 완료", cls: "bg-green-100 text-green-700", icon: CheckCircle },
}

const LEVELS = [
  { key: "기초", label: "기초", color: "text-blue-700",    bg: "bg-blue-100",    border: "border-blue-300",    min: 0  },
  { key: "초급", label: "초급", color: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-300", min: 40 },
  { key: "중급", label: "중급", color: "text-amber-700",   bg: "bg-amber-100",   border: "border-amber-300",   min: 60 },
  { key: "고급", label: "고급", color: "text-violet-700",  bg: "bg-violet-100",  border: "border-violet-300",  min: 75 },
] as const

// ── 메인 ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ProfilePageInner />
    </Suspense>
  )
}

function ProfilePageInner() {
  const searchParams  = useSearchParams()
  const { logout }    = useAuth()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview")

  // 데이터 상태
  const [profile, setProfile]           = useState<Profile | null>(null)
  const [quizStats, setQuizStats]       = useState<QuizStats | null>(null)
  const [goal, setGoal]                 = useState<Goal | null>(null)
  const [curriculumWeeks, setCurriculumWeeks] = useState<number | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [myPosts, setMyPosts]           = useState<MyPost[]>([])

  // 로딩
  const [loadingProfile, setLoadingProfile]   = useState(true)
  const [loadingApps, setLoadingApps]         = useState(false)
  const [loadingPosts, setLoadingPosts]       = useState(false)

  // 편집
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm]   = useState({ name: "", phone: "" })
  const [isSaving, setIsSaving]   = useState(false)

  // 비밀번호
  const [pwForm, setPwForm]       = useState({ current: "", next: "", confirm: "" })
  const [pwError, setPwError]     = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)
  const [isSavingPw, setIsSavingPw] = useState(false)

  // ── 초기 로드 ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<{ data: Profile } | Profile>("/api/accounts/profile/"),
      api.get<QuizStats>("/api/core/quiz/stats/").catch(() => null),
      api.get<Goal[]>("/api/core/goals/").catch(() => []),
    ]).then(async ([profileRes, stats, goals]) => {
      const p = "data" in profileRes && !Array.isArray(profileRes)
        ? (profileRes as { data: Profile }).data
        : profileRes as Profile
      setProfile(p)
      setEditForm({ name: p.name, phone: p.phone ?? "" })
      if (stats && stats.total_attempts > 0) setQuizStats(stats)

      const goalsArr = Array.isArray(goals) ? goals : []
      if (goalsArr[0]) {
        setGoal(goalsArr[0])
        // 커리큘럼 실제 주차 수 가져오기
        if (goalsArr[0].has_curriculum) {
          try {
            const curricula = await api.get<CurriculumRecord[]>("/api/db/curricula/")
            if (Array.isArray(curricula) && curricula[0]) {
              setCurriculumWeeks(curricula[0].content_json.weeks?.length ?? curricula[0].content_json.total_weeks ?? null)
            }
          } catch { /* ignore */ }
        }
      }
    }).catch(console.error).finally(() => setLoadingProfile(false))
  }, [])

  // ── 탭별 지연 로드 ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "applications" || applications.length > 0) return
    setLoadingApps(true)
    api.get<{ data: Application[] } | Application[]>("/api/jobs/my/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as { data: Application[] }).data ?? []
        setApplications(list)
      })
      .catch(console.error)
      .finally(() => setLoadingApps(false))
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== "posts" || myPosts.length > 0) return
    setLoadingPosts(true)
    api.get<{ data: MyPost[] } | MyPost[]>("/api/board/?my=true&limit=50")
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : (res as { data: MyPost[] }).data ?? []
        setMyPosts(list)
      })
      .catch(console.error)
      .finally(() => setLoadingPosts(false))
  }, [activeTab])

  // ── 성취도 계산 ───────────────────────────────────────────────────
  const quizAccuracy    = quizStats ? Math.round(quizStats.accuracy) : 0
  const levelIdx        = quizStats
    ? quizAccuracy >= 75 ? 3 : quizAccuracy >= 60 ? 2 : quizAccuracy >= 40 ? 1 : 0
    : -1
  const currentLevel    = levelIdx >= 0 ? LEVELS[levelIdx as 0 | 1 | 2 | 3] : null

  // ── 핸들러 ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await api.patch<{ data: Profile } | Profile>("/api/accounts/profile/", editForm)
      const updated = "data" in res && !Array.isArray(res) ? (res as { data: Profile }).data : res as Profile
      setProfile(updated)
      setIsEditing(false)
    } catch (e) { console.error(e) } finally { setIsSaving(false) }
  }

  const handlePasswordChange = async () => {
    setPwError(""); setPwSuccess(false)
    const result = passwordSchema.safeParse(pwForm)
    if (!result.success) { setPwError(result.error.errors[0].message); return }
    setIsSavingPw(true)
    try {
      await api.post("/api/accounts/password/change/", { current_password: pwForm.current, new_password: pwForm.next })
      setPwSuccess(true); setPwForm({ current: "", next: "", confirm: "" })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      setPwError(msg.includes("400") ? "현재 비밀번호가 올바르지 않습니다." : "비밀번호 변경에 실패했습니다.")
    } finally { setIsSavingPw(false) }
  }

  // ── 렌더 ─────────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">내 프로필</h1>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* ── 사이드바 ─────────────────────────────────────────── */}
          <div className="space-y-4">
            <Card className="shadow-sm text-center">
              <CardContent className="p-6">
                <Avatar className="mx-auto mb-3 h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {profile?.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <p className="font-bold text-lg">{profile?.name}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {goal && (
                  <Badge variant="secondary" className="mt-2 text-xs">{goal.job_role}</Badge>
                )}
                {currentLevel && (
                  <div className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border", currentLevel.bg, currentLevel.color, currentLevel.border)}>
                    <Trophy className="h-3 w-3" />
                    {currentLevel.label} 단계
                  </div>
                )}
              </CardContent>
            </Card>

            <nav className="space-y-1">
              {TABS.map((tab) => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                  className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left",
                    activeTab === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  <tab.icon className="h-4 w-4 flex-shrink-0" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── 콘텐츠 ───────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">

            {/* ════ 내 정보 ════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <>
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />기본 정보
                    </CardTitle>
                    <Button variant={isEditing ? "default" : "outline"} size="sm" className="gap-1.5"
                      onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEditing ? <><Save className="h-3.5 w-3.5" />저장</> : <><Edit2 className="h-3.5 w-3.5" />수정</>}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "이메일", value: profile?.email ?? "" },
                      { label: "가입일", value: profile ? new Date(profile.created_at).toLocaleDateString("ko-KR") : "" },
                    ].map((f) => (
                      <div key={f.label} className="flex items-center gap-4">
                        <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">{f.label}</Label>
                        <p className="text-sm font-medium">{f.value}</p>
                      </div>
                    ))}

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-4">
                        <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">이름</Label>
                        {isEditing ? <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="flex-1 max-w-xs" /> : <p className="text-sm font-medium">{profile?.name}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">전화번호</Label>
                        {isEditing ? <Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="flex-1 max-w-xs" placeholder="010-0000-0000" /> : <p className="text-sm font-medium">{profile?.phone || "미등록"}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 나의 활동 현황 */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />나의 활동 현황
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 가입 기간 */}
                    {profile && (() => {
                      const days = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
                      return (
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">가입 기간</span>
                          <span className="text-sm font-semibold">
                            {new Date(profile.created_at).toLocaleDateString("ko-KR")} ({days}일째)
                          </span>
                        </div>
                      )
                    })()}

                    {/* 목표 직무 */}
                    <div className="flex items-center justify-between py-2 border-t">
                      <span className="text-sm text-muted-foreground">목표 직무</span>
                      {goal ? (
                        <Badge variant="secondary" className="text-xs">{goal.job_role}</Badge>
                      ) : (
                        <Link href="/goal-setting">
                          <Button variant="link" size="sm" className="text-xs h-auto p-0">목표 설정하기 →</Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ════ 학습 현황 ═══════════════════════════════════════ */}
            {activeTab === "curriculum" && (
              <>
                {/* 목표 정보 */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />학습 목표
                    </CardTitle>
                    {goal?.has_curriculum && (
                      <Link href="/curriculum"><Button variant="outline" size="sm" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" />커리큘럼 상세</Button></Link>
                    )}
                  </CardHeader>
                  <CardContent>
                    {goal ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          { label: "목표 직무",  value: goal.job_role },
                          { label: "커리큘럼 주차", value: curriculumWeeks !== null ? `${curriculumWeeks}주` : `${goal.duration_weeks}주` },
                          { label: "커리큘럼",   value: goal.has_curriculum ? "✓ 생성됨" : "미생성" },
                        ].map((s) => (
                          <div key={s.label} className="rounded-xl bg-muted/50 border p-3 text-center">
                            <p className="text-sm font-bold text-primary truncate">{s.value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground mb-3">아직 목표가 설정되지 않았습니다.</p>
                        <Link href="/goal-setting"><Button size="sm" className="gap-2"><Target className="h-4 w-4" />목표 설정하기</Button></Link>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 성취도 */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />학습 성취도
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* 레벨 스텝 */}
                    <div className="relative flex items-center justify-between">
                      <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted mx-4" />
                      {LEVELS.map((lv, idx) => {
                        const isActive = idx === levelIdx
                        const isPassed = levelIdx > idx
                        return (
                          <div key={lv.key} className="relative flex flex-col items-center gap-1.5 z-10">
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                              isActive ? `${lv.bg} ${lv.border} ${lv.color}` : isPassed ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted text-muted-foreground")}>
                              {isPassed ? "✓" : idx + 1}
                            </div>
                            <span className={cn("text-[10px] font-medium", isActive ? lv.color : isPassed ? "text-primary" : "text-muted-foreground")}>{lv.label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* 통계 */}
                    {quizStats ? (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "총 풀이", value: quizStats.total_attempts },
                            { label: "정답 수", value: quizStats.correct_count },
                            { label: "정답률", value: `${quizAccuracy}%` },
                          ].map((s) => (
                            <div key={s.label} className="rounded-lg border bg-muted/30 p-2.5 text-center">
                              <p className="text-lg font-bold text-primary">{s.value}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        {/* 정답률 바 */}
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">현재 정답률</span>
                            <span className="font-semibold text-primary">{quizAccuracy}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${quizAccuracy}%` }} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>문제를 풀면 성취도가 측정됩니다.</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link href="/study" className="flex-1">
                        <Button className="w-full gap-2 text-sm"><BookOpen className="h-4 w-4" />{quizStats ? "계속 학습하기" : "학습 시작하기"}</Button>
                      </Link>
                      {goal?.has_curriculum && (
                        <Link href="/curriculum" className="flex-1">
                          <Button variant="outline" className="w-full gap-2 text-sm">커리큘럼 보기<ArrowRight className="h-4 w-4" /></Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ════ 지원 현황 ═══════════════════════════════════════ */}
            {activeTab === "applications" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />지원 현황
                  </CardTitle>
                  <Badge variant="secondary">{applications.length}개</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingApps ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : applications.length > 0 ? (
                    applications.map((app) => {
                      const cfg = STATUS_CFG[app.status]
                      const Icon = cfg?.icon || Clock
                      const date = new Date(app.applied_at || app.updated_at).toLocaleDateString("ko-KR")
                      return (
                        <Link href={`/jobs/${app.posting.id}`} key={app.id}>
                          <div className="flex items-center gap-4 rounded-xl border p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
                              {app.posting.company.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{app.posting.company.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{app.posting.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {app.match_score != null && (
                                <span className="text-xs text-primary font-semibold">{Math.round(app.match_score)}%</span>
                              )}
                              <Badge className={cn("text-xs border-0 gap-1", cfg?.cls ?? "bg-gray-100 text-gray-700")}>
                                <Icon className="h-3 w-3" />{cfg?.label ?? app.status}
                              </Badge>
                            </div>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <div className="py-10 text-center space-y-3">
                      <Building2 className="mx-auto h-10 w-10 opacity-30" />
                      <p className="text-sm text-muted-foreground">아직 스크랩하거나 지원한 기업이 없습니다.</p>
                    </div>
                  )}
                  <Link href="/jobs">
                    <Button variant="outline" className="w-full gap-2 mt-2">기업 공고 보러가기<ChevronRight className="h-4 w-4" /></Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* ════ 작성한 글 ═══════════════════════════════════════ */}
            {activeTab === "posts" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />작성한 글
                  </CardTitle>
                  <Badge variant="secondary">{myPosts.length}개</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loadingPosts ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : myPosts.length > 0 ? (
                    myPosts.map((post) => (
                      <Link href={`/board/${post.id}`} key={post.id}>
                        <div className="flex items-start gap-3 rounded-xl border p-3.5 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                          <Badge className={cn("text-xs border-0 flex-shrink-0 mt-0.5",
                            CATEGORY_STYLE[post.category] ?? "bg-gray-100 text-gray-700")}>
                            {CATEGORY_LABELS[post.category] ?? post.category}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{post.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                              <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.view_count}</span>
                              {post.like_count > 0 && <span className="flex items-center gap-0.5 text-rose-500"><Heart className="h-3 w-3" />{post.like_count}</span>}
                              {post.comment_count > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{post.comment_count}</span>}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="py-10 text-center space-y-3">
                      <MessageSquare className="mx-auto h-10 w-10 opacity-30" />
                      <p className="text-sm text-muted-foreground">아직 작성한 글이 없습니다.</p>
                    </div>
                  )}
                  <Link href="/board">
                    <Button variant="outline" className="w-full gap-2 mt-2">게시판 보러가기<ChevronRight className="h-4 w-4" /></Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* ════ 계정 설정 ═══════════════════════════════════════ */}
            {activeTab === "settings" && (
              <>
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />비밀번호 변경
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { id: "pw-current", label: "현재 비밀번호", key: "current", placeholder: "현재 비밀번호" },
                      { id: "pw-next",    label: "새 비밀번호",   key: "next",    placeholder: "새 비밀번호 (8자 이상)" },
                      { id: "pw-confirm", label: "새 비밀번호 확인", key: "confirm", placeholder: "새 비밀번호 재입력" },
                    ].map((f) => (
                      <div key={f.id} className="space-y-2">
                        <Label htmlFor={f.id}>{f.label}</Label>
                        <Input id={f.id} type="password" placeholder={f.placeholder}
                          value={pwForm[f.key as keyof typeof pwForm]}
                          onChange={(e) => setPwForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                    {pwError   && <p className="text-sm text-destructive">{pwError}</p>}
                    {pwSuccess && <p className="text-sm text-emerald-600">비밀번호가 변경되었습니다.</p>}
                    <Button className="w-full" onClick={handlePasswordChange}
                      disabled={isSavingPw || !pwForm.current || !pwForm.next || !pwForm.confirm}>
                      {isSavingPw && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      비밀번호 변경
                    </Button>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">계정 관리</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full" onClick={logout}>
                      로그아웃
                    </Button>
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                      <p className="text-sm font-semibold text-destructive">위험 구역</p>
                      <p className="text-xs text-muted-foreground">회원 탈퇴 시 모든 학습 기록, 커리큘럼, 게시글이 영구적으로 삭제됩니다.</p>
                      <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => alert("회원 탈퇴 기능은 준비 중입니다.")}>
                        회원 탈퇴
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
