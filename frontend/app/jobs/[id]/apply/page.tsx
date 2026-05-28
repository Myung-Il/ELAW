"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import { ArrowLeft, Sparkles, Save, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { api } from "@/lib/api-client"

const PORTFOLIO_TIMEOUT_MS = 130_000

interface PortfolioObject {
  id: number
  content_json: string | { sections?: Array<{ type: string; content?: string }> } | null
  version: number
}
interface PortfolioResponse {
  id?: number
  content_json?: PortfolioObject["content_json"]
  version?: number
  message?: string
  data?: PortfolioObject
  portfolio?: PortfolioObject
}

function extractPortfolioBody(cj: PortfolioObject["content_json"]): string {
  if (cj == null) return ""
  if (typeof cj === "string") return cj
  if (Array.isArray(cj.sections)) {
    const ai = cj.sections.find((s) => s.type === "ai_generated")
    if (ai?.content) return ai.content
  }
  return JSON.stringify(cj, null, 2)
}

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  type Phase = "input" | "generating" | "edit" | "error"
  const [phase, setPhase] = useState<Phase>("input")
  const [experience, setExperience] = useState("")
  const [portfolioId, setPortfolioId] = useState<number | null>(null)
  const [content, setContent] = useState("")
  const [originalContentJson, setOriginalContentJson] = useState<PortfolioObject["content_json"] | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState("저장하기")

  const handleGenerate = async () => {
    if (!experience.trim()) return
    setPhase("generating")
    setErrorMsg("")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PORTFOLIO_TIMEOUT_MS)

    try {
      const raw = await api.post<PortfolioResponse>(
        `/api/jobs/${jobId}/apply/`,
        { experience },
        { signal: controller.signal } as RequestInit,
      )
      const portfolio: PortfolioObject | undefined =
        raw.portfolio ?? raw.data ?? (raw.id !== undefined ? (raw as PortfolioObject) : undefined)
      if (!portfolio || portfolio.id === undefined) {
        throw new Error("포트폴리오 응답 형식이 올바르지 않습니다.")
      }
      setPortfolioId(portfolio.id)
      setOriginalContentJson(portfolio.content_json)
      setContent(extractPortfolioBody(portfolio.content_json))
      setPhase("edit")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("abort") || msg.includes("AbortError")) {
        setErrorMsg("응답 시간이 초과되었습니다 (120초). Ollama 서버 상태를 확인하거나 잠시 후 다시 시도해주세요.")
      } else {
        setErrorMsg(msg || "포트폴리오 생성에 실패했습니다. 잠시 후 다시 시도해주세요.")
      }
      setPhase("error")
    } finally {
      clearTimeout(timeout)
    }
  }

  const handleSave = async () => {
    if (!portfolioId) return
    setIsSaving(true)
    try {
      let payload: unknown = content
      if (
        originalContentJson &&
        typeof originalContentJson === "object" &&
        Array.isArray(originalContentJson.sections)
      ) {
        payload = {
          ...originalContentJson,
          sections: originalContentJson.sections.map((s) =>
            s.type === "ai_generated" ? { ...s, content } : s
          ),
        }
      }
      await api.patch(`/api/jobs/portfolios/${portfolioId}/`, { content_json: payload })
      setSaveLabel("저장 완료!")
      setTimeout(() => setSaveLabel("저장하기"), 3000)
    } catch (err) {
      console.error("저장 실패:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      {/* 생성 중 로딩 오버레이 */}
      {phase === "generating" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="text-center space-y-4 max-w-sm px-6">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-10 w-10 text-primary animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl font-bold">AI 포트폴리오 생성 중...</h2>
            <p className="text-sm text-muted-foreground">
              입력하신 경력을 분석하여 맞춤 포트폴리오를 작성하고 있습니다.
              <br />
              약 30~120초가 소요됩니다.
            </p>
            <div className="flex justify-center gap-1.5 pt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-3xl">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          공고 상세로 돌아가기
        </button>

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">AI 포트폴리오 생성</h1>
            <p className="text-sm text-muted-foreground mt-1">
              나의 경력을 입력하면 AI가 공고에 맞는 포트폴리오 초안을 작성합니다.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Ollama mybot
          </Badge>
        </div>

        {/* 에러 상태 */}
        {phase === "error" && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="p-5 flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">{errorMsg}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => setPhase("input")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  다시 시도
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 단계 1: 경력 입력 */}
        {(phase === "input" || phase === "error") && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">나의 경력 및 경험 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  실제 경험한 내용만 입력해주세요. AI는 입력된 내용만을 바탕으로 포트폴리오를 작성합니다.
                  (허구 내용은 포함하지 않습니다)
                </p>
                <Textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder={`예시:\n- 컴퓨터공학과 3학년 재학 중\n- 교내 알고리즘 스터디 6개월 참여\n- 개인 프로젝트: 도서관 좌석 예약 시스템 (Spring Boot + React, 2023.09~12)\n- 백준 1000문제 이상 풀이\n- Java, Python, Spring Boot 사용 경험`}
                  className="min-h-[200px] resize-y font-mono text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{experience.length}자</p>
              </div>

              <Button
                className="w-full gap-2 font-semibold"
                size="lg"
                onClick={handleGenerate}
                disabled={!experience.trim() || phase === "generating"}
              >
                <Sparkles className="h-4 w-4" />
                AI 포트폴리오 생성 (30~120초 소요)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 단계 2: 편집 */}
        {phase === "edit" && (
          <div className="space-y-6">
            <Card className="shadow-sm border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI 생성 포트폴리오 초안
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">내용을 자유롭게 수정하세요</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[500px] resize-y font-mono text-sm leading-relaxed"
                  placeholder="AI가 생성한 포트폴리오 내용..."
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{content.length}자</p>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-between">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setPhase("input")}
              >
                <RefreshCw className="h-4 w-4" />
                다시 생성
              </Button>

              <Button
                className="gap-2 font-semibold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />}
                {saveLabel}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              저장된 포트폴리오는 프로필 → 지원 탭에서 확인하고 기업 채용 페이지에 직접 제출하세요.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
