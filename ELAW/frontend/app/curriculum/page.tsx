// ═══════════════════════════════════════════════════════════════════════════
// 커리큘럼 현황 페이지  (/curriculum)
// ───────────────────────────────────────────────────────────────────────────
// - 로그인한 사용자만 접근 가능
// - AI가 생성한 12주 학습 커리큘럼의 주간 진행 현황을 표시
// - 우측 패널: AI 학습 인사이트(통계) + 전체 진행률 + 기업 합격자 비교
// - [커리큘럼 수정] 버튼: 수정 모드 활성화 → 각 주차 항목 편집 가능
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  GraduationCap, CheckCircle2, Circle, Lock, Sparkles,
  TrendingUp, Users, Trophy, Edit2, BarChart2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── 커리큘럼 주간 더미 데이터 ────────────────────────────────────────────
// [FE 수정 매뉴얼] curriculum 배열을 GET /api/v1/curriculum/me API로 교체
//   헤더: Authorization: Bearer {accessToken}
// [BE 매뉴얼] GET /api/v1/curriculum/me
//   Response: {
//     weeks: [{
//       week: number,
//       title: string,
//       status: "completed" | "in-progress" | "locked",
//       topics: string[],
//       problems: number,
//       hours: number
//     }],
//     stats: { completedWeeks, totalWeeks, solvedProblems, totalProblems, rank }
//   }
//   - status는 사용자 진행 상황을 서버에서 계산하여 반환
//   - locked: 이전 주차가 완료되지 않아 잠긴 상태
// [DB 매뉴얼]
//   CurriculumWeeks 테이블: id, curriculum_id, week_number, title, topics_json, total_problems, estimated_hours
//   UserWeekProgress 테이블: user_id, week_id, status("completed"|"in-progress"|"locked"), updated_at
//   (curriculum_id는 UserGoals 테이블의 curriculum_id FK)
const curriculum = [
  { week: 1, title: "배열과 연결 리스트", status: "completed", topics: ["배열 조작", "연결 리스트", "스택/큐"], problems: 15, hours: 10 },
  { week: 2, title: "트리 자료구조", status: "completed", topics: ["이진 트리", "BST", "힙"], problems: 18, hours: 12 },
  { week: 3, title: "그래프 기초", status: "completed", topics: ["DFS/BFS", "최단경로", "유니온파인드"], problems: 20, hours: 14 },
  { week: 4, title: "정렬 알고리즘", status: "in-progress", topics: ["퀵/병합 정렬", "계수/기수 정렬", "정렬 응용"], problems: 16, hours: 11 },
  { week: 5, title: "동적 프로그래밍 기초", status: "locked", topics: ["DP 개념", "메모이제이션", "1D DP"], problems: 20, hours: 14 },
  { week: 6, title: "동적 프로그래밍 심화", status: "locked", topics: ["2D DP", "LCS/LIS", "배낭 문제"], problems: 22, hours: 16 },
  { week: 7, title: "그리디 알고리즘", status: "locked", topics: ["그리디 기초", "활동 선택", "허프만 코딩"], problems: 14, hours: 9 },
  { week: 8, title: "고급 그래프 이론", status: "locked", topics: ["플로이드-워샬", "벨만-포드", "최소 신장 트리"], problems: 18, hours: 13 },
  { week: 9, title: "문자열 알고리즘", status: "locked", topics: ["KMP", "트라이", "롤링 해시"], problems: 16, hours: 11 },
  { week: 10, title: "수학적 알고리즘", status: "locked", topics: ["소수판별", "유클리드", "행렬 연산"], problems: 14, hours: 10 },
  { week: 11, title: "비트 마스킹 & 분할 정복", status: "locked", topics: ["비트 연산", "분할정복", "세그먼트 트리"], problems: 16, hours: 12 },
  { week: 12, title: "종합 모의고사", status: "locked", topics: ["전범위 복습", "기업별 기출 문제", "최종 점검"], problems: 30, hours: 20 },
]

