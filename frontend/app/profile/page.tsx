"use client"

import { useState, useEffect } from "react"
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
import { api } from "@/lib/api"

const tabs = [
  { id: "overview",     label: "내 정보",     icon: User },
  { id: "applications", label: "지원 현황",   icon: Building2 },
  { id: "curriculum",   label: "내 커리큘럼", icon: GraduationCap },
  { id: "posts",        label: "작성한 글",   icon: MessageSquare },
  { id: "settings",     label: "계정 설정",   icon: Settings },
]

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  "applied":     { label: "지원 완료",    className: "bg-blue-100 text-blue-700",  icon: Clock },
  "scrapped":    { label: "스크랩",       className: "bg-gray-100 text-gray-700",  icon: Clock },
  "viewed":      { label: "열람",         className: "bg-yellow-100 text-yellow-700", icon: Clock },
  "recommended": { label: "추천",         className: "bg-green-100 text-green-700", icon: CheckCircle },
}

export default function ProfilePage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview")
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading]     = useState(true)

  const [profile, setProfile]     = useState<any>(null)
  const [dashboard, setDashboard] = useState<any>(null)
  const [editForm, setEditForm]   = useState({ phone: "", email: "" })
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const [profRes, dashRes] = await Promise.all([api.getProfile(), api.getDashboard()])
        if (profRes.ok) {
          const profData = await profRes.json()
          const p = profData.data || profData
          setProfile(p)
          setEditForm({ phone: p.phone || "", email: p.email || "" })
        }
        if (dashRes.ok) setDashboard(await dashRes.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaveLoading(true)
    setSaveError("")
    try {
      const res  = await api.updateProfile({ phone: editForm.phone })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "수정 실패")
      const p = data.data || data
      setProfile((prev: any) => ({ ...prev, ...p }))
      setIsEditing(false)
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaveLoading(false)
    }
  }

  const matches    = dashboard?.top_matches || []
  const goalData   = dashboard?.goal
  const solveStats = dashboard?.solve_stats || { total: 0, solved: 0, correct_rate: 0 }
  const weakTags   = dashboard?.weak_tags || []

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("ko-KR").replace(/\. /g, ".").replace(/\.$/, "")
    : "-"

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const userName = profile?.name || "사용자"

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">내 프로필</h1>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* ── 사이드바 ── */}
          <div className="space-y-4">
            <Card className="shadow-sm text-center">
              <CardContent className="p-6">
                <Avatar className="mx-auto mb-3 h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-bold text-lg">{userName}</p>
                <p className="text-sm text-muted-foreground">{profile?.role_display || profile?.role || "학생"}</p>
                {goalData?.job_role && (
                  <Badge variant="secondary" className="mt-2 text-xs">희망: {goalData.job_role}</Badge>
                )}
              </CardContent>
            </Card>

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

          {/* ── 콘텐츠 ── */}
          <div className="lg:col-span-3">

            {/* ── 내 정보 ── */}
            {activeTab === "overview" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base">기본 정보</CardTitle>
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={saveLoading}
                  >
                    {saveLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : isEditing
                        ? <><Save className="h-3.5 w-3.5" />저장</>
                        : <><Edit2 className="h-3.5 w-3.5" />수정</>
                    }
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {saveError && (
                    <p className="text-sm text-destructive">{saveError}</p>
                  )}
                  {[
                    { label: "이름",   value: profile?.name   || "-" },
                    { label: "이메일", value: profile?.email  || "-" },
                    { label: "역할",   value: profile?.role_display || profile?.role || "-" },
                    { label: "가입일", value: joinDate },
                  ].map((field) => (
                    <div key={field.label} className="flex items-center gap-4">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">{field.label}</Label>
                      <p className="text-sm font-medium">{field.value}</p>
                    </div>
                  ))}

                  <div className="border-t pt-4 space-y-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">수정 가능 정보</p>

                    <div className="flex items-center gap-4">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0" htmlFor="phone-field">전화번호</Label>
                      {isEditing ? (
                        <Input
                          id="phone-field"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                          className="flex-1 max-w-xs"
                        />
                      ) : (
                        <p className="text-sm font-medium">{editForm.phone || "-"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 지원 현황 (매칭 Top 결과) ── */}
            {activeTab === "applications" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">지원 현황</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {matches.length > 0 ? (
                    matches.map((m: any, i: number) => {
                      const status = statusConfig[m.status] || statusConfig["applied"]
                      const StatusIcon = status.icon
                      return (
                        <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                            {m.company.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{m.company}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.posting_title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">매칭 점수 {m.match_score}%</p>
                          </div>
                          <Badge className={cn("text-xs border-0 flex items-center gap-1", status.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                      )
                    })
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      아직 매칭 정보가 없습니다. 기업 공고 페이지에서 매칭 분석을 실행해주세요.
                    </p>
                  )}

                  <Link href="/jobs">
                    <Button variant="outline" className="w-full gap-2 mt-2">
                      기업 공고 보러가기<ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* ── 내 커리큘럼 ── */}
            {activeTab === "curriculum" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base">내 커리큘럼</CardTitle>
                  <Link href="/curriculum">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" />커리큘럼 상세
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
                    {[
                      { label: "해결 문제",  value: `${solveStats.solved}문제` },
                      { label: "정답률",     value: `${solveStats.correct_rate}%` },
                      { label: "목표 직무",  value: goalData?.job_role || "-" },
                      { label: "학습 분야",  value: goalData?.field || "-" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-muted/50 p-3 text-center">
                        <p className="text-lg font-bold text-primary truncate">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {weakTags.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">취약 태그</p>
                      {weakTags.map((tag: any) => (
                        <div key={tag.stat_key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{tag.stat_key}</span>
                            <span className="font-semibold text-destructive">{Math.round(tag.correct_rate || 0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-destructive/60"
                              style={{ width: `${tag.correct_rate || 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── 작성한 글 ── */}
            {activeTab === "posts" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">작성한 글</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="py-8 text-center text-sm text-muted-foreground">작성한 글이 없습니다.</p>
                  <Link href="/board">
                    <Button variant="outline" className="w-full gap-2">
                      게시판 보러가기<ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* ── 계정 설정 ── */}
            {activeTab === "settings" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">계정 설정</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>현재 비밀번호</Label>
                    <Input type="password" placeholder="현재 비밀번호 입력" />
                  </div>
                  <div className="space-y-2">
                    <Label>새 비밀번호</Label>
                    <Input type="password" placeholder="새 비밀번호 (8자 이상)" />
                  </div>
                  <div className="space-y-2">
                    <Label>새 비밀번호 확인</Label>
                    <Input type="password" placeholder="새 비밀번호 재입력" />
                  </div>
                  <Button className="w-full">비밀번호 변경</Button>

                  <div className="border-t pt-4">
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
