"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import {
  Building2, Briefcase, Calendar,
  ArrowLeft, FileText, GraduationCap, CheckCircle, Clock, TrendingUp,
  Loader2, Bookmark, BookmarkCheck,
} from "lucide-react"
import { api } from "@/lib/api-client"

interface JobDetail {
  id: number
  title: string
  description: string
  company: { id: number; name: string; industry: string; logo_url: string | null }
  required_skills: string[]
  preferred_skills: string[]
  job_role: string
  career_level: string
  career_level_display: string
  deadline: string | null
  view_count: number
  is_active: boolean
  is_scrapped: boolean
  is_applied: boolean
  my_match_score: number | null
  my_match_status: string | null
}

// ─────────────────────────────────────────
// 직무 소개 렌더러
// 데이터셋 JD 원문은 **볼드**·"- 불릿"·"---" 구분선·빈 줄 단락이 섞인
// 마크다운 형태다. 그대로 <p>에 넣으면 줄바꿈이 사라져 한 덩어리로 보이므로,
// 줄 단위로 파싱해 헤더/불릿/단락으로 구조화해 렌더링한다.
// ─────────────────────────────────────────

// 인라인 **볼드** → <strong>
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/)
    return m
      ? <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">{m[1]}</strong>
      : <span key={`${keyPrefix}-${i}`}>{part}</span>
  })
}

function JobDescription({ text }: { text: string }) {
  if (!text?.trim()) {
    return <p className="text-sm text-muted-foreground">등록된 직무 소개가 없습니다.</p>
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    const items = [...bullets]
    bullets = []
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mb-4 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
            <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
            <span>{renderInline(it, `li-${blocks.length}-${i}`)}</span>
          </li>
        ))}
      </ul>
    )
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim()
    if (!line) { flushBullets(); return }
    if (/^-{3,}$/.test(line)) { flushBullets(); return }   // 구분선 → 무시

    const bullet = line.match(/^[-*•]\s+(.+)$/)
    if (bullet) { bullets.push(bullet[1]); return }
    flushBullets()

    // "**라벨:** 값"  (헤더 + 값이 같은 줄)
    const labeled = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
    if (labeled) {
      blocks.push(
        <p key={idx} className="mb-2 text-sm leading-relaxed">
          <span className="font-semibold text-foreground">{labeled[1]}</span>
          <span className="text-muted-foreground">{` ${labeled[2]}`}</span>
        </p>
      )
      return
    }

    // "**...**" 한 줄 전체 → 섹션 헤더
    const heading = line.match(/^\*\*(.+?)\*\*$/)
    if (heading) {
      blocks.push(
        <h4 key={idx} className="mt-5 mb-2 text-sm font-semibold text-foreground first:mt-0">
          {heading[1].replace(/:$/, "")}
        </h4>
      )
      return
    }

    // 일반 단락
    blocks.push(
      <p key={idx} className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {renderInline(line, `p-${idx}`)}
      </p>
    )
  })
  flushBullets()

  return <div>{blocks}</div>
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [job, setJob] = useState<JobDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isScrapping, setIsScrapping] = useState(false)
  const [isStudying, setIsStudying] = useState(false)

  useEffect(() => {
    api.get<{ data: JobDetail } | JobDetail>(`/api/jobs/${id}/`)
      .then((res) => {
        setJob("data" in res ? (res as { data: JobDetail }).data : res as JobDetail)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [id])

  const handleScrap = async () => {
    if (!job) return
    setIsScrapping(true)
    try {
      if (job.is_scrapped) {
        await api.delete(`/api/jobs/${id}/scrap/`)
        setJob({ ...job, is_scrapped: false })
      } else {
        await api.post(`/api/jobs/${id}/scrap/`)
        setJob({ ...job, is_scrapped: true })
      }
    } catch (err) {
      console.error("스크랩 처리 실패:", err)
    } finally {
      setIsScrapping(false)
    }
  }

  const handleStudy = async () => {
    if (!job) return
    setIsStudying(true)
    try {
      await api.post(`/api/jobs/${id}/study/?force=true`)
      await api.post("/api/core/goals/", {
        job_role: job.job_role || job.title,
        // field: 핵심 기술 영역 (필수 스킬 전체, 없으면 산업군)
        field: job.required_skills?.length > 0
          ? job.required_skills.join(", ")
          : (job.company.industry || "개발"),
        duration_weeks: 8,
        required_skills: job.required_skills ?? [],
        preferred_skills: job.preferred_skills ?? [],
      })
      router.push("/curriculum")
    } catch (err: unknown) {
      console.error("커리큘럼 생성 실패:", err)
      alert(err instanceof Error ? err.message : "커리큘럼 생성에 실패했습니다.")
    } finally {
      setIsStudying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">공고를 찾을 수 없습니다.</p>
          <Button variant="outline" onClick={() => router.back()}>돌아가기</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          기업 공고 목록으로
        </button>

        {/* 기업 헤더 */}
        <Card className="mb-6 shadow-sm overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-md flex-shrink-0">
                {job.company.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold">{job.company.name}</h1>
                  {job.my_match_score !== null && (
                    <Badge variant="secondary" className="text-sm">
                      AI 매칭 {Math.round(job.my_match_score)}%
                    </Badge>
                  )}
                </div>
                <p className="text-lg text-primary font-semibold mb-2">{job.title}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {job.company.industry ?? job.job_role}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {job.career_level_display}
                  </span>
                  {job.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(job.deadline).toLocaleDateString("ko-KR")} 마감
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleScrap}
                disabled={isScrapping}
                className="flex-shrink-0"
              >
                {job.is_scrapped
                  ? <BookmarkCheck className="h-5 w-5 text-primary" />
                  : <Bookmark className="h-5 w-5" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* 직무 소개 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4 text-primary" />
                  직무 소개
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <JobDescription text={job.description} />
                </div>

                {job.required_skills?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">필수 스킬</p>
                    <div className="flex flex-wrap gap-2">
                      {job.required_skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {job.preferred_skills?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">우대 스킬</p>
                    <ul className="space-y-1.5">
                      {job.preferred_skills.map((skill, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 사이드바: 지원 액션 */}
          <div className="space-y-4">
            <Card className="shadow-sm border-primary/20">
              <CardContent className="p-5">
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground mb-1">지원 마감</p>
                  <p className="text-xl font-bold text-destructive">
                    {job.deadline
                      ? new Date(job.deadline).toLocaleDateString("ko-KR")
                      : "상시 모집"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Link href={`/jobs/${id}/apply`} className="block">
                    <Button className="w-full gap-2 font-semibold shadow-sm" size="lg">
                      <FileText className="h-4 w-4" />
                      지원하기 (포트폴리오 생성)
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    className="w-full gap-2 font-semibold"
                    size="lg"
                    onClick={handleStudy}
                    disabled={isStudying}
                  >
                    {isStudying
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <GraduationCap className="h-4 w-4" />}
                    커리큘럼 생성
                  </Button>
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  지원 전 기업 공식 채용 페이지에서 최신 공고를 확인하세요
                </p>
              </CardContent>
            </Card>

            {/* 나의 준비 현황 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  나의 준비 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {job.my_match_score !== null ? (
                  <>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">전체 매칭도</span>
                        <span className="font-semibold text-primary">{Math.round(job.my_match_score)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${job.my_match_score}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      상태: {job.my_match_status ?? "분석 중"}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    매칭 점수를 분석 중입니다.
                    <br />
                    <Link href="/profile" className="text-primary hover:underline">플랫폼 연동</Link> 후 정확도가 높아집니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
