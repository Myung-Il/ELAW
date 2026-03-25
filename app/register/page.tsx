"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GraduationCap, Smartphone } from "lucide-react"

function RegisterForm() {
  const searchParams = useSearchParams()
  const initialType = searchParams.get("type") === "company" ? "company" : "user"
  // [FE 수정 매뉴얼] 입력 폼 데이터를 관리할 객체 상태가 필요합니다.
  // 예: const [formData, setFormData] = useState({ name: "", phone: "", userId: "", password: "", passwordConfirm: "", email: "" })
  const [userType, setUserType] = useState<"user" | "company">(initialType)

  return (
      <Tabs value={userType} onValueChange={(v) => setUserType(v as "user" | "company")}>
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="user">사용자 회원가입</TabsTrigger>
          <TabsTrigger value="company">기업 회원가입</TabsTrigger>
        </TabsList>

        {/* User Registration */}
        <TabsContent value="user" className="space-y-6">
          {/* Phone Verification */}
          {/* [FE/BE 매뉴얼] 이 버튼에 onClick 이벤트를 연결하여 백엔드의 '인증번호 발송 API'를 호출해야 합니다. */}
          <Button variant="default" className="w-full gap-2" size="lg">
            <Smartphone className="h-4 w-4" />
            휴대폰 인증
          </Button>

          {/* [FE 수정 매뉴얼] onSubmit={handleSubmit} 이벤트를 form에 추가하세요. */}
          <form className="space-y-4">
            {/* Basic Info */}
            {/* [DB 매뉴얼] DB의 Users 테이블 컬럼: name */}
            <div className="space-y-2">
              <Label htmlFor="user-name">이름 (필수)</Label>
              <Input id="user-name" placeholder="홍길동" />
            </div>

            {/* [DB 매뉴얼] DB의 Users 테이블 컬럼: phone_number (Unique 속성 필요) */}
            <div className="space-y-2">
              <Label htmlFor="user-phone">전화번호 (필수)</Label>
              <Input id="user-phone" placeholder="비밀번호를 입력하시오" type="tel" />
            </div>

            {/* Account Info Section */}
            <div className="pt-4">
              <h3 className="mb-3 font-semibold">기본정보</h3>
            </div>

            {/* [DB 매뉴얼] DB의 Users 테이블 컬럼: login_id (Unique 속성 필요, 중복가입 방지) */}
            <div className="space-y-2">
              <Label htmlFor="user-id">아이디 (필수)</Label>
              <Input id="user-id" placeholder="비밀번호를 입력하시오" />
            </div>

            {/* [DB 매뉴얼] DB의 Users 테이블 컬럼: password (반드시 Bcrypt 등으로 암호화 저장 필요) */}
            <div className="space-y-2">
              <Label htmlFor="user-password">비밀번호 (필수)</Label>
              <Input id="user-password" type="password" placeholder="비밀번호를 입력하시오" />
            </div>

            {/* [FE 수정 매뉴얼] 백엔드로 전송 전, 프론트엔드에서 user-password와 이 값이 같은지 유효성 검사 로직이 필요합니다. */}
            <div className="space-y-2">
              <Label htmlFor="user-password-confirm">비밀번호 확인 (필수)</Label>
              <Input id="user-password-confirm" type="password" placeholder="비밀번호를 입력하시오" />
            </div>

            {/* [DB 매뉴얼] DB의 Users 테이블 컬럼: email (선택 항목이므로 Nullable 허용 필요) */}
            <div className="space-y-2">
              <Label htmlFor="user-email">이메일 (선택)</Label>
              <Input id="user-email" type="email" placeholder="비밀번호를 입력하시오" />
            </div>

            {/* Agreements */}
            <div className="space-y-3 pt-4">
              <h3 className="font-semibold">전체 동의</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {/* [FE 수정 매뉴얼] '전체 동의' 체크 시 하위 3개 체크박스 상태가 모두 true/false로 동기화되는 로직이 필요합니다. */}
                  <Checkbox id="agree-all" />
                  <Label htmlFor="agree-all" className="text-sm font-normal">
                    전체 동의
                  </Label>
                </div>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="agree-terms" />
                    <Label htmlFor="agree-terms" className="text-sm font-normal text-muted-foreground">
                      이용약관 동의 (필수)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="agree-privacy" />
                    <Label htmlFor="agree-privacy" className="text-sm font-normal text-muted-foreground">
                      개인정보처리방침 동의 (필수)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* [DB 매뉴얼] DB의 Users 테이블 컬럼: marketing_agreed (Boolean 형태, 기본값 false) */}
                    <Checkbox id="agree-marketing" />
                    <Label htmlFor="agree-marketing" className="text-sm font-normal text-muted-foreground">
                      마케팅 정보 수신 동의 (선택)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* [FE 수정 매뉴얼] Link 태그 제거 후, 버튼 타입을 "submit"으로 변경. */}
            {/* [BE 매뉴얼] 이 버튼 클릭 시 호출될 사용자 회원가입 API (예: POST /api/v1/users/register) 필요. */}
            <Link href="/dashboard">
              <Button type="button" className="mt-4 w-full" size="lg">
                회원가입 완료
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground">
              위의 모든 약관(선택)에 동의하며, 미동의 시에도 일반 회원 <br />
              가입 및 서비스 사용이 가능합니다. 로그인 후 정보수정이 가능합니다.
            </p>
          </form>
        </TabsContent>

        {/* Company Registration */}
        <TabsContent value="company" className="space-y-6">
          <form className="space-y-4">
            {/* Company Basic Info */}
            <div className="space-y-2">
              <h3 className="font-semibold">기본정보</h3>
            </div>

            {/* [DB 매뉴얼] DB의 Companies 테이블 컬럼: company_name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">기업 이름 (필수)</Label>
              <Input id="company-name" placeholder="예: ELAW 주식회사" />
            </div>

            {/* [DB 매뉴얼] DB의 Companies 테이블 컬럼: business_registration_number */}
            <div className="space-y-2">
              <Label htmlFor="company-code">기업 인증 (필수)</Label>
              <Input id="company-code" placeholder="사업자등록번호 또는 인증코드" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-password">비밀번호 (필수)</Label>
              <Input id="company-password" type="password" placeholder="비밀번호를 입력하시오" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-password-confirm">비밀번호 확인 (필수)</Label>
              <Input id="company-password-confirm" type="password" placeholder="비밀번호를 입력하시오" />
            </div>

            {/* Phone Verification for Company */}
            <Button variant="default" className="w-full gap-2" size="lg">
              <Smartphone className="h-4 w-4" />
              휴대폰 인증
            </Button>

            {/* Manager Info Section */}
            <div className="pt-4">
              <h3 className="mb-3 font-semibold">담당자 정보</h3>
            </div>

            {/* [DB 매뉴얼] DB의 Companies 테이블 컬럼: manager_name */}
            <div className="space-y-2">
              <Label htmlFor="manager-name">담당자 이름 (필수)</Label>
              <Input id="manager-name" placeholder="담당자 이름" />
            </div>

            {/* [DB 매뉴얼] DB의 Companies 테이블 컬럼: manager_phone */}
            <div className="space-y-2">
              <Label htmlFor="manager-phone">전화번호 (필수)</Label>
              <Input id="manager-phone" type="tel" placeholder="010-0000-0000" />
            </div>

            {/* [DB 매뉴얼] DB의 Companies 테이블 컬럼: manager_email (이 값을 기업 로그인 ID로 사용할 확률 높음) */}
            <div className="space-y-2">
              <Label htmlFor="manager-email">이메일 (선택)</Label>
              <Input id="manager-email" type="email" placeholder="hr@example.com" />
            </div>

            {/* Agreements */}
            <div className="space-y-3 pt-4">
              <h3 className="font-semibold">전체 동의</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="company-agree-all" />
                  <Label htmlFor="company-agree-all" className="text-sm font-normal">
                    전체 동의
                  </Label>
                </div>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="company-agree-terms" />
                    <Label htmlFor="company-agree-terms" className="text-sm font-normal text-muted-foreground">
                      이용약관 동의 (필수)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="company-agree-privacy" />
                    <Label htmlFor="company-agree-privacy" className="text-sm font-normal text-muted-foreground">
                      개인정보처리방침 동의 (필수)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* [BE 매뉴얼] 기업 회원가입 전용 API (예: POST /api/v1/companies/register) 필요. */}
            <Link href="/dashboard">
              <Button type="button" className="mt-4 w-full" size="lg">
                기업 회원가입 완료
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground">
              위의 모든 약관(선택)에 동의하며, 미동의 시에도 기업 회원 <br />
              가입 및 서비스 사용이 가능합니다. 로그인 후 정보수정이 가능합니다.
            </p>
          </form>
        </TabsContent>
      </Tabs>
  )
}

export default function RegisterPage() {
  return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto flex h-16 items-center px-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="text-xl font-bold text-primary">ELAW</span>
                <span className="ml-2 text-sm text-muted-foreground">학습지원 / 취업연계 플랫폼</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 items-center justify-center p-4 py-8">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">회원가입</CardTitle>
              <CardDescription>ELAW 서비스 이용을 위해 회원가입을 진행해주세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="h-96 animate-pulse rounded bg-muted" />}>
                <RegisterForm />
              </Suspense>
            </CardContent>
          </Card>
        </main>
      </div>
  )
}