"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GraduationCap, Smartphone } from "lucide-react"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = searchParams.get("type") === "company" ? "company" : "user"
  const [userType, setUserType] = useState<"user" | "company">(initialType)

  // ✅ 1. 이름이 정확히 매칭된 기억 장치
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    userId: "",
    password: "",
    passwordConfirm: "",
    email: ""
  })

  // ✅ 2. 이제 id 대신 name을 기준으로 정확하게 글자를 저장합니다!
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.passwordConfirm) {
      alert("비밀번호와 비밀번호 확인이 일치하지 않습니다!")
      return
    }

    try {
      // ⚠️ 장고 회원가입 주소로 맞춰주세요!
      const response = await fetch("http://127.0.0.1:8000/api/accounts/signup/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // 로그인할 때 email로 보내셨으므로 여기서도 email로 통일!
          email: formData.userId,
          password: formData.password,
          name: formData.name,
        }),
      })

      if (response.ok) {
        alert("회원가입이 성공적으로 완료되었습니다! 로그인 페이지로 이동합니다.")
        router.push("/login")
      } else {
        const errorData = await response.json()
        console.log("회원가입 실패 사유:", errorData)
        alert("회원가입에 실패했습니다. 입력 정보를 다시 확인해주세요.")
      }
    } catch (error) {
      console.error("통신 에러:", error)
      alert("백엔드 서버와 연결할 수 없습니다.")
    }
  }

  return (
      <Tabs value={userType} onValueChange={(v) => setUserType(v as "user" | "company")}>
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="user">사용자 회원가입</TabsTrigger>
          <TabsTrigger value="company">기업 회원가입</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          <Button variant="default" className="w-full gap-2" size="lg" type="button">
            <Smartphone className="h-4 w-4" />
            휴대폰 인증
          </Button>

          <form className="space-y-4" onSubmit={handleUserRegister}>
            <div className="space-y-2">
              <Label htmlFor="user-name">이름 (필수)</Label>
              {/* ✅ name 속성 추가 및 value 연결 완료 */}
              <Input id="user-name" name="name" placeholder="홍길동" value={formData.name} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-phone">전화번호 (필수)</Label>
              <Input id="user-phone" name="phone" placeholder="전화번호를 입력하시오" type="tel" value={formData.phone} onChange={handleChange} />
            </div>

            <div className="pt-4">
              <h3 className="mb-3 font-semibold">기본정보</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-id">아이디 (필수) - 이메일 형식</Label>
              <Input id="user-id" name="userId" placeholder="로그인에 사용할 이메일을 입력하시오" value={formData.userId} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">비밀번호 (필수)</Label>
              <Input id="user-password" name="password" type="password" placeholder="비밀번호를 입력하시오" value={formData.password} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password-confirm">비밀번호 확인 (필수)</Label>
              <Input id="user-password-confirm" name="passwordConfirm" type="password" placeholder="비밀번호를 다시 한 번 입력하시오" value={formData.passwordConfirm} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">보조 이메일 (선택)</Label>
              <Input id="user-email" name="email" type="email" placeholder="보조 이메일을 입력하시오" value={formData.email} onChange={handleChange} />
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="font-semibold">전체 동의 (현재는 UI만)</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="agree-all" />
                  <Label htmlFor="agree-all" className="text-sm font-normal">전체 동의</Label>
                </div>
              </div>
            </div>

            <Button type="submit" className="mt-4 w-full" size="lg">
              회원가입 완료
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              위의 모든 약관(선택)에 동의하며, 미동의 시에도 일반 회원 <br />
              가입 및 서비스 사용이 가능합니다. 로그인 후 정보수정이 가능합니다.
            </p>
          </form>
        </TabsContent>

        {/* 기업 회원가입 탭 (기존 UI 유지) */}
        <TabsContent value="company" className="space-y-6">
          <div className="text-center p-4 border rounded bg-muted/20">기업 회원가입은 추후 연동 예정입니다.</div>
        </TabsContent>
      </Tabs>
  )
}

export default function RegisterPage() {
  return (
      <div className="flex min-h-screen flex-col bg-background">
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