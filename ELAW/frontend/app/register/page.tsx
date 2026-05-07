// ═══════════════════════════════════════════════════════════════════════════
// 회원가입 페이지  (/register)
// ───────────────────────────────────────────────────────────────────────────
// - 비로그인 사용자 전용 (로그인 후 방문 시 /home 으로 리다이렉트 권장)
// - 가입 완료 후 → /login 으로 이동 (2초 딜레이 + 성공 화면 표시)
// - 필수 필드: 이름, 전화번호, 아이디, 비밀번호(확인), 이용약관/개인정보 동의
// - 선택 필드: 이메일, 마케팅 수신 동의
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { GraduationCap, Loader2, CheckCircle2 } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // ─── 회원가입 폼 상태 ────────────────────────────────────────────────────
  // [DB 매뉴얼] Users 테이블 컬럼과 1:1 대응:
  //   name → name, phone → phone, userId → user_id(unique), password → password_hash(bcrypt)
  //   email → email(nullable), agree_marketing → marketing_agreed(boolean)
  const [userForm, setUserForm] = useState({
    name: "",
    phone: "",
    userId: "",
    password: "",
    passwordConfirm: "",
    email: "",
    agreeTerms: false,
    agreePrivacy: false,
    agreeMarketing: false,
    agreeAll: false,
  })

  // 필드별 유효성 오류 메시지 상태
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ─── 전체 동의 체크박스 핸들러 ──────────────────────────────────────────
  // 전체 동의 체크 시 하위 3개 항목 모두 동기화
  const handleAgreeAll = (checked: boolean) => {
    setUserForm((prev) => ({
      ...prev,
      agreeAll: checked,
      agreeTerms: checked,
      agreePrivacy: checked,
      agreeMarketing: checked,
    }))
  }

  // ─── 회원가입 제출 핸들러 ────────────────────────────────────────────────
  // [FE 수정 매뉴얼] setTimeout 시뮬레이션 → 실제 fetch API 호출로 교체
  // [BE 매뉴얼] POST /api/v1/auth/register
  //   Content-Type: application/json
  //   Request Body: {
  //     name: string,
  //     phone: string (형식: 01012345678 또는 010-1234-5678),
  //     user_id: string (6~20자, 영문+숫자),
  //     password: string (8자 이상, 서버에서 bcrypt hash 저장),
  //     email: string | null,
  //     agree_marketing: boolean
  //   }
  //   Response 성공: { success: true, user_id: string }
  //   Response 실패: { success: false, error: "DUPLICATE_USER_ID" | "INVALID_PHONE" | ... }
  // [DB 매뉴얼] Users 테이블 INSERT:
  //   - user_id는 UNIQUE 제약 조건 → 중복 시 409 Conflict 반환
  //   - password는 반드시 bcrypt (또는 argon2)로 해싱 후 저장 (평문 저장 절대 금지)
  //   - created_at은 DEFAULT CURRENT_TIMESTAMP
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // 클라이언트 측 유효성 검사
    const newErrors: Record<string, string> = {}
    if (!userForm.name) newErrors.name = "이름을 입력해주세요"
    if (!userForm.phone) newErrors.phone = "전화번호를 입력해주세요"
    if (!userForm.userId) newErrors.userId = "아이디를 입력해주세요"
    if (userForm.password.length < 8) newErrors.password = "비밀번호는 8자 이상이어야 합니다"
    if (userForm.password !== userForm.passwordConfirm) newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다"
    if (!userForm.agreeTerms) newErrors.agreeTerms = "이용약관에 동의해주세요"
    if (!userForm.agreePrivacy) newErrors.agreePrivacy = "개인정보 처리방침에 동의해주세요"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      // const res = await fetch("/api/v1/auth/register", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     name: userForm.name,
      //     phone: userForm.phone,
      //     user_id: userForm.userId,
      //     password: userForm.password,
      //     email: userForm.email || null,
      //     agree_marketing: userForm.agreeMarketing,
      //   }),
      // })
      // const data = await res.json()
      // if (!res.ok) throw new Error(data.error)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsSuccess(true)
      // 2초 후 로그인 페이지로 이동
      setTimeout(() => router.push("/login"), 2000)
    } catch (err) {
      setErrors({ submit: "회원가입에 실패했습니다. 다시 시도해주세요." })
    } finally {
      setIsLoading(false)
    }
  }

  // ─── 가입 성공 화면 ───────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">가입이 완료되었습니다!</h2>
          <p className="text-muted-foreground">로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── 심플 헤더 (로그인/회원가입 페이지 전용 헤더) ───────────────────── */}
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

      {/* ── 회원가입 폼 ─────────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
            <CardDescription>ELAW에 오신 것을 환영합니다</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {/* 서버 오류 메시지 */}
            {errors.submit && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {errors.submit}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleRegister}>

              {/* ── 기본 정보 섹션 ─────────────────────────────────────── */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">기본 정보</h3>

                {/* 이름 */}
                <div className="space-y-2">
                  <Label htmlFor="name">이름 <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    placeholder="이름을 입력하세요"
                    value={userForm.name}
                    onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                {/* 전화번호 + SMS 인증 버튼 */}
                <div className="space-y-2">
                  <Label htmlFor="phone">전화번호 <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      placeholder="010-0000-0000"
                      value={userForm.phone}
                      onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
                      className="flex-1"
                    />
                    {/* [FE 수정 매뉴얼] 인증 버튼 클릭 시 SMS 발송 API 호출 + 인증번호 입력 필드 표시 */}
                    {/* [BE 매뉴얼] POST /api/v1/auth/send-sms-code
                        Request: { phone: string }
                        Response: { success: true, expiresIn: 180 } (3분 유효)
                        - 인증 코드는 서버 세션/Redis에 저장 (DB 저장 불필요) */}
                    <Button type="button" variant="outline" className="flex-shrink-0">
                      인증 요청
                    </Button>
                  </div>
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
              </div>

              {/* ── 계정 정보 섹션 ─────────────────────────────────────── */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">계정 정보</h3>

                {/* 아이디 */}
                <div className="space-y-2">
                  <Label htmlFor="reg-userId">아이디 <span className="text-destructive">*</span></Label>
                  <Input
                    id="reg-userId"
                    placeholder="영문, 숫자 조합 6~20자"
                    value={userForm.userId}
                    onChange={(e) => setUserForm((p) => ({ ...p, userId: e.target.value }))}
                    autoComplete="username"
                  />
                  {errors.userId && <p className="text-xs text-destructive">{errors.userId}</p>}
                </div>

                {/* 비밀번호 */}
                <div className="space-y-2">
                  <Label htmlFor="reg-password">비밀번호 <span className="text-destructive">*</span></Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="8자 이상, 영문+숫자+특수문자"
                    value={userForm.password}
                    onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                {/* 비밀번호 확인 */}
                <div className="space-y-2">
                  <Label htmlFor="reg-passwordConfirm">비밀번호 확인 <span className="text-destructive">*</span></Label>
                  <Input
                    id="reg-passwordConfirm"
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={userForm.passwordConfirm}
                    onChange={(e) => setUserForm((p) => ({ ...p, passwordConfirm: e.target.value }))}
                    autoComplete="new-password"
                  />
                  {errors.passwordConfirm && <p className="text-xs text-destructive">{errors.passwordConfirm}</p>}
                </div>

                {/* 이메일 (선택) */}
                <div className="space-y-2">
                  <Label htmlFor="reg-email">이메일 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="example@email.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>

              {/* ── 약관 동의 섹션 ─────────────────────────────────────── */}
              <div className="space-y-3 pt-2 border-t">
                {/* 전체 동의 */}
                <div className="flex items-center gap-2 py-1">
                  <Checkbox
                    id="agree-all"
                    checked={userForm.agreeAll}
                    onCheckedChange={(v) => handleAgreeAll(!!v)}
                  />
                  <Label htmlFor="agree-all" className="font-semibold cursor-pointer">전체 동의</Label>
                </div>
                {/* 개별 동의 항목 */}
                <div className="pl-6 space-y-2 border-l-2 border-muted ml-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="agree-terms"
                      checked={userForm.agreeTerms}
                      onCheckedChange={(v) => setUserForm((p) => ({ ...p, agreeTerms: !!v }))}
                    />
                    <Label htmlFor="agree-terms" className="text-sm cursor-pointer">
                      <span className="text-destructive">[필수]</span> 이용약관 동의
                    </Label>
                  </div>
                  {errors.agreeTerms && <p className="text-xs text-destructive pl-6">{errors.agreeTerms}</p>}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="agree-privacy"
                      checked={userForm.agreePrivacy}
                      onCheckedChange={(v) => setUserForm((p) => ({ ...p, agreePrivacy: !!v }))}
                    />
                    <Label htmlFor="agree-privacy" className="text-sm cursor-pointer">
                      <span className="text-destructive">[필수]</span> 개인정보 처리방침 동의
                    </Label>
                  </div>
                  {errors.agreePrivacy && <p className="text-xs text-destructive pl-6">{errors.agreePrivacy}</p>}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="agree-marketing"
                      checked={userForm.agreeMarketing}
                      onCheckedChange={(v) => setUserForm((p) => ({ ...p, agreeMarketing: !!v }))}
                    />
                    <Label htmlFor="agree-marketing" className="text-sm cursor-pointer text-muted-foreground">
                      [선택] 마케팅 정보 수신 동의
                    </Label>
                  </div>
                </div>
              </div>

              {/* 가입 제출 버튼 */}
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />가입 처리 중...</>
                ) : (
                  "회원가입"
                )}
              </Button>

              {/* 로그인 링크 */}
              <p className="text-center text-sm text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  로그인
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}