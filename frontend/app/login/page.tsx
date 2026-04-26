// 로그인 페이지
// 시나리오: 로그인 성공 시
//   - 최초 로그인이면 → /goal-setting (목표 설정)
//   - 기존 사용자면 → /home (메인 페이지)
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

export default function LoginPage() {
  const router = useRouter()

  // ─── 상태 관리 ─────────────────────────────────────────────────────────────
  // [FE 수정 매뉴얼] 실제 API 연동 시 userId/password를 폼 submit 핸들러에서 사용
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // ─── 로그인 처리 ────────────────────────────────────────────────────────────
  // [BE 매뉴얼] POST /api/v1/auth/user/login
  //   Request Body: { user_id: string, password: string }
  //   Response: { access_token, refresh_token, is_first_login: boolean, user: { id, name, dept } }
  // [DB 매뉴얼] Users 테이블에서 user_id 조회 후 bcrypt 비밀번호 비교
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!userId || !password) {
      setErrorMsg("아이디와 비밀번호를 입력해주세요.")
      return
    }

    setIsLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      // const res = await fetch("/api/v1/auth/user/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ user_id: userId, password }),
      // })
      // const data = await res.json()
      // if (!res.ok) throw new Error(data.message)
      //
      // 토큰 저장
      // localStorage.setItem("access_token", data.access_token)
      // if (rememberMe) localStorage.setItem("refresh_token", data.refresh_token)
      //
      // 최초 로그인 여부 확인
      // if (data.is_first_login) router.push("/goal-setting")
      // else router.push("/home")

      // 임시: 바로 목표설정 페이지로 이동 (첫 로그인 시나리오 시뮬레이션)
      await new Promise((resolve) => setTimeout(resolve, 800))
      router.push("/goal-setting")
    } catch (err) {
      setErrorMsg("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 헤더 */}
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

      {/* 메인 콘텐츠 */}
      <main className="flex flex-1 items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">로그인</CardTitle>
            <CardDescription>ELAW 계정으로 로그인하세요</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {/* 오류 메시지 표시 */}
            {errorMsg && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            {/* 간편인증 버튼 */}
            {/* [FE 수정 매뉴얼] 간편인증 도입 시 OAuth URL로 리다이렉트 구현 */}
            <Button variant="outline" className="w-full gap-2" size="lg" type="button">
              <Smartphone className="h-4 w-4" />
              간편인증 (카카오/네이버)
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">또는 아이디로 로그인</span>
              </div>
            </div>

            {/* 로그인 폼 */}
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="user-id">아이디</Label>
                {/* [FE 수정 매뉴얼] value와 onChange로 제어 컴포넌트(controlled)로 구현됨 */}
                <Input
                  id="user-id"
                  placeholder="아이디를 입력하세요"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  autoComplete="username"
                />
              </div>

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
                  {/* 비밀번호 표시/숨기기 토글 */}
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* [FE 수정 매뉴얼] 로그인 유지 체크 시 refresh_token을 localStorage에 저장 */}
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
                  <Link href="#" className="hover:text-foreground hover:underline">아이디 찾기</Link>
                  <span>|</span>
                  <Link href="#" className="hover:text-foreground hover:underline">비밀번호 재설정</Link>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />로그인 중...</>
                  ) : (
                    "로그인"
                  )}
                </Button>
                <Link href="/register">
                  <Button type="button" variant="outline">회원가입</Button>
                </Link>
              </div>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              공용 PC에서는 <strong>로그인 상태 유지</strong> 사용을 권장하지 않습니다.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
