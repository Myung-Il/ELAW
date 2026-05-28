"use client"

import { Suspense, useEffect, useState } from "react"
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
  Edit2, Save, CheckCircle, Clock, XCircle, ChevronRight, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"
import { z } from "zod"

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

interface Profile {
  id: number
  name: string
  email: string
  role: string
  phone: string
  ai_consent: boolean
  privacy_consent: boolean
  created_at: string
}

interface Application {
  id: number
  posting: {
    id: number
    title: string
    company: { id: number; name: string; industry: string; logo_url: string | null }
    job_role: string
  }
  match_score: number | null
  status: string
  applied_at: string | null
  updated_at: string
}

// 탭 정의
const tabs = [
  { id: "overview", label: "내 정보", icon: User },
  { id: "applications", label: "지원 현황", icon: Building2 },
  { id: "curriculum", label: "내 커리큘럼", icon: GraduationCap },
  { id: "posts", label: "작성한 글", icon: MessageSquare },
  { id: "settings", label: "계정 설정", icon: Settings },
]

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  "recommended": { label: "추천", className: "bg-gray-100 text-gray-700", icon: Clock },
  "viewed":      { label: "열람", className: "bg-blue-100 text-blue-700", icon: Clock },
  "scrapped":    { label: "스크랩", className: "bg-yellow-100 text-yellow-700", icon: CheckCircle },
  "applied":     { label: "지원 완료", className: "bg-green-100 text-green-700", icon: CheckCircle },
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  )
}

