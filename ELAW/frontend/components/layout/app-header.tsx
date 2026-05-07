/**
 * [컴포넌트] AppHeader - 로그인 후 상태 헤더 컴포넌트
 *
 * 역할: 로그인된 사용자 전용 최상단 헤더입니다.
 *       비로그인 상태의 PublicHeader와 달리, 우측에 '프로필' 드롭다운을 표시합니다.
 *
 * 네비게이션 구성:
 *   홈 | 기업공고 | 커리큘럼 | 공부목록 | 게시판
 *
 * 프로필 드롭다운 메뉴:
 *   - 내 프로필 (/profile)
 *   - 내 커리큘럼 (/profile?tab=curriculum)
 *   - 지원 현황 (/profile?tab=applications)
 *   - 계정 설정 (/profile?tab=settings)
 *   - 로그아웃 (→ / 로 이동)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   - userName, userDept, notificationCount를 API 응답으로 받아 props로 전달하거나
 *     내부에서 useAuth 훅을 통해 직접 가져오도록 변경하세요.
 *   - 알림(Bell) 클릭 시 알림 목록 사이드 패널(Drawer)을 열도록 구현 예정입니다.
 *
 * [BE 매뉴얼]
 *   - 사용자 정보: GET /api/v1/auth/me
 *       Response: { id, name, dept, avatar_url }
 *   - 알림 개수: GET /api/v1/notifications/unread-count
 *       Response: { count: number }
 *   - 로그아웃: POST /api/v1/auth/logout
 *       (서버 세션/리프레시 토큰 무효화)
 *
 * [DB 매뉴얼]
 *   - Users 테이블: id, name, dept, avatar_url
 *   - Notifications 테이블: id, user_id, is_read, created_at
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  GraduationCap,
  Building2,
  BookOpen,
  LayoutDashboard,
  MessageSquare,
  Bell,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Briefcase,
} from "lucide-react"
import { useState } from "react"
import { clearAuthState } from "@/hooks/use-auth"

/** 인증된 사용자용 네비게이션 항목 정의 */
const navItems = [
  { href: "/home", label: "홈", icon: LayoutDashboard },
  { href: "/jobs", label: "기업공고", icon: Building2 },
  { href: "/curriculum", label: "커리큘럼", icon: GraduationCap },
  { href: "/study", label: "공부목록", icon: BookOpen },
  { href: "/board", label: "게시판", icon: MessageSquare },
]

interface AppHeaderProps {
  /**
   * 로그인된 사용자 이름
   * [FE 수정 매뉴얼] 실제 운영 시 useAuth() 훅 또는 props로 전달받으세요.
   */
  userName?: string
  /** 로그인된 사용자 학과 */
  userDept?: string
  /**
   * 읽지 않은 알림 개수
   * [BE 매뉴얼] GET /api/v1/notifications/unread-count 로 폴링하거나 WebSocket으로 수신
   */
  notificationCount?: number
}

export default function AppHeader({
  userName = "홍길동",
  userDept = "컴퓨터공학과",
  notificationCount = 3,
}: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  /** 모바일 메뉴 열림/닫힘 상태 */
  const [menuOpen, setMenuOpen] = useState(false)

  /**
   * 로그아웃 처리 함수
   *
   * [FE 수정 매뉴얼] 실제 운영 시 로그아웃 API 호출 후 토큰 제거:
   *   await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" })
   *   clearAuthState()
   *   router.push("/")
   *
   * [BE 매뉴얼] POST /api/v1/auth/logout
   *   - 리프레시 토큰 블랙리스트 추가 또는 세션 삭제
   *   - Response: { success: true }
   */
  const handleLogout = () => {
    clearAuthState() // localStorage에서 인증 정보 제거
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">

        {/* ── 로고 ─────────────────────────────────────────────────── */}
        <Link href="/home" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary">ELAW</span>
        </Link>

        {/* ── 데스크탑 네비게이션 ──────────────────────────────────── */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            // 현재 활성 페이지 강조 처리
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ── 우측: 알림 + 프로필 드롭다운 ────────────────────────── */}
        <div className="hidden items-center gap-2 md:flex">

          {/* 알림 벨 버튼 */}
          {/* [FE 수정 매뉴얼] 클릭 시 알림 목록 사이드패널을 열도록 구현 예정 */}
          <Button variant="ghost" size="icon" className="relative" aria-label="알림">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {notificationCount}
              </Badge>
            )}
          </Button>

          {/* 프로필 드롭다운 메뉴 */}
          {/* 드롭다운 항목: 내 프로필, 내 커리큘럼, 지원 현황, 계정 설정, 로그아웃 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 rounded-full px-2"
                aria-label="프로필 메뉴 열기"
              >
                <Avatar className="h-8 w-8">
                  {/* [FE 수정 매뉴얼] 사용자 프로필 이미지 있으면 AvatarImage 사용 */}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {/* 데스크탑 대형 화면에서만 이름/학과 표시 */}
                <div className="hidden text-left lg:block">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{userDept}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              {/* 프로필 헤더 */}
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userDept}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* 프로필 메뉴 항목들 */}
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  내 프로필
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/profile?tab=curriculum" className="flex items-center gap-2 cursor-pointer">
                  <GraduationCap className="h-4 w-4" />
                  내 커리큘럼
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/profile?tab=applications" className="flex items-center gap-2 cursor-pointer">
                  <Briefcase className="h-4 w-4" />
                  지원 현황
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/profile?tab=posts" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  작성한 글
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/profile?tab=settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  계정 설정
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* 로그아웃 버튼 - 클릭 시 인증 정보 초기화 후 랜딩페이지로 이동 */}
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── 모바일 햄버거 메뉴 버튼 ─────────────────────────────── */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── 모바일 드롭다운 메뉴 ─────────────────────────────────── */}
      {menuOpen && (
        <div className="border-t bg-white px-4 py-4 md:hidden">
          {/* 모바일 사용자 정보 */}
          <div className="mb-4 flex items-center gap-3 pb-4 border-b">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {userName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{userName}</p>
              <p className="text-xs text-muted-foreground">{userDept}</p>
            </div>
          </div>

          {/* 모바일 네비게이션 링크 */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                onClick={() => setMenuOpen(false)}
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </Link>
            ))}

            {/* 모바일 프로필/로그아웃 */}
            <div className="pt-2 border-t mt-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                내 프로필
              </Link>
              <button
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
