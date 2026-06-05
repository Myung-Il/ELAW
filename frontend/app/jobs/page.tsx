"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import AppHeader from "@/components/layout/app-header"
import {
  Search, Briefcase, ChevronRight, SlidersHorizontal,
  Loader2, LayoutGrid, X, Star, Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
  view_count?: number
}

interface JobsResponse {
  count?: number
  results?: JobPosting[]
  data?: JobPosting[]
  message?: string
}

interface Goal {
  id: number
  job_role: string
}

// 마크다운 마커(**, -, ---)를 제거한 평문 미리보기 (카드 2줄 요약용)
function toPlainPreview(md?: string): string {
  if (!md) return ""
  return md
    .replace(/\r\n/g, "\n")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*-{3,}\s*$/gm, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

// 기업명 → 이니셜
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

// 목표 직무 기반 관련도 점수 (높을수록 유사)
function roleRelevanceScore(role: string, goalRole: string): number {
  if (!goalRole) return 0
  const rLower = role.toLowerCase()
  const gLower = goalRole.toLowerCase()
  if (rLower === gLower) return 100
  const gWords = gLower.split(/[\s/·,]+/).filter(Boolean)
  const rWords = rLower.split(/[\s/·,]+/).filter(Boolean)
  let score = 0
  for (const gw of gWords) {
    for (const rw of rWords) {
      if (rw.includes(gw) || gw.includes(rw)) score += 10
    }
  }
  return score
}

const PRIORITY_COUNT = 5

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [selectedRole, setSelectedRole] = useState("전체")
  const [roleFilters, setRoleFilters] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userGoalRole, setUserGoalRole] = useState("")
  const [allRolesOpen, setAllRolesOpen] = useState(false)
  const [dialogSearch, setDialogSearch] = useState("")

  // 사용자 목표 직무 로드
  useEffect(() => {
    api.get<Goal[]>("/api/core/goals/")
      .then((goals) => {
        if (Array.isArray(goals) && goals.length > 0) {
          setUserGoalRole(goals[0].job_role ?? "")
        }
      })
      .catch(() => {})
  }, [])

  // 전체 직무 목록 로드 (roles_only: 페이지네이션과 무관하게 전체 직무 반환)
  useEffect(() => {
    api.get<{ data?: string[] } | string[]>("/api/jobs/?active_only=true&roles_only=true")
      .then((data) => {
        const roles: string[] = Array.isArray(data) ? data : (data?.data ?? [])
        setRoleFilters(Array.from(new Set(roles.filter(Boolean))))
      })
      .catch(() => {})
  }, [])

  // 목표 직무 기준으로 정렬된 직무 목록
  const sortedRoles = useMemo(() => {
    if (!userGoalRole) return roleFilters
    return [...roleFilters].sort((a, b) => {
      const diff = roleRelevanceScore(b, userGoalRole) - roleRelevanceScore(a, userGoalRole)
      return diff !== 0 ? diff : a.localeCompare(b)
    })
  }, [roleFilters, userGoalRole])

  // 필터 바에 표시할 우선 직무 (최대 PRIORITY_COUNT개)
  const priorityRoles = useMemo(() => sortedRoles.slice(0, PRIORITY_COUNT), [sortedRoles])

  // selectedRole이 priorityRoles 밖에 있을 때 (다이얼로그에서 선택한 경우)
  const isOutsidePriority = selectedRole !== "전체" && !priorityRoles.includes(selectedRole)

  // 다이얼로그 내 검색 필터된 직무
  const dialogRoles = useMemo(() => {
    const q = dialogSearch.trim().toLowerCase()
    if (!q) return sortedRoles
    return sortedRoles.filter((r) => r.toLowerCase().includes(q))
  }, [sortedRoles, dialogSearch])

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (selectedRole !== "전체") params.set("job_role", selectedRole)
      params.set("active_only", "true")
      params.set("limit", "100")   // 데이터셋 공고가 많아 한 번에 더 노출

      const data = await api.get<JobsResponse | JobPosting[]>(`/api/jobs/?${params}`)
      const list = Array.isArray(data)
        ? data
        : ((data as JobsResponse).data ?? (data as JobsResponse).results ?? [])
      const count = Array.isArray(data)
        ? data.length
        : ((data as JobsResponse).count ?? list.length)
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

  const selectRole = (role: string) => {
    setSelectedRole(role)
    setAllRolesOpen(false)
  }

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
        <div className="mb-6 space-y-3">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="기업명 또는 직무로 검색"
              className="pl-10 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* 직무 필터 바 */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* 전체 버튼 */}
            <button
              type="button"
              onClick={() => setSelectedRole("전체")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                selectedRole === "전체"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary"
              )}
            >
              전체
            </button>

            {/* 우선 직무 (목표 기반 상위 N개) */}
            {priorityRoles.map((role) => {
              const isGoal = role === userGoalRole
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    selectedRole === role
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary"
                  )}
                >
                  {isGoal && (
                    <Star className="h-2.5 w-2.5 fill-current opacity-80" />
                  )}
                  {role}
                </button>
              )
            })}

            {/* 다이얼로그에서 선택된 비우선 직무 표시 */}
            {isOutsidePriority && (
              <span className="flex items-center gap-1 rounded-full border border-primary bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
                {selectedRole}
                <button
                  type="button"
                  onClick={() => setSelectedRole("전체")}
                  className="hover:opacity-70 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* 전체 직무 카테고리 버튼 */}
            {roleFilters.length > PRIORITY_COUNT && (
              <button
                type="button"
                onClick={() => { setDialogSearch(""); setAllRolesOpen(true) }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  allRolesOpen
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-dashed border-border bg-card hover:border-primary text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3 w-3" />
                전체 직무
                <span className="tabular-nums">+{roleFilters.length - PRIORITY_COUNT}</span>
              </button>
            )}
          </div>

          {/* 목표 직무 안내 */}
          {userGoalRole && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-amber-500" />
              목표 직무
              <span className="font-medium text-foreground">{userGoalRole}</span>
              와 관련된 카테고리를 우선 표시합니다
            </p>
          )}
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{total}</span>개의 공고
          {selectedRole !== "전체" && (
            <span className="ml-1">
              · <span className="font-medium text-foreground">{selectedRole}</span> 필터 적용 중
            </span>
          )}
        </p>

        {/* 공고 목록 */}
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
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{toPlainPreview(job.description)}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Briefcase className="h-3 w-3 text-primary flex-shrink-0" />
                      <Badge variant="outline" className="text-xs">{job.job_role}</Badge>
                      <Badge variant="outline" className="text-xs">{job.career_level}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {job.deadline ? (
                          <span className="text-xs font-medium text-destructive">
                            {new Date(job.deadline).toLocaleDateString("ko-KR")} 마감
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">상시 모집</span>
                        )}
                        {job.view_count !== undefined && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            {job.view_count.toLocaleString("ko-KR")}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 전체 직무 카테고리 다이얼로그 */}
      <Dialog open={allRolesOpen} onOpenChange={setAllRolesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              전체 직무 카테고리
              <span className="text-sm font-normal text-muted-foreground ml-1">{roleFilters.length}개</span>
            </DialogTitle>
          </DialogHeader>

          {/* 다이얼로그 내 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              className="w-full h-8 pl-8 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              placeholder="직무 검색..."
              value={dialogSearch}
              onChange={(e) => setDialogSearch(e.target.value)}
              autoFocus
            />
            {dialogSearch && (
              <button
                type="button"
                onClick={() => setDialogSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 전체 선택 */}
          <button
            type="button"
            onClick={() => selectRole("전체")}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-all",
              selectedRole === "전체"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            전체 직무
          </button>

          {/* 직무 목록 */}
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {dialogRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">검색 결과가 없습니다</p>
            ) : dialogRoles.map((role) => {
              const isGoal = role === userGoalRole
              const score = roleRelevanceScore(role, userGoalRole)
              const isRelated = score > 0
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-sm transition-all flex items-center justify-between gap-2",
                    selectedRole === role
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    {isGoal && <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />}
                    {!isGoal && isRelated && <span className="w-3.5 h-3.5 flex-shrink-0 rounded-full bg-primary/20 border border-primary/30" />}
                    {!isGoal && !isRelated && <span className="w-3.5 flex-shrink-0" />}
                    {role}
                  </span>
                  {isGoal && (
                    <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 flex-shrink-0">내 목표</Badge>
                  )}
                  {!isGoal && isRelated && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">관련</span>
                  )}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
