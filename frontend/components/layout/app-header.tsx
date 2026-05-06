// 로그인 후 상태 헤더 컴포넌트 - 인증된 사용자 전용
// 우측 상단에 프로필 아이콘 표시, 로그인/회원가입 버튼 대체
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
} from "lucide-react"
import { useState } from "react"

// 네비게이션 메뉴 항목 정의
const navItems = [
  { href: "/home", label: "홈", icon: LayoutDashboard },
  { href: "/jobs", label: "기업공고", icon: Building2 },
  { href: "/curriculum", label: "커리큘럼", icon: GraduationCap },
  { href: "/study", label: "공부목록", icon: BookOpen },
  { href: "/board", label: "게시판", icon: MessageSquare },
]

interface AppHeaderProps {
  // [FE 수정 매뉴얼] 실제 로그인 구현 시 user 객체를 전달받아야 합니다
  // [BE 매뉴얼] GET /api/v1/auth/me - 현재 로그인한 사용자 정보 반환
  userName?: string
  userDept?: string
  notificationCount?: number
}

export default function AppHeader({
  userName = "홍길동",
  userDept = "컴퓨터공학과",
  notificationCount = 3,
}: AppHeaderProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        {/* 로고 */}
        <Link href="/home" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary">ELAW</span>
        </Link>

        {/* 데스크탑 네비게이션 */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
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

        {/* 우측: 알림 + 프로필 */}
        <div className="hidden items-center gap-2 md:flex">
          {/* 알림 버튼 */}
          {/* [FE 수정 매뉴얼] notificationCount는 BE API로부터 받아와야 합니다 */}
          {/* [BE 매뉴얼] GET /api/v1/notifications/unread-count */}
          <Button variant="ghost" size="icon" className="relative" aria-label="알림">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {notificationCount}
              </Badge>
            )}
          </Button>

          {/* 프로필 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 rounded-full px-2" aria-label="프로필 메뉴">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left lg:block">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{userDept}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userDept}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
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
                  <Building2 className="h-4 w-4" />
                  지원 현황
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile?tab=settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  계정 설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* [FE 수정 매뉴얼] 로그아웃 시 토큰 제거 후 / 로 리다이렉트 */}
              {/* [BE 매뉴얼] POST /api/v1/auth/logout - 서버 세션/토큰 무효화 */}
              <DropdownMenuItem asChild>
                <Link href="/" className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 모바일 메뉴 버튼 */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {menuOpen && (
        <div className="border-t bg-white px-4 py-4 md:hidden">
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
            <div className="pt-2 border-t mt-2">
              <Link href="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted" onClick={() => setMenuOpen(false)}>
                <User className="h-4 w-4 text-muted-foreground" />
                내 프로필
              </Link>
              <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10" onClick={() => setMenuOpen(false)}>
                <LogOut className="h-4 w-4" />
                로그아웃
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
