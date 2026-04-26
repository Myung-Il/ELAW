// 목표 설정 페이지 - 최초 로그인 시에만 진행
// 희망 직무와 공부 분야를 선택하고 커리큘럼 기반을 잡는 단계
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Sparkles, CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── 희망 직무 목록 ────────────────────────────────────────────────────────
// [FE 수정 매뉴얼] job_fields 배열은 API로 가져올 수도 있음
// [BE 매뉴얼] GET /api/v1/job-fields → [{ id, name, description, icon }]
// [DB 매뉴얼] JobFields 테이블: id, name, description, icon_emoji
const jobFields = [
  { id: "software", name: "소프트웨어 개발", description: "백엔드/프론트엔드/앱 개발", icon: "💻" },
  { id: "data", name: "데이터 사이언스", description: "ML/AI/데이터 분석", icon: "📊" },
  { id: "embedded", name: "임베디드 시스템", description: "펌웨어/하드웨어 개발", icon: "⚙️" },
  { id: "network", name: "네트워크/보안", description: "인프라/클라우드/보안", icon: "🔒" },
  { id: "semiconductor", name: "반도체/회로", description: "IC 설계/검증", icon: "⚡" },
  { id: "mechanical", name: "기계/로봇", description: "자동화/로보틱스 설계", icon: "🦾" },
  { id: "chemical", name: "화학/소재", description: "화학공정/소재 연구", icon: "🧪" },
  { id: "civil", name: "건설/건축", description: "건축 설계/시공 관리", icon: "🏗️" },
]

// ─── 공부 분야 목록 ────────────────────────────────────────────────────────
// [FE 수정 매뉴얼] study_topics는 API로 가져올 수 있음
// [BE 매뉴얼] GET /api/v1/study-topics → [{ id, name, category, difficulty }]
// [DB 매뉴얼] StudyTopics 테이블: id, name, category, difficulty, created_at
const studyTopics = [
  { id: "algo", name: "알고리즘", category: "CS 기초", difficulty: "중" },
  { id: "ds", name: "자료구조", category: "CS 기초", difficulty: "중" },
  { id: "os", name: "운영체제", category: "CS 기초", difficulty: "상" },
  { id: "db", name: "데이터베이스", category: "CS 기초", difficulty: "중" },
  { id: "network", name: "컴퓨터 네트워크", category: "CS 기초", difficulty: "중" },
  { id: "web-fe", name: "웹 프론트엔드", category: "개발", difficulty: "중" },
  { id: "web-be", name: "웹 백엔드", category: "개발", difficulty: "중" },
  { id: "ml", name: "머신러닝/딥러닝", category: "AI/데이터", difficulty: "상" },
  { id: "coding-test", name: "코딩 테스트", category: "취업 준비", difficulty: "중" },
  { id: "cs-interview", name: "CS 면접 준비", category: "취업 준비", difficulty: "중" },
  { id: "portfolio", name: "포트폴리오 구성", category: "취업 준비", difficulty: "하" },
  { id: "docker", name: "Docker/클라우드", category: "인프라", difficulty: "중" },
]

// 단계 인디케이터 컴포넌트
function StepIndicator({ step, currentStep }: { step: number; currentStep: number }) {
  const isCompleted = currentStep > step
  const isCurrent = currentStep === step
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-all",
          isCompleted ? "bg-primary border-primary text-primary-foreground" :
          isCurrent ? "bg-white border-primary text-primary" :
          "bg-white border-muted text-muted-foreground"
        )}
      >
        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
    </div>
  )
}

export default function GoalSettingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 현재 단계 (1: 직무 선택, 2: 공부 분야 선택)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 공부 분야 선택/해제 토글
  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  // 목표 설정 완료 제출
  // [BE 매뉴얼] POST /api/v1/users/goals
  //   Request: { job_field: string, study_topics: string[] }
  //   Response: { success: true, curriculum_id: number }
  // [DB 매뉴얼] UserGoals 테이블: user_id, job_field_id, is_first_setup
  //             UserStudyTopics 테이블: user_id, topic_id
  const handleComplete = async () => {
    if (!selectedJob) return
    setIsLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      // await fetch("/api/v1/users/goals", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ job_field: selectedJob, study_topics: selectedTopics }),
      // })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push("/home")
    } catch (err) {
      console.error("목표 설정 실패:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // 주제별 그룹핑
  const topicCategories = [...new Set(studyTopics.map((t) => t.category))]

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">ELAW</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        {/* 환영 메시지 */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3">처음 오셨군요, 환영합니다!</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            목표를 설정하면 AI가 맞춤형 커리큘럼을 만들어 드립니다.
            나중에 프로필에서 언제든지 변경할 수 있어요.
          </p>
        </div>

        {/* 단계 인디케이터 */}
        <div className="mb-10 flex items-center justify-center gap-4">
          <StepIndicator step={1} currentStep={step} />
          <span className={cn("text-sm font-medium", step === 1 ? "text-foreground" : "text-muted-foreground")}>
            희망 직무 선택
          </span>
          <div className="h-px w-12 bg-muted-foreground/30" />
          <StepIndicator step={2} currentStep={step} />
          <span className={cn("text-sm font-medium", step === 2 ? "text-foreground" : "text-muted-foreground")}>
            공부 분야 선택
          </span>
        </div>

        {/* ── 단계 1: 희망 직무 선택 ─────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">희망하는 직무를 선택해주세요</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {jobFields.map((field) => (
                <Card
                  key={field.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary hover:shadow-md",
                    selectedJob === field.id && "border-primary bg-primary/5 shadow-md ring-1 ring-primary"
                  )}
                  onClick={() => setSelectedJob(field.id)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl flex-shrink-0">
                      {field.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{field.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                    </div>
                    {selectedJob === field.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                disabled={!selectedJob}
                onClick={() => setStep(2)}
                className="gap-2"
              >
                다음 단계
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── 단계 2: 공부 분야 선택 ─────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">공부하고 싶은 분야를 선택해주세요</h2>
              <p className="text-sm text-muted-foreground mt-1">
                여러 개 선택 가능 · 선택하지 않아도 됩니다
              </p>
            </div>

            {/* 카테고리별 주제 표시 */}
            <div className="space-y-5">
              {topicCategories.map((category) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {studyTopics
                      .filter((t) => t.category === category)
                      .map((topic) => {
                        const isSelected = selectedTopics.includes(topic.id)
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => toggleTopic(topic.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-card hover:border-primary hover:bg-primary/5"
                            )}
                          >
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {topic.name}
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs px-1.5 py-0",
                                isSelected ? "bg-primary-foreground/20 text-primary-foreground" : ""
                              )}
                            >
                              {topic.difficulty}
                            </Badge>
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* 선택된 항목 요약 */}
            {selectedTopics.length > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                <p className="text-sm font-medium text-primary mb-2">
                  선택된 공부 분야 ({selectedTopics.length}개)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTopics.map((id) => {
                    const topic = studyTopics.find((t) => t.id === id)
                    return (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {topic?.name}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                이전으로
              </Button>
              <Button
                size="lg"
                onClick={handleComplete}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />커리큘럼 생성 중...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />AI 커리큘럼 생성하기</>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}