// 기업 합격자 비교 데이터
// [FE 수정 매뉴얼] comparison 배열을 GET /api/v1/curriculum/comparison?company_id=1 로 교체
//   - 기업 선택 드롭다운으로 다른 기업과 비교 가능하게 확장 가능
// [BE 매뉴얼] GET /api/v1/curriculum/comparison?company_id={id}
//   Response: { items: [{ topic, myScore, avgScore, company }] }
//   - myScore: 해당 사용자의 주제별 학습 완료도(%) - UserWeekProgress에서 집계
//   - avgScore: 해당 기업 합격자 평균 - CompanyPassStats 테이블에서 조회
// [DB 매뉴얼] CompanyPassStats 테이블: company_id, topic(string), avg_proficiency(int 0~100)
const comparison = [
  { topic: "알고리즘", myScore: 62, avgScore: 77, company: "삼성전자" },
  { topic: "자료구조", myScore: 85, avgScore: 80, company: "삼성전자" },
  { topic: "운영체제", myScore: 45, avgScore: 65, company: "삼성전자" },
  { topic: "데이터베이스", myScore: 28, avgScore: 55, company: "삼성전자" },
  { topic: "네트워크", myScore: 30, avgScore: 50, company: "삼성전자" },
]

// 주차 상태별 아이콘/레이블/색상 설정
const statusConfig = {
  completed: { icon: CheckCircle2, label: "완료", className: "text-primary" },
  "in-progress": { icon: Circle, label: "진행 중", className: "text-accent" },
  locked: { icon: Lock, label: "잠김", className: "text-muted-foreground" },
}

