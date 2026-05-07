// ═══════════════════════════════════════════════════════════════════════════
// 프로필 페이지  (/profile)
// ───────────────────────────────────────────────────────────────────────────
// - 로그인한 사용자만 접근 가능
// - URL 쿼리 파라미터 ?tab=... 로 초기 탭 지정 가능
//   예: /profile?tab=applications → 지원 현황 탭 바로 열림
//   예: /profile?tab=posts → 작성한 글 탭 바로 열림 (app-header 드롭다운에서 직접 이동)
// - 탭 구성: 내 정보 / 지원 현황 / 내 커리큘럼 / 작성한 글 / 계정 설정
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
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
  Edit2, Save, CheckCircle, Clock, XCircle, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// 사이드바 탭 정의
// [FE 수정 매뉴얼] 탭 추가 시 이 배열에 항목 추가 + 아래 콘텐츠 영역에 조건부 렌더링 추가
const tabs = [
  { id: "overview", label: "내 정보", icon: User },
  { id: "applications", label: "지원 현황", icon: Building2 },
  { id: "curriculum", label: "내 커리큘럼", icon: GraduationCap },
  { id: "posts", label: "작성한 글", icon: MessageSquare },
  { id: "settings", label: "계정 설정", icon: Settings },
]

// ─── 더미 데이터 ──────────────────────────────────────────────────────────
// [FE 수정 매뉴얼] 아래 userInfo를 GET /api/v1/users/me 응답으로 교체
// [BE 매뉴얼] GET /api/v1/users/me
//   헤더: Authorization: Bearer {accessToken}
//   Response: {
//     id, name, userId, dept, year, phone, email, joinDate, goal,
//     applications: [...], posts: [...]
//   }
//   - 프로필 데이터 + 지원 현황 + 작성한 글을 한 번에 응답하면 API 호출 횟수 절약
//   - 또는 각 탭 진입 시 개별 API 호출 (Lazy Loading 방식)
// [DB 매뉴얼] Users 테이블: id, user_id(unique), name, phone, email, dept, year, join_date
//             UserGoals 테이블: user_id, job_goal_name (목표 직무)
const userInfo = {
  name: "홍길동",
  userId: "hong**",
  dept: "컴퓨터공학과",
  year: "3학년",
  phone: "010-****-1234",
  email: "hong@example.com",
  joinDate: "2024.09.01",
  goal: "소프트웨어 개발",
}

// 지원 현황 더미 데이터
// [FE 수정 매뉴얼] GET /api/v1/users/applications 로 교체
// [BE 매뉴얼] GET /api/v1/users/applications
//   Response: { applications: [{ id, company, position, status, appliedAt, logo, color }] }
// [DB 매뉴얼] Applications 테이블: id, user_id(FK), company_id(FK), position, status, applied_at
//   Companies 테이블: id, name, logo_char, logo_color
const applications = [
  { id: 1, company: "삼성전자", position: "SW 개발 신입", status: "서류 검토 중", date: "2025.04.20", logo: "S", color: "bg-blue-500" },
  { id: 2, company: "카카오", position: "서버 개발 인턴", status: "합격", date: "2025.03.15", logo: "K", color: "bg-yellow-500" },
  { id: 3, company: "네이버", position: "AI 연구 개발", status: "불합격", date: "2025.02.10", logo: "N", color: "bg-green-500" },
]

// 지원 상태별 스타일 및 아이콘 설정
const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  "서류 검토 중": { label: "서류 검토 중", className: "bg-blue-100 text-blue-700", icon: Clock },
  "합격": { label: "합격", className: "bg-green-100 text-green-700", icon: CheckCircle },
  "불합격": { label: "불합격", className: "bg-red-100 text-red-700", icon: XCircle },
}

