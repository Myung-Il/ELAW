// ═══════════════════════════════════════════════════════════════════════════
// 포트폴리오 작성 / 지원하기 페이지  (/jobs/[id]/apply)
// ───────────────────────────────────────────────────────────────────────────
// - 로그인한 사용자만 접근 가능 (비로그인 시 /jobs/[id] 에서 로그인 유도)
// - AI가 사용자 학습 데이터 기반으로 포트폴리오 초안을 자동 생성
// - 사용자가 초안을 검토 및 수정 후 기업 공식 채용 페이지로 이동
// - [주의] AI 포트폴리오 내용 생성 로직은 백엔드/AI팀 담당
//          이 페이지는 결과 표시 및 편집 UI만 구현
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import { ArrowLeft, Sparkles, Save, ExternalLink, Plus, Trash2, Loader2 } from "lucide-react"

// ─── AI 생성 포트폴리오 초안 (더미) ──────────────────────────────────────
// [FE 수정 매뉴얼] 아래 데이터를 GET /api/v1/portfolio/generate?job_id={id} 로 교체
//   - 페이지 로드 시 API 호출 → AI가 생성한 초안 데이터를 각 state 초깃값으로 사용
//   - 이미 저장된 초안이 있으면 GET /api/v1/portfolio/{portfolio_id} 로 기존 데이터 로드
// [BE 매뉴얼] POST /api/v1/portfolio/generate
//   헤더: Authorization: Bearer {accessToken}
//   Request Body: { user_id: number, job_id: number }
//   Response: {
//     portfolio_id: number,
//     portfolio: {
//       intro: string (자기소개 초안),
//       skills: string[] (추천 기술 스택),
//       experiences: [{ title, period, desc }],
//       projects: [{ title, period, desc, tech: string[] }]
//     }
//   }
//   - AI 생성 시 사용자의 UserWeekProgress, StudyTopics 데이터를 참고하여 맞춤형 작성
//   - 생성 시간이 길 경우 SSE(Server-Sent Events) 또는 폴링 방식으로 진행 상황 전달 고려
// [DB 매뉴얼] Portfolios 테이블:
//   id, user_id(FK), job_id(FK), intro(text), skills_json(json), experiences_json(json),
//   projects_json(json), is_submitted(boolean, DEFAULT false), created_at, updated_at
const aiGeneratedPortfolio = {
  intro: "안녕하세요. 컴퓨터공학을 전공하며 소프트웨어 개발에 열정을 가진 홍길동입니다. 자료구조와 알고리즘에 강점을 가지고 있으며, 삼성전자의 MX사업부에서 갤럭시 운영체제 개발에 기여하고 싶습니다.",
  skills: ["Java", "Kotlin", "Android", "자료구조", "알고리즘", "Spring Boot", "MySQL"],
  experiences: [
    { title: "SW 마이스터 고교 졸업", period: "2019.03 ~ 2022.02", desc: "소프트웨어 전공 우수 졸업" },
    { title: "교내 프로그래밍 경진대회 1위", period: "2023.11", desc: "알고리즘 문제풀이 부문 1위" },
  ],
  projects: [
    {
      title: "캠퍼스 스터디 매칭 앱",
      period: "2024.03 ~ 2024.06",
      desc: "Android/Kotlin으로 개발한 스터디 그룹 매칭 애플리케이션. Room DB와 Jetpack Compose 활용",
      tech: ["Kotlin", "Android", "Room", "Retrofit"],
    },
    {
      title: "도서관 좌석 예약 시스템",
      period: "2023.09 ~ 2023.12",
      desc: "Spring Boot + React로 개발한 도서관 실시간 좌석 예약 웹 서비스. WebSocket을 통한 실시간 업데이트 구현",
      tech: ["Spring Boot", "React", "WebSocket", "MySQL"],
    },
  ],
}

// 타입 정의
interface Project {
  title: string
  period: string
  desc: string
  tech: string[]
}