function ProfilePageInner() {
  const searchParams = useSearchParams()
  const { logout } = useAuth()
  const initialTab = searchParams.get("tab") || "overview"
  const [activeTab, setActiveTab] = useState(initialTab)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", phone: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [goalInfo, setGoalInfo] = useState<{ job_role: string; duration_weeks: number; has_curriculum: boolean } | null>(null)
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)
  const [isSavingPw, setIsSavingPw] = useState(false)

  useEffect(() => {
    api.get<{ data: Profile } | Profile>("/api/accounts/profile/")
      .then((res) => {
        const p = "data" in res && !Array.isArray(res) ? (res as { data: Profile }).data : res as Profile
        setProfile(p)
        setEditForm({ name: p.name, phone: p.phone ?? "" })
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (activeTab !== "applications") return
    setIsLoadingApps(true)
    api.get<{ data: Application[] }>("/api/jobs/my/")
      .then((res) => setApplications(res.data ?? []))
      .catch(console.error)
      .finally(() => setIsLoadingApps(false))
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== "curriculum" || goalInfo) return
    api.get<{ job_role: string; duration_weeks: number; has_curriculum: boolean }[]>("/api/core/goals/")
      .then((goals) => { if (Array.isArray(goals) && goals[0]) setGoalInfo(goals[0]) })
      .catch(console.error)
  }, [activeTab, goalInfo])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await api.patch<{ data: Profile } | Profile>("/api/accounts/profile/", editForm)
      const updated = "data" in res && !Array.isArray(res) ? (res as { data: Profile }).data : res as Profile
      setProfile(updated)
      setIsEditing(false)
    } catch (err) {
      console.error("프로필 저장 실패:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    setPwError("")
    setPwSuccess(false)
    const result = passwordSchema.safeParse(pwForm)
    if (!result.success) {
      setPwError(result.error.errors[0].message)
      return
    }
    setIsSavingPw(true)
    try {
      await api.post("/api/accounts/password/change/", {
        current_password: pwForm.current,
        new_password: pwForm.next,
      })
      setPwSuccess(true)
      setPwForm({ current: "", next: "", confirm: "" })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("400")) {
        setPwError("현재 비밀번호가 올바르지 않습니다.")
      } else {
        setPwError("비밀번호 변경에 실패했습니다.")
      }
    } finally {
      setIsSavingPw(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">내 프로필</h1>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* ── 좌측 사이드바: 사용자 카드 + 탭 ────────────── */}
          <div className="space-y-4">
            {/* 사용자 카드 */}
            <Card className="shadow-sm text-center">
              <CardContent className="p-6">
                <Avatar className="mx-auto mb-3 h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {profile?.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {profile ? (
                  <>
                    <p className="font-bold text-lg">{profile.name}</p>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {profile.role}
                    </Badge>
                  </>
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                )}
              </CardContent>
            </Card>

            {/* 탭 메뉴 */}
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4 flex-shrink-0" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── 우측 콘텐츠 영역 ─────────────────────────────── */}
          <div className="lg:col-span-3">

            {/* ── 내 정보 탭 ───────────────────────────────── */}
            {activeTab === "overview" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base">기본 정보</CardTitle>
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={isSaving || !profile}
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEditing ? <><Save className="h-3.5 w-3.5" />저장</> : <><Edit2 className="h-3.5 w-3.5" />수정</>}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile ? (
                    <>
                      {[
                        { label: "이름", value: profile.name },
                        { label: "이메일", value: profile.email },
                        { label: "가입일", value: new Date(profile.created_at).toLocaleDateString("ko-KR") },
                      ].map((field) => (
                        <div key={field.label} className="flex items-center gap-4">
                          <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">{field.label}</Label>
                          <p className="text-sm font-medium">{field.value}</p>
                        </div>
                      ))}

                      <div className="border-t pt-4 space-y-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">수정 가능 정보</p>

                        <div className="flex items-center gap-4">
                          <Label className="w-24 text-sm text-muted-foreground flex-shrink-0" htmlFor="name-field">이름</Label>
                          {isEditing ? (
                            <Input
                              id="name-field"
                              value={editForm.name}
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              className="flex-1 max-w-xs"
                            />
                          ) : (
                            <p className="text-sm font-medium">{profile.name}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <Label className="w-24 text-sm text-muted-foreground flex-shrink-0" htmlFor="phone-field">전화번호</Label>
                          {isEditing ? (
                            <Input
                              id="phone-field"
                              value={editForm.phone}
                              onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                              className="flex-1 max-w-xs"
                            />
                          ) : (
                            <p className="text-sm font-medium">{profile.phone || "미등록"}</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── 지원 현황 탭 ─────────────────────────────── */}
            {activeTab === "applications" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">지원 현황</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingApps ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : applications.length > 0 ? (
                    applications.map((app) => {
                      const cfg = statusConfig[app.status]
                      const StatusIcon = cfg?.icon || Clock
                      const initials = app.posting.company.name.charAt(0)
                      const date = new Date(app.applied_at || app.updated_at).toLocaleDateString("ko-KR")
                      return (
                        <Link href={`/jobs/${app.posting.id}`} key={app.id}>
                          <div className="flex items-center gap-4 rounded-xl border p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{app.posting.company.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{app.posting.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                            </div>
                            <Badge className={cn("text-xs border-0 flex items-center gap-1", cfg?.className ?? "bg-gray-100 text-gray-700")}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg?.label ?? app.status}
                            </Badge>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      아직 스크랩하거나 지원한 기업이 없습니다.
                    </p>
                  )}

                  <Link href="/jobs">
                    <Button variant="outline" className="w-full gap-2 mt-2">
                      기업 공고 보러가기
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* ── 내 커리큘럼 탭 ────────────────────────────── */}
            {activeTab === "curriculum" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base">내 커리큘럼</CardTitle>
                  <Link href="/curriculum">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" />
                      커리큘럼 상세
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {goalInfo ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        { label: "목표 직무", value: goalInfo.job_role },
                        { label: "학습 기간", value: `${goalInfo.duration_weeks}주` },
                        { label: "커리큘럼", value: goalInfo.has_curriculum ? "생성됨" : "미생성" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl bg-muted/50 p-3 text-center">
                          <p className="text-sm font-bold text-primary truncate">{stat.value}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      목표를 설정하면 커리큘럼이 생성됩니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── 작성한 글 탭 ─────────────────────────────── */}
            {activeTab === "posts" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">작성한 글</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="py-8 text-center space-y-3">
                    <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">작성한 글이 없습니다.</p>
                    <Link href="/board">
                      <Button variant="outline" size="sm" className="gap-2">
                        게시판 보러가기
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 계정 설정 탭 ─────────────────────────────── */}
            {activeTab === "settings" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">계정 설정</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pw-current">현재 비밀번호</Label>
                    <Input
                      id="pw-current"
                      type="password"
                      placeholder="현재 비밀번호 입력"
                      value={pwForm.current}
                      onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-next">새 비밀번호</Label>
                    <Input
                      id="pw-next"
                      type="password"
                      placeholder="새 비밀번호 (8자 이상)"
                      value={pwForm.next}
                      onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-confirm">새 비밀번호 확인</Label>
                    <Input
                      id="pw-confirm"
                      type="password"
                      placeholder="새 비밀번호 재입력"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                    />
                  </div>
                  {pwError && <p className="text-sm text-destructive">{pwError}</p>}
                  {pwSuccess && <p className="text-sm text-green-600">비밀번호가 변경되었습니다.</p>}
                  <Button
                    className="w-full"
                    onClick={handlePasswordChange}
                    disabled={isSavingPw || !pwForm.current || !pwForm.next || !pwForm.confirm}
                  >
                    {isSavingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    비밀번호 변경
                  </Button>

                  <div className="border-t pt-4 space-y-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={logout}
                    >
                      로그아웃
                    </Button>
                    <p className="text-sm font-medium text-destructive mb-2">위험 구역</p>
                    <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      회원 탈퇴
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}