// 내가 작성한 글 더미 데이터
// [FE 수정 매뉴얼] GET /api/v1/users/posts 로 교체
// [BE 매뉴얼] GET /api/v1/users/posts
//   Response: { posts: [{ id, title, category, createdAt, views, likes }] }
// [DB 매뉴얼] BoardPosts 테이블에서 author_id = 현재 로그인 사용자 ID 조건으로 SELECT
const myPosts = [
  { id: 3, title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?", category: "QnA", date: "2025.04.24", views: 342 },
  { id: 7, title: "알고리즘 스터디원 모집합니다", category: "QnA", date: "2025.03.10", views: 128 },
]

export default function ProfilePage() {
  // URL 쿼리 파라미터 ?tab=... 로 초기 탭 결정 (없으면 "overview")
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") || "overview"
  const [activeTab, setActiveTab] = useState(initialTab)

  // 개인정보 수정 모드 상태 (내 정보 탭)
  const [isEditing, setIsEditing] = useState(false)

  // 수정 가능한 필드 폼 상태 (전화번호, 이메일)
  const [editForm, setEditForm] = useState({
    phone: userInfo.phone,
    email: userInfo.email,
  })

  // ─── 개인정보 저장 핸들러 ────────────────────────────────────────────────
  // [FE 수정 매뉴얼] 실제 API 호출로 교체 필요
  // [BE 매뉴얼] PUT /api/v1/users/me
  //   헤더: Authorization: Bearer {accessToken}
  //   Request Body: { phone: string, email: string }
  //   Response: { success: true, user: { ...updatedFields } }
  // [DB 매뉴얼] Users 테이블 UPDATE SET phone=?, email=? WHERE id=?
  const handleSave = () => {
    setIsEditing(false)
    // TODO: API 저장 호출 후 성공 알림 표시
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">내 프로필</h1>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* ── 좌측 사이드바: 사용자 카드 + 탭 메뉴 ───────────────────── */}
          <div className="space-y-4">
            {/* 사용자 정보 카드 */}
            {/* [FE 수정 매뉴얼] userInfo를 GET /api/v1/users/me 응답으로 교체 */}
            <Card className="shadow-sm text-center">
              <CardContent className="p-6">
                <Avatar className="mx-auto mb-3 h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {userInfo.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-bold text-lg">{userInfo.name}</p>
                <p className="text-sm text-muted-foreground">{userInfo.dept}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{userInfo.year}</p>
                <Badge variant="secondary" className="mt-2 text-xs">
                  희망: {userInfo.goal}
                </Badge>
              </CardContent>
            </Card>

            {/* 탭 메뉴 네비게이션 */}
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

          {/* ── 우측 콘텐츠 영역 (탭에 따라 다른 내용 표시) ──────────────── */}
          <div className="lg:col-span-3">

            {/* ── [내 정보] 탭 ───────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-base">기본 정보</CardTitle>
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  >
                    {isEditing ? <><Save className="h-3.5 w-3.5" />저장</> : <><Edit2 className="h-3.5 w-3.5" />수정</>}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 수정 불가 필드 (이름, 아이디, 학과, 학년, 가입일) */}
                  {[
                    { label: "이름", value: userInfo.name },
                    { label: "아이디", value: userInfo.userId },
                    { label: "학과", value: userInfo.dept },
                    { label: "학년", value: userInfo.year },
                    { label: "가입일", value: userInfo.joinDate },
                  ].map((field) => (
                    <div key={field.label} className="flex items-center gap-4">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">{field.label}</Label>
                      <p className="text-sm font-medium">{field.value}</p>
                    </div>
                  ))}

                  {/* 수정 가능한 필드 구역 */}
                  <div className="border-t pt-4 space-y-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">수정 가능 정보</p>

                    {/* 전화번호 필드 */}
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
                        <p className="text-sm font-medium">{editForm.phone}</p>
                      )}
                    </div>

                    {/* 이메일 필드 */}
                    <div className="flex items-center gap-4">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0" htmlFor="email-field">이메일</Label>
                      {isEditing ? (
                        <Input
                          id="email-field"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                          className="flex-1 max-w-xs"
                        />
                      ) : (
                        <p className="text-sm font-medium">{editForm.email}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── [지원 현황] 탭 ────────────────────────────────────────── */}
            {/* [FE 수정 매뉴얼] applications 배열을 GET /api/v1/users/applications 로 교체 */}
            {activeTab === "applications" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">지원 현황</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {applications.length > 0 ? (
                    applications.map((app) => {
                      const status = statusConfig[app.status]
                      const StatusIcon = status?.icon || Clock
                      return (
                        <div key={app.id} className="flex items-center gap-4 rounded-xl border p-4">
                          {/* 기업 로고 */}
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${app.color} text-white font-bold text-sm flex-shrink-0`}>
                            {app.logo}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{app.company}</p>
                            <p className="text-xs text-muted-foreground truncate">{app.position}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{app.date} 지원</p>
                          </div>
                          {/* 상태 뱃지 */}
                          <Badge className={cn("text-xs border-0 flex items-center gap-1", status?.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {app.status}
                          </Badge>
                        </div>
                      )
                    })
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      아직 지원한 기업이 없습니다.
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

            {/* ── [내 커리큘럼] 탭 ─────────────────────────────────────── */}
            {/* [FE 수정 매뉴얼] 통계 데이터를 GET /api/v1/curriculum/me 응답으로 교체 */}
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
                  {/* 커리큘럼 요약 통계 */}
                  <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
                    {[
                      { label: "전체 진행", value: "29%" },
                      { label: "완료 주차", value: "3/12주" },
                      { label: "해결 문제", value: "121문제" },
                      { label: "목표 직무", value: "SW 개발" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-muted/50 p-3 text-center">
                        <p className="text-lg font-bold text-primary">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* 과목별 진행률 바 */}
                  <div className="space-y-3">
                    {[
                      { name: "자료구조", progress: 85 },
                      { name: "알고리즘", progress: 62 },
                      { name: "운영체제", progress: 45 },
                      { name: "데이터베이스", progress: 28 },
                    ].map((subj) => (
                      <div key={subj.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{subj.name}</span>
                          <span className="font-semibold text-primary">{subj.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${subj.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── [작성한 글] 탭 ────────────────────────────────────────── */}
            {/* [FE 수정 매뉴얼] myPosts 배열을 GET /api/v1/users/posts 로 교체 */}
            {activeTab === "posts" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">작성한 글</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {myPosts.length > 0 ? (
                    myPosts.map((post) => (
                      <Link href={`/board/${post.id}`} key={post.id}>
                        <div className="flex items-center gap-3 rounded-xl border p-3 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                          <Badge variant="secondary" className="text-xs flex-shrink-0">{post.category}</Badge>
                          <p className="flex-1 text-sm font-medium truncate group-hover:text-primary transition-colors">{post.title}</p>
                          <div className="text-xs text-muted-foreground flex-shrink-0">
                            {post.date} · 조회 {post.views}
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">작성한 글이 없습니다.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── [계정 설정] 탭 ────────────────────────────────────────── */}
            {activeTab === "settings" && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">계정 설정</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 비밀번호 변경 폼 */}
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

                  {/* [BE 매뉴얼] PUT /api/v1/users/me/password
                      Request: { currentPassword, newPassword }
                      Response: { success: true }
                      - 현재 비밀번호 검증 후 bcrypt hash로 저장 */}
                  <Button className="w-full">비밀번호 변경</Button>

                  {/* 위험 구역: 회원 탈퇴 */}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-destructive mb-2">위험 구역</p>
                    {/* [BE 매뉴얼] DELETE /api/v1/users/me
                        - 사용자 데이터 soft delete (deleted_at 설정) 또는 hard delete
                        - 탈퇴 전 비밀번호 재확인 모달 구현 권장 */}
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