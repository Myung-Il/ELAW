"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import { Search, Briefcase, ChevronRight, SlidersHorizontal, Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"

interface Company {
  id: number
  name: string
  industry?: string
  logo_url?: string | null
}

interface JobPosting {
  id: number
  title: string
  company: Company
  job_role: string
  career_level: string
  deadline: string | null
  is_active: boolean
  description?: string
  required_skills?: string[]
  preferred_skills?: string[]
  my_match_score?: number
  is_scrapped?: boolean
}

interface JobsResponse {
  count?: number
  results?: JobPosting[]
  data?: JobPosting[]
  message?: string
}

// 기업 영문 첫 글자 반환 (영문 포함 시 해당 문자, 한국어 기업명은 매핑 또는 첫 글자)
function getCompanyInitial(name: string): string {
  const ascii = name.match(/[A-Za-z]/)
  if (ascii) return ascii[0].toUpperCase()
  const koMap: Record<string, string> = {
    "카카오페이": "K", "카카오뱅크": "K", "카카오게임즈": "K", "카카오": "K",
    "네이버클라우드": "N", "네이버웹툰": "N", "네이버": "N",
    "라인플러스": "L", "라인": "L",
    "쿠팡": "C", "배달의민족": "B", "토스": "T", "당근": "D",
    "삼성": "S", "현대": "H", "롯데": "R", "신한": "S",
    "크래프톤": "K", "엔씨소프트": "N", "넷마블": "N",
    "무신사": "M", "야놀자": "Y", "직방": "Z",
  }
  for (const [ko, initial] of Object.entries(koMap)) {
    if (name.startsWith(ko)) return initial
  }
  return name.charAt(0).toUpperCase()
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [selectedRole, setSelectedRole] = useState("전체")
  const [roleFilters, setRoleFilters] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 전체 직무 목록을 한 번만 로드해서 필터 버튼 생성
  useEffect(() => {
    api.get<JobsResponse | JobPosting[]>("/api/jobs/?active_only=true")
      .then((data: JobsResponse | JobPosting[]) => {
        const list: JobPosting[] = Array.isArray(data) ? data : ((data as JobsResponse).data ?? (data as JobsResponse).results ?? [])
        const roles = Array.from(new Set(list.map((j) => j.job_role).filter(Boolean)))
        setRoleFilters(roles)
      })
      .catch(() => {})
  }, [])

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (selectedRole !== "전체") params.set("job_role", selectedRole)
      params.set("active_only", "true")

      const data = await api.get<JobsResponse | JobPosting[]>(`/api/jobs/?${params}`)
      const list = Array.isArray(data) ? data : ((data as JobsResponse).data ?? (data as JobsResponse).results ?? [])
      const count = Array.isArray(data) ? data.length : ((data as JobsResponse).count ?? list.length)
      setJobs(list)
      setTotal(count)
    } catch (err) {
      console.error("공고 목록 로드 실패:", err)
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedRole])

  useEffect(() => {
    const timer = setTimeout(fetchJobs, 300)
    return () => clearTimeout(timer)
  }, [fetchJobs])

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">기업 공고</h1>
          <p className="text-muted-foreground text-sm">
            AI가 나의 학습 데이터를 분석해 맞춤 기업을 추천합니다
          </p>
        </div>

        {/* 검색 & 필터 */}
        <div className="mb-6 space-y-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="기업명 또는 직무로 검색"
              className="pl-10 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <button
              type="button"
              onClick={() => setSelectedRole("전체")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                selectedRole === "전체"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              전체
            </button>
            {roleFilters.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  selectedRole === role
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{total}</span>개의 공고
        </p>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Search className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p className="font-medium">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 검색어나 필터를 사용해보세요</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {jobs.map((job) => (
              <Link href={`/jobs/${job.id}`} key={job.id}>
                <Card className="h-full cursor-pointer card-hover group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                        {getCompanyInitial(job.company?.name ?? "")}
                      </div>
                      {job.my_match_score !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          매칭 {Math.round(job.my_match_score)}%
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">{job.company?.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{job.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Briefcase className="h-3 w-3 text-primary flex-shrink-0" />
                      <Badge variant="outline" className="text-xs">{job.job_role}</Badge>
                      <Badge variant="outline" className="text-xs">{job.career_level}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {job.deadline ? (
                        <span className="text-xs font-medium text-destructive">
                          {new Date(job.deadline).toLocaleDateString("ko-KR")} 마감
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">상시 모집</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
