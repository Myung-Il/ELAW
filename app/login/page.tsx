"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GraduationCap, Smartphone } from "lucide-react"

export default function LoginPage() {
  // [FE 수정 매뉴얼] 현재는 탭(사용자/기업) 상태만 관리 중입니다.
  // 실제 API 통신을 위해서는 사용자가 입력한 ID와 Password를 담을 상태가 추가로 필요합니다.
  // 추가할 코드 예시:
  // const [userId, setUserId] = useState("")
  // const [password, setPassword] = useState("")
  const [userType, setUserType] = useState<"user" | "company">("user")

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
        <main className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">로그인</CardTitle>
              <CardDescription>ELAW 계정으로 로그인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={userType} onValueChange={(v) => setUserType(v as "user" | "company")}>
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="user">사용자 로그인</TabsTrigger>
                  <TabsTrigger value="company">기업 로그인</TabsTrigger>
                </TabsList>

                {/* [FE/BE/DB 설명] 일반 사용자 로그인 탭 영역입니다. */}
                <TabsContent value="user" className="space-y-6">
                  {/* Quick Login */}
                  {/* [FE 수정 매뉴얼] 간편인증(OAuth) 도입 시 여기에 onClick 이벤트를 달고 카카오/네이버/구글 로그인 URL로 리다이렉트 시켜야 합니다. */}
                  <Button variant="default" className="w-full gap-2" size="lg">
                    <Smartphone className="h-4 w-4" />
                    간편인증
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">또는</span>
                    </div>
                  </div>

                  {/* User Login Form */}
                  {/* [FE 수정 매뉴얼] 폼 제출 시 페이지가 새로고침되는 것을 막고 API를 호출하려면 <form onSubmit={handleLogin}> 형태로 수정해야 합니다. */}
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">사용자 계정</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-id">아이디</Label>
                      {/* [FE 수정 매뉴얼] 입력값을 상태에 저장하려면 value={userId} onChange={(e) => setUserId(e.target.value)} 속성을 추가하세요. */}
                      <Input
                          id="user-id"
                          placeholder="회원가입 시 사용한 아이디를 입력하시오"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-password">비밀번호</Label>
                      {/* [FE 수정 매뉴얼] 입력값을 상태에 저장하려면 value={password} onChange={(e) => setPassword(e.target.value)} 속성을 추가하세요. */}
                      <Input
                          id="user-password"
                          type="password"
                          placeholder="비밀번호를 입력하시오"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {/* [FE 수정 매뉴얼] 로그인 상태 유지를 위해 로컬 스토리지 등에 저장할지 결정하는 체크박스 상태 관리가 필요합니다. */}
                        <Checkbox id="remember" />
                        <Label htmlFor="remember" className="text-sm font-normal">
                          로그인 상태 유지
                        </Label>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Link href="#" className="hover:text-foreground hover:underline">
                        아이디 찾기
                      </Link>
                      <span>|</span>
                      <Link href="#" className="hover:text-foreground hover:underline">
                        비밀번호 재설정
                      </Link>
                    </div>

                    <div className="flex gap-2">
                      <Link href="/dashboard" className="flex-1">
                        {/* [FE 수정 매뉴얼] 현재는 단순 Link 이동으로 되어있습니다. 실제 API 연동 시 Link 태그를 제거하고, 이 Button의 type="submit"으로 변경하여 form 태그의 onSubmit 이벤트가 발생하도록 수정해야 합니다. */}
                        {/* [BE 매뉴얼] 이 버튼 클릭 시 호출될 사용자 로그인 API가 필요합니다. (예: POST /api/v1/auth/user/login) */}
                        {/* [DB 매뉴얼] 전달받은 아이디를 Users 테이블에서 조회하고, 저장된 암호화 비밀번호와 일치하는지 확인해야 합니다. */}
                        <Button type="button" className="w-full">
                          사용자 로그인
                        </Button>
                      </Link>
                      <Link href="/register">
                        <Button type="button" variant="outline">
                          사용자 회원가입
                        </Button>
                      </Link>
                    </div>
                  </form>

                  <p className="text-center text-xs text-muted-foreground">
                    경고 PC에서는 개인정보 보호를 위해 <strong>로그인 상태 유지</strong> 사용을 권장하지 않습니다.
                  </p>
                </TabsContent>

                {/* [FE/BE/DB 설명] 기업 사용자 로그인 탭 영역입니다. 구조는 사용자 탭과 동일합니다. */}
                <TabsContent value="company" className="space-y-6">
                  {/* Company Login Form */}
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">기업 계정</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">담당자 이메일</Label>
                      {/* [FE 수정 매뉴얼] 기업 로그인용 이메일 상태 연결 (예: value={companyEmail}) */}
                      <Input
                          id="company-email"
                          type="email"
                          placeholder="회원가입 시 사용한 아이디를 입력하시오"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-password">비밀번호</Label>
                      {/* [FE 수정 매뉴얼] 기업 로그인용 비밀번호 상태 연결 */}
                      <Input
                          id="company-password"
                          type="password"
                          placeholder="비밀번호를 입력하시오"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="company-remember" />
                        <Label htmlFor="company-remember" className="text-sm font-normal">
                          로그인 상태 유지
                        </Label>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Link href="#" className="hover:text-foreground hover:underline">
                        담당자 변경문의
                      </Link>
                      <span>|</span>
                      <Link href="#" className="hover:text-foreground hover:underline">
                        비밀번호 재설정
                      </Link>
                    </div>

                    <div className="flex gap-2">
                      <Link href="/dashboard" className="flex-1">
                        {/* [FE 수정 매뉴얼] 일반 사용자와 마찬가지로 Link 태그 제거 후 type="submit"으로 변경 필요. */}
                        {/* [BE 매뉴얼] 기업용 로그인 API가 별도로 필요합니다. (예: POST /api/v1/auth/company/login) */}
                        {/* [DB 매뉴얼] Companies 테이블에서 담당자 이메일 기반으로 조회해야 합니다. */}
                        <Button type="button" className="w-full">
                          기업 로그인
                        </Button>
                      </Link>
                      <Link href="/register?type=company">
                        <Button type="button" variant="outline">
                          기업 회원가입
                        </Button>
                      </Link>
                    </div>
                  </form>

                  <p className="text-center text-xs text-muted-foreground">
                    최소 가입 후 24시간이 안 지난 회사만 가입 기능을 사용할 수 있습니다.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
  )
}