export default function CurriculumPage() {
  // 수정 모드 상태 (true일 때 완료/진행 중 항목에 [수정] 버튼 표시)
  const [isEditing, setIsEditing] = useState(false)

  // ── 요약 통계 계산 ────────────────────────────────────────────────────────
  // [FE 수정 매뉴얼] API 응답의 stats 객체로 교체하면 클라이언트 계산 불필요
  const completedWeeks = curriculum.filter((w) => w.status === "completed").length
  const totalProblems = curriculum.reduce((sum, w) => sum + w.problems, 0)
  const solvedProblems = curriculum
    .filter((w) => w.status === "completed")
    .reduce((sum, w) => sum + w.problems, 0)
  const progressPercent = Math.round((completedWeeks / curriculum.length) * 100)

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-6xl">

        {/* ── 페이지 헤더 ──────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">커리큘럼 현황</h1>
            <p className="text-sm text-muted-foreground">AI가 생성한 맞춤형 12주 학습 커리큘럼</p>
          </div>
          {/* 커리큘럼 수정 버튼 */}
          {/* [FE 수정 매뉴얼] 수정 모드 활성화 시 각 주차 항목을 편집 가능하게 변경 */}
          {/* [BE 매뉴얼] 수정 완료 후 PUT /api/v1/curriculum/me 로 변경 사항 저장 */}
          <Button
            variant={isEditing ? "default" : "outline"}
            className="gap-2"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit2 className="h-4 w-4" />
            {isEditing ? "수정 완료" : "커리큘럼 수정"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── 좌측: 주간 커리큘럼 목록 ────────────────────────────────── */}
          {/* [FE 수정 매뉴얼] curriculum 배열을 API 응답의 weeks 배열로 교체 */}
          <div className="lg:col-span-2 space-y-4">
            {curriculum.map((week) => {
              const config = statusConfig[week.status as keyof typeof statusConfig]
              const Icon = config.icon
              const isLocked = week.status === "locked"

              return (
                <Card
                  key={week.week}
                  className={cn(
                    "shadow-sm transition-all",
                    isLocked ? "opacity-60" : "hover:border-primary/50",
                    week.status === "in-progress" && "border-primary/50 ring-1 ring-primary/20"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* 상태 아이콘 + 주차 번호 */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                        <Icon className={cn("h-6 w-6", config.className)} />
                        <span className="text-xs text-muted-foreground font-medium">{week.week}주</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <h3 className={cn(
                            "font-semibold",
                            isLocked ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {week.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={week.status === "in-progress" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {config.label}
                            </Badge>
                            {/* 진행 중 주차에만 추가 뱃지 표시 */}
                            {week.status === "in-progress" && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                진행 중
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* 주제 태그 목록 */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {week.topics.map((topic) => (
                            <span key={topic} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                              {topic}
                            </span>
                          ))}
                        </div>

                        {/* 문제 수 / 예상 학습 시간 */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            {week.problems}문제
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            예상 {week.hours}시간
                          </span>
                        </div>
                      </div>

                      {/* 수정 모드에서만 수정 버튼 표시 (잠김 항목 제외) */}
                      {isEditing && !isLocked && (
                        <div className="flex-shrink-0">
                          {/* [FE 수정 매뉴얼] 수정 버튼 클릭 시 해당 주차 편집 모달/인라인 입력 구현 */}
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                            수정
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* 수정 모드에서 확정 버튼 표시 */}
            {isEditing && (
              <Card className="border-primary border-2 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    커리큘럼 수정이 완료되면 확정 버튼을 눌러주세요.
                  </p>
                  {/* [FE 수정 매뉴얼] 확정 버튼 클릭 시 PUT /api/v1/curriculum/me 호출 */}
                  <Button
                    className="gap-2"
                    onClick={() => setIsEditing(false)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    커리큘럼 확정
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 우측: 통계 + 비교 패널 ──────────────────────────────────── */}
          <div className="space-y-5">
            {/* AI 학습 인사이트 요약 카드 */}
            {/* [FE 수정 매뉴얼] API 응답의 stats 객체로 각 값을 교체 */}
            <Card className="bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-semibold">AI 학습 인사이트</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "진행 주차", value: `${completedWeeks + 1}주차` },
                    { label: "완료율", value: `${progressPercent}%` },
                    { label: "해결 문제", value: `${solvedProblems}/${totalProblems}` },
                    { label: "학습 랭킹", value: "상위 30%" },
                    // [BE 매뉴얼] "학습 랭킹"은 전체 유저의 progress 집계 후 percentile 계산 필요
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-primary-foreground/10 p-3 text-center">
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-primary-foreground/70 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 전체 진행률 프로그레스 바 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  전체 진행률
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">완료</span>
                    <span className="font-bold text-primary">{progressPercent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedWeeks}/{curriculum.length}주 완료 · {solvedProblems}/{totalProblems}문제 해결
                </p>
              </CardContent>
            </Card>

            {/* 기업 합격자 비교 차트 */}
            {/* [FE 수정 매뉴얼] comparison 배열을 GET /api/v1/curriculum/comparison?company_id={id} 로 교체 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  삼성전자 합격자 비교
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comparison.map((item) => {
                  const isLow = item.myScore < item.avgScore
                  return (
                    <div key={item.topic}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium">{item.topic}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold", isLow ? "text-destructive" : "text-primary")}>
                            나 {item.myScore}%
                          </span>
                          <span className="text-muted-foreground">합격 평균 {item.avgScore}%</span>
                        </div>
                      </div>
                      {/* 이중 프로그레스 바: 합격자 평균(회색)과 나의 점수(primary/red) 오버레이 */}
                      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                        {/* 합격자 평균 레이어 */}
                        <div
                          className="absolute h-full rounded-full bg-muted-foreground/30"
                          style={{ width: `${item.avgScore}%` }}
                        />
                        {/* 나의 점수 레이어 (평균 미달 시 빨간색) */}
                        <div
                          className={cn("absolute h-full rounded-full", isLow ? "bg-destructive/70" : "bg-primary")}
                          style={{ width: `${item.myScore}%` }}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* 범례 */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-4 rounded-full bg-primary" />
                    나의 점수
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-4 rounded-full bg-muted-foreground/30" />
                    합격자 평균
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 다른 기업 기준 비교 버튼 */}
            {/* [FE 수정 매뉴얼] 기업 선택 드롭다운 추가 후 company_id 변경 시 비교 데이터 재요청 */}
            <Link href="/jobs">
              <Button variant="outline" className="w-full gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                다른 기업 기준으로 비교
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}