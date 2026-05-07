/**
 * [페이지] 로그인 페이지 (/login)
 *
 * 시나리오:
 *   1. 아이디 + 비밀번호 입력 후 [로그인] 클릭
 *   2. API 호출 (현재는 더미 처리)
 *   3. 응답의 is_first_login 값에 따라:
 *      - 최초 로그인 → /goal-setting (목표 설정 페이지)
 *      - 기존 사용자 → /home (메인 페이지)
 *
 * 부가 기능:
 *   - 비밀번호 표시/숨기기 토글
 *   - 로그인 상태 유지 (rememberMe)
 *   - 간편인증 버튼 (카카오/네이버 - 추후 구현)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   handleLogin 함수 안의 임시 코드를 실제 API 호출로 교체하세요.
 *   로그인 성공 후 saveAuthState()를 반드시 호출해야 useAuth() 훅이 정상 동작합니다.
 *
 * [BE 매뉴얼]
 *   POST /api/v1/auth/user/login
 *     Request Body: { user_id: string, password: string }
 *     Response (성공): {
 *       access_token: string,    // JWT 액세스 토큰 (유효기간 30분 권장)
 *       refresh_token: string,   // 리프레시 토큰 (유효기간 7일 권장)
 *       is_first_login: boolean, // true면 목표설정 페이지로 이동
 *       user: { id, name, dept }
 *     }
 *     Response (실패): { message: "아이디 또는 비밀번호가 일치하지 않습니다." }
 *
 * [DB 매뉴얼]
 *   Users 테이블에서 user_id로 사용자 조회:
 *     SELECT * FROM users WHERE user_id = ?
 *   bcrypt.compare(inputPassword, users.password_hash)로 비밀번호 검증
 *   is_first_login: UserGoals 테이블에 해당 user_id의 레코드가 없으면 true
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { GraduationCap, Smartphone, Eye, EyeOff, Loader2 } from "lucide-react"
import { saveAuthState } from "@/hooks/use-auth"

export default function LoginPage() {
  const router = useRouter()

  // ─── 폼 입력 상태 ───────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  /** 비밀번호 입력 필드의 표시/숨김 토글 상태 */
  const [showPassword, setShowPassword] = useState(false)
  /** 로그인 상태 유지 여부 (체크 시 refresh_token을 localStorage에 보관) */
  const [rememberMe, setRememberMe] = useState(false)
  /** API 호출 중 로딩 스피너 표시용 */
  const [isLoading, setIsLoading] = useState(false)
  /** 로그인 실패 시 에러 메시지 */
  const [errorMsg, setErrorMsg] = useState("")

  // ─── 로그인 핸들러 ──────────────────────────────────────────────────────────
  /**
   * 로그인 폼 제출 처리
   *
   * 현재 흐름 (더미):
   *   1. 입력값 유효성 검사
   *   2. 800ms 딜레이 (API 호출 시뮬레이션)
   *   3. 인증 상태를 localStorage에 저장
   *   4. 최초 로그인 시나리오: /goal-setting으로 이동
   *
   * [FE 수정 매뉴얼] 아래 TODO 블록을 실제 API 호출로 교체하세요.
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    // 클라이언트 유효성 검사: 빈 값 체크
    if (!userId || !password) {
      setErrorMsg("아이디와 비밀번호를 입력해주세요.")
      return
    }

    setIsLoading(true)
    try {
      // ─── TODO: 실제 API 호출로 교체 ─────────────────────────────────────────
      // const res = await fetch("/api/v1/auth/user/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ user_id: userId, password }),
      // })
      // if (!res.ok) {
      //   const data = await res.json()
      //   throw new Error(data.message || "로그인에 실패했습니다.")
      // }
      // const data = await res.json()
      //
      // 인증 정보 저장 (useAuth 훅에서 읽어 사용)
      // saveAuthState(data.user.name, data.user.dept, data.access_token)
      //
      // 로그인 상태 유지 옵션: rememberMe가 true면 refresh_token도 저장
      // if (rememberMe) localStorage.setItem("refresh_token", data.refresh_token)
      //
      // 최초 로그인이면 목표 설정 페이지, 아니면 메인으로
      // router.push(data.is_first_login ? "/goal-setting" : "/home")
      // ────────────────────────────────────────────────────────────────────────

      // 임시: 더미 로그인 처리 (API 연동 전)
      await new Promise((resolve) => setTimeout(resolve, 800))

      // 인증 상태 저장 (이 코드가 있어야 useAuth() 훅이 로그인 상태를 인식합니다)
      saveAuthState("홍길동", "컴퓨터공학과")

      // 최초 로그인 시나리오 시뮬레이션 → 목표 설정 페이지
      // [FE 수정 매뉴얼] 실제로는 API 응답의 is_first_login 값으로 판단해야 합니다
      router.push("/goal-setting")
    } catch (err) {
      setErrorMsg("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── 로고 헤더 ──────────────────────────────────────────────── */}
      {/* 로그인/회원가입 페이지에서는 간소화된 헤더 사용 (PublicHeader 미사용) */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">ELAW</span>
          </Link>
        </div>
      </header>

      {/* ── 메인 콘텐츠 영역 ─────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">로그인</CardTitle>
            <CardDescription>ELAW 계정으로 로그인하세요</CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-5">
            {/* 에러 메시지 표시 영역 */}
            {errorMsg && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            {/* 간편인증 버튼 */}
            {/* [FE 수정 매뉴얼] 카카오/네이버 OAuth 도입 시 각 플랫폼 인증 URL로 리다이렉트 구현 */}
            {/* [BE 매뉴얼] GET /api/v1/auth/kakao → 카카오 OAuth 인증 시작 URL 반환 */}
            <Button variant="outline" className="w-full gap-2" size="lg" type="button">
              <Smartphone className="h-4 w-4" />
              간편인증 (카카오/네이버)
            </Button>

            {/* 구분선 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">또는 아이디로 로그인</span>
              </div>
            </div>

            {/* ── 로그인 폼 ─────────────────────────────────────────── */}
            <form className="space-y-4" onSubmit={handleLogin}>
              {/* 아이디 입력 */}
              <div className="space-y-2">
                <Label htmlFor="user-id">아이디</Label>
                <Input
                  id="user-id"
                  placeholder="아이디를 입력하세요"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  autoComplete="username"
                />
              </div>

              {/* 비밀번호 입력 (표시/숨기기 토글 포함) */}
              <div className="space-y-2">
                <Label htmlFor="user-password">비밀번호</Label>
                <div className="relative">
                  <Input
                    id="user-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  {/* 비밀번호 가시성 토글 버튼 */}
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 로그인 상태 유지 + 아이디/비밀번호 찾기 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* 로그인 상태 유지: 체크 시 refresh_token도 localStorage에 보관 */}
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(!!v)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    로그인 상태 유지
                  </Label>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {/* [FE 수정 매뉴얼] 아이디/비밀번호 찾기 기능 페이지 추가 필요 */}
                  <Link href="#" className="hover:text-foreground hover:underline">아이디 찾기</Link>
                  <span>|</span>
                  <Link href="#" className="hover:text-foreground hover:underline">비밀번호 재설정</Link>
                </div>
              </div>

              {/* 로그인 + 회원가입 버튼 */}
              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      로그인 중...
                    </>
                  ) : (
                    "로그인"
                  )}
                </Button>
                <Link href="/register">
                  <Button type="button" variant="outline">회원가입</Button>
                </Link>
              </div>
            </form>

            {/* 공용 PC 사용 주의 안내 */}
            <p className="text-center text-xs text-muted-foreground">
              공용 PC에서는 <strong>로그인 상태 유지</strong> 사용을 권장하지 않습니다.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