interface Experience {
  title: string
  period: string
  desc: string
}

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // ─── 포트폴리오 편집 상태 ────────────────────────────────────────────────
  // [FE 수정 매뉴얼] API 응답으로 각 state의 초깃값을 교체
  const [intro, setIntro] = useState(aiGeneratedPortfolio.intro)
  const [skills, setSkills] = useState<string[]>(aiGeneratedPortfolio.skills)
  const [newSkill, setNewSkill] = useState("")
  const [experiences, setExperiences] = useState<Experience[]>(aiGeneratedPortfolio.experiences)
  const [projects, setProjects] = useState<Project[]>(aiGeneratedPortfolio.projects)

  // ─── 스킬 추가 ───────────────────────────────────────────────────────────
  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill("")
    }
  }

  // ─── 스킬 삭제 ───────────────────────────────────────────────────────────
  const removeSkill = (skill: string) => setSkills(skills.filter((s) => s !== skill))

  // ─── 포트폴리오 임시 저장 ────────────────────────────────────────────────
  // [FE 수정 매뉴얼] 실제 API 호출로 교체 + 저장 성공 토스트 메시지 표시
  // [BE 매뉴얼] PUT /api/v1/portfolio/{portfolio_id}
  //   헤더: Authorization: Bearer {accessToken}
  //   Request Body: { intro, skills, experiences, projects }
  //   Response: { success: true, updatedAt: string }
  // [DB 매뉴얼] Portfolios 테이블 UPDATE SET ..., updated_at=NOW() WHERE id=? AND user_id=?
  const handleSave = async () => {
    setIsLoading(true)
    try {
      // TODO: 실제 저장 API 호출
      await new Promise((r) => setTimeout(r, 800))
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  // ─── 기업 채용 페이지로 이동 ─────────────────────────────────────────────
  // [FE 수정 매뉴얼] 기업별 실제 채용 URL을 DB에서 가져와서 동적으로 사용해야 합니다
  // [BE 매뉴얼] GET /api/v1/jobs/{id} 응답에 apply_url 필드 포함
  // [DB 매뉴얼] Companies 테이블에 apply_url(varchar) 컬럼 추가 필요
  const handleApply = () => {
    window.open("https://careers.samsung.com", "_blank")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          기업 상세 페이지로
        </button>

        {/* ── 페이지 헤더 ──────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">포트폴리오 작성</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI가 나의 학습 데이터를 기반으로 포트폴리오 초안을 생성했습니다. 내용을 검토하고 수정하세요.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI 자동 생성
          </Badge>
        </div>

        <div className="space-y-6">
          {/* ── 자기소개 섹션 ─────────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">자기소개</CardTitle>
            </CardHeader>
            <CardContent>
              {/* [FE 수정 매뉴얼] AI 생성 intro를 state 초깃값으로 설정 */}
              <Textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                className="min-h-[120px] resize-y"
                placeholder="자기소개를 작성하세요"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">{intro.length}자</p>
            </CardContent>
          </Card>

          {/* ── 보유 기술 섹션 ─────────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">보유 기술 / 스킬</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 현재 스킬 목록 (뱃지 + 삭제 버튼) */}
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1.5 pr-1.5 pl-3 py-1 text-sm">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:text-destructive transition-colors rounded"
                      aria-label={`${skill} 삭제`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {/* 스킬 추가 입력란 */}
              <div className="flex gap-2">
                <Input
                  placeholder="스킬 추가 (예: Python)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addSkill} className="gap-1">
                  <Plus className="h-4 w-4" />
                  추가
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── 경력/활동 섹션 ─────────────────────────────────────────── */}
          {/* [FE 수정 매뉴얼] 항목 추가 시 서버에 자동 저장(debounce) 또는 임시 저장 버튼 활용 */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">경력 / 활동 이력</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setExperiences([...experiences, { title: "", period: "", desc: "" }])}
              >
                <Plus className="h-3 w-3" />
                추가
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {experiences.map((exp, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">활동명</Label>
                        <Input
                          value={exp.title}
                          onChange={(e) => {
                            const updated = [...experiences]
                            updated[i] = { ...updated[i], title: e.target.value }
                            setExperiences(updated)
                          }}
                          placeholder="활동/경력명"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">기간</Label>
                        <Input
                          value={exp.period}
                          onChange={(e) => {
                            const updated = [...experiences]
                            updated[i] = { ...updated[i], period: e.target.value }
                            setExperiences(updated)
                          }}
                          placeholder="예: 2023.03 ~ 2023.12"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {/* 항목 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => setExperiences(experiences.filter((_, idx) => idx !== i))}
                      className="mt-5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="항목 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs">설명</Label>
                    <Textarea
                      value={exp.desc}
                      onChange={(e) => {
                        const updated = [...experiences]
                        updated[i] = { ...updated[i], desc: e.target.value }
                        setExperiences(updated)
                      }}
                      placeholder="활동 내용 및 성과를 작성하세요"
                      className="mt-1 min-h-[80px] resize-y"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── 프로젝트 섹션 ──────────────────────────────────────────── */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">프로젝트</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setProjects([...projects, { title: "", period: "", desc: "", tech: [] }])}
              >
                <Plus className="h-3 w-3" />
                추가
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.map((proj, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">프로젝트명</Label>
                        <Input
                          value={proj.title}
                          onChange={(e) => {
                            const updated = [...projects]
                            updated[i] = { ...updated[i], title: e.target.value }
                            setProjects(updated)
                          }}
                          placeholder="프로젝트명"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">기간</Label>
                        <Input
                          value={proj.period}
                          onChange={(e) => {
                            const updated = [...projects]
                            updated[i] = { ...updated[i], period: e.target.value }
                            setProjects(updated)
                          }}
                          placeholder="예: 2024.03 ~ 2024.06"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {/* 프로젝트 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => setProjects(projects.filter((_, idx) => idx !== i))}
                      className="mt-5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="프로젝트 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs">프로젝트 설명</Label>
                    <Textarea
                      value={proj.desc}
                      onChange={(e) => {
                        const updated = [...projects]
                        updated[i] = { ...updated[i], desc: e.target.value }
                        setProjects(updated)
                      }}
                      placeholder="프로젝트 목적, 역할, 성과 등을 작성하세요"
                      className="mt-1 min-h-[80px] resize-y"
                    />
                  </div>
                  {/* 사용 기술 태그 */}
                  <div className="flex flex-wrap gap-1.5">
                    {proj.tech.map((t, ti) => (
                      <Badge key={ti} variant="secondary" className="text-xs gap-1 pr-1">
                        {t}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...projects]
                            updated[i] = { ...updated[i], tech: proj.tech.filter((_, tIdx) => tIdx !== ti) }
                            setProjects(updated)
                          }}
                          className="hover:text-destructive"
                          aria-label={`${t} 기술 삭제`}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── 액션 버튼 영역 ─────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            {/* 임시 저장 버튼 */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaved ? "저장 완료!" : "임시 저장"}
            </Button>

            {/* 기업 채용 페이지 이동 버튼 */}
            {/* [FE 수정 매뉴얼] href를 DB의 Companies.apply_url 로 교체 */}
            <Button
              size="lg"
              className="gap-2 font-semibold shadow-sm"
              onClick={handleApply}
            >
              <ExternalLink className="h-4 w-4" />
              기업 채용 페이지에서 지원하기
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            위 버튼 클릭 시 기업 공식 채용 페이지로 이동합니다. ELAW 포트폴리오는 자동 저장됩니다.
          </p>
        </div>
      </main>
    </div>
  )
}