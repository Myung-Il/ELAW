"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import { Search, Briefcase, ChevronRight, SlidersHorizontal, Loader2, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"

interface JobPosting {
  id: number
  company_name: string
  title: string
  description: string
  required_skills: string[]
  preferred_skills: string[]
  job_role: string
  career_level: string
  is_active: boolean
  view_count: number
  deadline: string | null
  match_score?: number
}

const LOGO_COLORS = [
  "bg-blue-500", "bg-yellow-500", "bg-red-500", "bg-orange-500",
  "bg-sky-500", "bg-green-500", "bg-slate-500", "bg-teal-500",
  "bg-purple-500", "bg-pink-500",
]

function deadlineBadge(deadline: string | null): string {
  if (!deadline) return "상시"
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (diff < 0)  return "마감"
  if (diff === 0) return "D-Day"
  return `D-${diff}`
}

export default function JobsPage() {
  const [search, setSearch]           = useState("")
  const [selectedField, setSelectedField] = useState("전체")
  const [postings, setPostings]       = useState<JobPosting[]>([])
  const [loading, setLoading]         = useState(true)
  const [matching, setMatching]       = useState(false)
  const [matchMap, setMatchMap]       = useState<Record<number, number>>({})

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await api.getJobPostings()
        if (!res.ok) return
        const data = await res.json()
        setPostings((data || []).filter((j: JobPosting) => j.is_active))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleGenerateMatches = async () => {
    setMatching(true)
    try {
      const res  = await api.generateMatches()
      if (!res.ok) return
      const data = await res.json()
      const map: Record<number, number> = {}
      for (const m of data.matches || []) map[m.posting_id] = m.match_score
      setMatchMap(map)
    } finally {
      setMatching(false)
    }
  }

  // Collect unique job_roles for filter tabs
  const fields = ["전체", ...Array.from(new Set(postings.map(p => p.job_role).filter(Boolean)))]

  const filtered = postings.filter(p => {
    const matchesSearch = p.company_name.includes(search) || p.title.includes(search) || p.job_role.includes(search)
    const matchesField  = selectedField === "전체" || p.job_role === selectedField
    return matchesSearch && matchesField
  })

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">기업 공고</h1>
            <p className="text-muted-foreground text-sm">AI가 나의 학습 데이터를 분석해 맞춤 기업을 추천합니다</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleGenerateMatches}
            disabled={matching}
          >
            {matching
              ? <><Loader2 className="h-4 w-4 animate-spin" />매칭 분석 중...</>
              : <><RefreshCw className="h-4 w-4" />매칭 분석</>}
          </Button>
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
            {fields.slice(0, 10).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setSelectedField(field)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  selectedField === field
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              총 <span className="font-semibold text-foreground">{filtered.length}</span>개의 공고
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((job, i) => {
                const logo    = job.company_name.charAt(0)
                const color   = LOGO_COLORS[i % LOGO_COLORS.length]
                const deadline = deadlineBadge(job.deadline)
                const score   = matchMap[job.id]

                return (
                  <Link href={`/jobs/${job.id}`} key={job.id}>
                    <Card className="h-full cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white font-bold shadow-sm`}>
                            {logo}
                          </div>
                          {score !== undefined && (
                            <Badge variant="secondary" className="text-xs">매칭 {score}%</Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{job.company_name}</CardTitle>
                        <CardDescription className="text-sm font-medium text-foreground/70 line-clamp-1">
                          {job.title}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {job.description || `${job.company_name} ${job.job_role} 채용 공고`}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3 text-primary" />
                              {job.career_level || "신입"}
                            </span>
                            <Badge variant="outline" className="text-xs">{job.job_role}</Badge>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-xs font-semibold ${deadline === "마감" ? "text-muted-foreground" : "text-destructive"}`}>
                            {deadline} 마감
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>

            {filtered.length === 0 && (
              <div className="py-20 text-center text-muted-foreground">
                <Search className="mx-auto mb-4 h-12 w-12 opacity-30" />
                <p className="font-medium">검색 결과가 없습니다</p>
                <p className="text-sm mt-1">다른 검색어나 필터를 사용해보세요</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
