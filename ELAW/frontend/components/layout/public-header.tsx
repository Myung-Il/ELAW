/**
 * [컴포넌트] PublicHeader - 비로그인 상태(랜딩페이지) 헤더
 *
 * 역할: 로그인하지 않은 사용자가 보는 최상단 헤더입니다.
 *       우측에 '로그인', '회원가입' 버튼을 표시하며,
 *       로그인 후에는 AppHeader로 교체됩니다.
 *
 * 네비게이션 구성:
 *   - 학습 (#learning 앵커): 학과별 학습 섹션으로 스크롤
 *   - 취업 (#career 앵커): 기업 공고 섹션으로 스크롤
 *   - 대회/이벤트 (#events 앵커): 이벤트 섹션으로 스크롤
 *   - AI 커리큘럼 (#ai-curriculum 앵커): AI 커리큘럼 소개 섹션으로 스크롤
 *   - 게시판 (/board): 공개 게시판 페이지로 이동 (비로그인 열람 가능)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   - 소셜 로그인(카카오, 구글 등) 추가 시 우측 버튼 영역을 수정하세요.
 *   - 다국어 지원 시 Link의 href를 다이나믹하게 처리해야 합니다.
 *
 * [BE 매뉴얼]
 *   - 별도 API 호출 없음. 완전 정적 컴포넌트입니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GraduationCap, Menu, X, MessageSquare } from "lucide-react"
import { useState } from "react"

export default function PublicHeader() {
  /** 모바일 햄버거 메뉴 열림/닫힘 상태 */
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">

        {/* ── 로고 영역 ─────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary">ELAW</span>
        </Link>

        {/* ── 데스크탑 네비게이션 ──────────────────────────────────── */}
        {/* 각 링크는 랜딩페이지 섹션 앵커 또는 별도 페이지로 연결됩니다 */}
        <nav className="hidden items-center gap-6 md:flex">
          {/* 랜딩페이지 내 섹션 스크롤 앵커 링크 */}
          <Link
            href="#learning"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            학습
          </Link>
          <Link
            href="#career"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            취업
          </Link>
          <Link
            href="#events"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            대회/이벤트
          </Link>
          <Link
            href="#ai-curriculum"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            AI 커리큘럼
          </Link>

          {/* 게시판 탭: 비로그인 상태에서도 목록 열람 가능 */}
          {/* 개별 게시글 클릭 시에는 로그인 안내를 띄웁니다 (board/[id]/page.tsx 참고) */}
          <Link
            href="/board"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            게시판
          </Link>
        </nav>

        {/* ── 우측: 로그인 / 회원가입 버튼 ───────────────────────── */}
        {/* 로그인 후에는 AppHeader의 프로필 아이콘으로 대체됩니다 */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-medium">
              로그인
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="font-medium shadow-sm">
              회원가입
            </Button>
          </Link>
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
          <nav className="flex flex-col gap-3">
            <Link
              href="#learning"
              className="py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              학습
            </Link>
            <Link
              href="#career"
              className="py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              취업
            </Link>
            <Link
              href="#events"
              className="py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              대회/이벤트
            </Link>
            <Link
              href="#ai-curriculum"
              className="py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              AI 커리큘럼
            </Link>

            {/* 모바일에서도 게시판 접근 가능 */}
            <Link
              href="/board"
              className="flex items-center gap-2 py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <MessageSquare className="h-4 w-4" />
              게시판
            </Link>

            {/* 모바일 로그인/회원가입 버튼 */}
            <div className="flex gap-2 pt-2 border-t">
              <Link href="/login" className="flex-1" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" className="w-full" size="sm">로그인</Button>
              </Link>
              <Link href="/register" className="flex-1" onClick={() => setMenuOpen(false)}>
                <Button className="w-full" size="sm">회원가입</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
