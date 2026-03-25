"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation" // ✅ 페이지 이동을 위해 추가됨
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GraduationCap, Smartphone } from "lucide-react"

export default function LoginPage() {
  const router = useRouter() // ✅ 성공 시 대시보드로 넘기기 위한 도구

  const [userType, setUserType] = useState<"user" | "company">("user")

  // ✅ 1. 사용자가 입력하는 아이디와 비밀번호를 기억할 공간(State) 생성
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")

  // ✅ 2. 로그인 버튼을 눌렀을 때 실행될 함수 (백엔드로 데이터 전송)
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault() // 폼 제출 시 페이지가 새로고침되는 기본 현상 방지

    try {
      // 질문자님의 장고 백엔드로 POST 요청 쏘기!
      const response = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userId, // ⚠️ 장고가 아이디를 username으로 받는지, email로 받는지에 따라 수정 필요할 수 있음
          password: password,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("로그인 성공! 응답 데이터:", data)
        // (필요하다면 여기에 localStorage.setItem('token', data.token) 등을 추가합니다)

        alert("로그인이 성공적으로 완료되었습니다!")
        router.push("/dashboard") // 성공 시 대시보드 화면으로 이동
      } else {
        alert("아이디 또는 비밀번호가 틀렸습니다.")
      }
    } catch (error) {
      console.error("통신 에러:", error)
      alert("백엔드 서버와 연결할 수 없습니다. 장고 서버가 켜져 있는지 확인해주세요!")
    }
  }

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

                {/* 사용자 로그인 탭 */}
                <TabsContent value="user" className="space-y-6">
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

                  {/* ✅ 3. form 태그에 onSubmit 이벤트 연결 */}
                  <form className="space-y-4" onSubmit={handleUserLogin}>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">사용자 계정</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-id">아이디</Label>
                      {/* ✅ 4. Input에 value와 onChange 연결하여 타이핑할 때마다 상태 업데이트 */}
                      <Input
                          id="user-id"
                          placeholder="회원가입 시 사용한 아이디를 입력하시오"
                          value={userId}
                          onChange={(e) => setUserId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-password">비밀번호</Label>
                      <Input
                          id="user-password"
                          type="password"
                          placeholder="비밀번호를 입력하시오"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
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
                      {/* ✅ 5. 기존에 있던 가짜 Link 태그를 지우고 submit 버튼으로 변경 */}
                      <Button type="submit" className="w-full flex-1">
                        사용자 로그인
                      </Button>
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

                {/* 기업 사용자 로그인 탭 (기존 코드 유지) */}
                <TabsContent value="company" className="space-y-6">
                  {/* ... 기존 기업 로그인 코드 ... */}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
  )
}