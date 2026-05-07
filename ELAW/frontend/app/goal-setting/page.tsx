// ═══════════════════════════════════════════════════════════════════════════
// 목표 설정 페이지  (/goal-setting)
// ───────────────────────────────────────────────────────────────────────────
// - 최초 로그인 시에만 진행하는 온보딩 단계
// - 로그인 직후 → /goal-setting → (AI 커리큘럼 생성) → /home
// - 이후 재방문 시에는 /home 으로 리다이렉트 권장 (BE: isFirstSetup 플래그 확인)
// - 2단계 구성:
//     Step 1: 희망 직무 선택 (단일 선택)
//     Step 2: 공부하고 싶은 분야 선택 (다중 선택 가능, 선택 안 해도 됨)
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Sparkles, CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── 희망 직무 목록 ────────────────────────────────────────────────────────
// [FE 수정 매뉴얼] jobFields 배열을 GET /api/v1/job-fields 로 교체 (동적 로딩)
// [BE 매뉴얼] GET /api/v1/job-fields
//   Response: [{ id: string, name: string, description: string, icon: string(emoji) }]
//   - 별도 인증 불필요 (공개 API)
// [DB 매뉴얼] JobFields 테이블: id(varchar), name, description, icon_emoji, display_order
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
// [FE 수정 매뉴얼] studyTopics 배열을 GET /api/v1/study-topics 로 교체
// [BE 매뉴얼] GET /api/v1/study-topics
//   Response: [{ id: string, name: string, category: string, difficulty: "하"|"중"|"상" }]
// [DB 매뉴얼] StudyTopics 테이블: id(varchar), name, category, difficulty, is_active(boolean)
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

// ─── 단계 인디케이터 서브컴포넌트 ────────────────────────────────────────────
// step: 이 인디케이터가 나타내는 단계 번호
// currentStep: 현재 진행 중인 단계 번호
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

  // 현재 단계 (1: 희망 직무 선택, 2: 공부 분야 선택)
  const [step, setStep] = useState(1)

  // Step 1: 단일 선택
  const [selectedJob, setSelectedJob] = useState<string | null>(null)

  // Step 2: 다중 선택 (배열)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])

  // AI 커리큘럼 생성 중 로딩 상태
  const [isLoading, setIsLoading] = useState(false)

  // 공부 분야 선택/해제 토글
  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  // ─── 목표 설정 완료 → AI 커리큘럼 생성 요청 ─────────────────────────────
  // [FE 수정 매뉴얼] setTimeout 시뮬레이션 → 실제 API 호출로 교체 후 /home 이동
  // [BE 매뉴얼] POST /api/v1/users/goals
  //   헤더: Authorization: Bearer {accessToken}
  //   Request Body: {
  //     job_field: string (선택한 직무 ID),
  //     study_topics: string[] (선택한 공부 분야 ID 배열, 빈 배열 허용)
  //   }
  //   Response: { success: true, curriculum_id: number }
  //   - 이 API 호출 후 AI 커리큘럼 자동 생성 (비동기 처리 or 즉시 생성)
  //   - UserGoals.is_first_setup 을 false로 업데이트 → 이후 재방문 시 /home 리다이렉트
  // [DB 매뉴얼]
  //   UserGoals 테이블: user_id(FK), job_field_id(FK→JobFields), is_first_setup(boolean, DEFAULT true)
  //   UserStudyTopics 테이블: user_id(FK), topic_id(FK→StudyTopics) - 선택한 공부 분야 N:M
  //   Curriculums 테이블: id, user_id(FK), generated_at - AI가 생성한 커리큘럼 메타
  //   CurriculumWeeks 테이블: id, curriculum_id(FK), week_number, title, topics_json, ... - 주차별 내용
  const handleComplete = async () => {
    if (!selectedJob) return
    setIsLoading(true)
    try {
      // TODO: 실제 API 호출로 교체
      // const res = await fetch("/api/v1/users/goals", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      //   },
      //   body: JSON.stringify({ job_field: selectedJob, study_topics: selectedTopics }),
      // })
      // if (!res.ok) throw new Error("목표 설정 실패")
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push("/home")
    } catch (err) {
      console.error("목표 설정 실패:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // 카테고리 중복 제거로 그룹핑에 사용
  const topicCategories = [...new Set(studyTopics.map((t) => t.category))]

  return (
    <div className="min-h-screen bg-background">
      {/* 심플 헤더 (클릭 불가 로고만) */}
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

        {/* ── 환영 메시지 ──────────────────────────────────────────────── */}
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

        {/* ── 진행 단계 인디케이터 ─────────────────────────────────────── */}
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

        {/* ── Step 1: 희망 직무 선택 ──────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">희망하는 직무를 선택해주세요</h2>
            {/* 직무 카드 그리드 (단일 선택) */}
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

            {/* 다음 단계 버튼 (직무 선택 전까지 비활성) */}
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

        {/* ── Step 2: 공부 분야 선택 ──────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">공부하고 싶은 분야를 선택해주세요</h2>
              <p className="text-sm text-muted-foreground mt-1">
                여러 개 선택 가능 · 선택하지 않아도 됩니다
              </p>
            </div>

            {/* 카테고리별 주제 버튼 그룹 */}
            {/* [FE 수정 매뉴얼] 카테고리 분류도 API 응답에서 동적으로 처리 */}
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
                            {/* 난이도 뱃지 */}
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

            {/* 선택된 분야 요약 (1개 이상 선택 시 표시) */}
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

            {/* 이전/완료 버튼 */}
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