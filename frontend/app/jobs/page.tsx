// 기업 공고 목록 페이지
// 검색/필터로 기업을 찾고 클릭 시 해당 기업 상세 페이지(/jobs/[id])로 이동
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import { Search, Briefcase, ChevronRight, SlidersHorizontal } from "lucide-react"

// ─── 기업 공고 더미 데이터 ─────────────────────────────────────────────────
// [FE 수정 매뉴얼] companies 배열을 GET /api/v1/jobs 로 교체
// [BE 매뉴얼] GET /api/v1/jobs?field=&search=&page=1&limit=12
//   Response: { jobs: [...], total, page, totalPages }
// [DB 매뉴얼] JobPostings 테이블: id, company_id, title, field, deadline, status, description
const companies = [
  { id: 1, company: "삼성전자", position: "SW 개발 신입", field: "IT/반도체", deadline: "D-7", logo: "S", color: "bg-blue-500", match: 94, positions: 50, desc: "삼성전자 MX사업부 소프트웨어 개발 신입사원 모집" },
  { id: 2, company: "카카오", position: "서버 개발 인턴", field: "IT", deadline: "D-14", logo: "K", color: "bg-yellow-500", match: 89, positions: 20, desc: "카카오 AI 플랫폼팀 서버 개발 인턴십 모집" },
  { id: 3, company: "LG전자", position: "임베디드 SW 개발", field: "전자", deadline: "D-21", logo: "L", color: "bg-red-500", match: 85, positions: 30, desc: "LG전자 H&A사업부 임베디드 소프트웨어 개발자" },
  { id: 4, company: "SK하이닉스", position: "반도체 공정 엔지니어", field: "반도체", deadline: "D-30", logo: "SK", color: "bg-orange-500", match: 78, positions: 15, desc: "SK하이닉스 DRAM 공정 설계 및 개발 엔지니어" },
  { id: 5, company: "현대자동차", position: "자율주행 SW 개발", field: "자동차", deadline: "D-10", logo: "H", color: "bg-sky-500", match: 82, positions: 25, desc: "현대자동차 SDV(Software Defined Vehicle) 부문 개발자" },
  { id: 6, company: "네이버", position: "AI 연구 개발", field: "IT", deadline: "D-18", logo: "N", color: "bg-green-500", match: 76, positions: 10, desc: "네이버 AI Lab 자연어처리/컴퓨터비전 연구개발자" },
  { id: 7, company: "포스코", position: "공정 엔지니어", field: "철강/소재", deadline: "D-25", logo: "P", color: "bg-slate-500", match: 71, positions: 35, desc: "POSCO 철강 생산 공정 최적화 엔지니어 모집" },
  { id: 8, company: "두산로보틱스", position: "로봇 SW 개발", field: "로봇/자동화", deadline: "D-12", logo: "D", color: "bg-teal-500", match: 80, positions: 8, desc: "협동 로봇 제어 소프트웨어 개발자 모집" },
]

const fields = ["전체", "IT", "IT/반도체", "반도체", "전자", "자동차", "철강/소재", "로봇/자동화"]

export default function JobsPage() {
  const [search, setSearch] = useState("")
  const [selectedField, setSelectedField] = useState("전체")

  // 검색 및 필터 처리
  // [FE 수정 매뉴얼] 실제 구현 시 검색어/필터 변경 시마다 API 호출 (debounce 적용 권장)
  const filtered = companies.filter((c) => {
    const matchesSearch = c.company.includes(search) || c.position.includes(search)
    const matchesField = selectedField === "전체" || c.field === selectedField
    return matchesSearch && matchesField
  })

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">기업 공고</h1>
          <p className="text-muted-foreground text-sm">
            AI가 나의 학습 데이터를 분석해 맞춤 기업을 추천합니다
          </p>
        </div>

        {/* 검색 & 필터 */}
        <div className="mb-6 space-y-4">
          {/* 검색창 */}
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="기업명 또는 직무로 검색"
              className="pl-10 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* 분야 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {fields.map((field) => (
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

        {/* 검색 결과 */}
        <p className="mb-4 text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{filtered.length}</span>개의 공고
        </p>

        {/* 기업 카드 그리드 */}
        {/* [FE 수정 매뉴얼] filtered 배열을 API 응답 데이터로 교체 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((job) => (
            <Link href={`/jobs/${job.id}`} key={job.id}>
              <Card className="h-full cursor-pointer card-hover group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${job.color} text-white font-bold shadow-sm`}>
                      {job.logo}
                    </div>
                    {/* AI 매칭 점수 */}
                    <Badge variant="secondary" className="text-xs">
                      매칭 {job.match}%
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{job.company}</CardTitle>
                  <CardDescription className="text-sm font-medium text-foreground/70 line-clamp-1">
                    {job.position}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{job.desc}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-primary" />
                        {job.positions}명 모집
                      </span>
                      <Badge variant="outline" className="text-xs">{job.field}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-destructive">{job.deadline} 마감</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* 검색 결과 없음 */}
        {filtered.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <Search className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p className="font-medium">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 검색어나 필터를 사용해보세요</p>
          </div>
        )}
      </main>
    </div>
  )
}