// 비로그인 상태 헤더 컴포넌트 - 랜딩 페이지에서 사용
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GraduationCap, Menu, X } from "lucide-react"
import { useState } from "react"

export default function PublicHeader() {
  // 모바일 메뉴 열림/닫힘 상태
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary">ELAW</span>
        </Link>

        {/* 데스크탑 네비게이션 */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="#learning" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            학습
          </Link>
          <Link href="#career" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            취업
          </Link>
          <Link href="#events" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            대회/이벤트
          </Link>
          <Link href="#ai-curriculum" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            AI 커리큘럼
          </Link>
        </nav>

        {/* 로그인/회원가입 버튼 */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-medium">로그인</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="font-medium shadow-sm">회원가입</Button>
          </Link>
        </div>

        {/* 모바일 햄버거 메뉴 */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴 열기"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="border-t bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            <Link href="#learning" className="py-2 text-sm font-medium" onClick={() => setMenuOpen(false)}>학습</Link>
            <Link href="#career" className="py-2 text-sm font-medium" onClick={() => setMenuOpen(false)}>취업</Link>
            <Link href="#events" className="py-2 text-sm font-medium" onClick={() => setMenuOpen(false)}>대회/이벤트</Link>
            <Link href="#ai-curriculum" className="py-2 text-sm font-medium" onClick={() => setMenuOpen(false)}>AI 커리큘럼</Link>
            <div className="flex gap-2 pt-2 border-t">
              <Link href="/login" className="flex-1">
                <Button variant="outline" className="w-full" size="sm">로그인</Button>
              </Link>
              <Link href="/register" className="flex-1">
                <Button className="w-full" size="sm">회원가입</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
