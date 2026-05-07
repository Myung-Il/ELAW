// ═══════════════════════════════════════════════════════════════════════════
// 공부 목록 페이지  (/study)
// ───────────────────────────────────────────────────────────────────────────
// - 로그인한 사용자만 접근 가능 (비로그인 시 /home 또는 / 에서 보이는 미리보기만 제공)
// - 커리큘럼에 포함된 공부 주제 목록을 표시
// - 각 항목 클릭 → 설명 및 예시 문제 상세 토글
// - [커리큘럼 수정] 버튼 활성화 시 각 항목의 커리큘럼 포함 여부를 토글 가능
// ═══════════════════════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/layout/app-header"
import {
  BookOpen, ChevronRight, ChevronDown, Trophy, Clock,
  Code, GraduationCap, Edit2, CheckCircle2, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── 공부 목록 데이터 ─────────────────────────────────────────────────────
// [FE 수정 매뉴얼] studyList를 GET /api/v1/study/my-list API로 교체
//   - 로그인한 사용자의 커리큘럼에 포함된 주제 + 전체 주제 목록 응답
//   - 헤더: Authorization: Bearer {accessToken}
// [BE 매뉴얼] GET /api/v1/study/my-list
//   Response: {
//     items: [{
//       id: number,
//       title: string,
//       category: string (예: "자료구조", "알고리즘"),
//       difficulty: "하" | "중" | "상",
//       problems: number (관련 문제 수),
//       duration: string (예: "2시간"),
//       desc: string (주제 설명),
//       examples: [{ title, level: "쉬움"|"보통"|"어려움", platform }],
//       inCurriculum: boolean (현재 사용자 커리큘럼 포함 여부)
//     }]
//   }
// [DB 매뉴얼]
//   StudyTopics 테이블: id, title, category, description, difficulty, estimated_hours
//   ExampleProblems 테이블: id, topic_id, title, level("easy"|"medium"|"hard"), platform
//   UserCurriculumTopics 테이블: user_id, topic_id (N:M 관계 - 커리큘럼 포함 여부)
const studyList = [
  {
    id: 1,
    title: "이진 탐색 트리 (BST)",
    category: "자료구조",
    difficulty: "중",
    problems: 12,
    duration: "2시간",
    desc: "이진 탐색 트리는 각 노드가 최대 두 개의 자식 노드를 가지며, 왼쪽 서브트리의 모든 값은 루트보다 작고, 오른쪽 서브트리의 모든 값은 루트보다 큰 자료구조입니다. 검색, 삽입, 삭제 연산을 O(log n) 시간에 수행할 수 있습니다.",
    examples: [
      { title: "BST에서 최솟값 찾기", level: "쉬움", platform: "백준" },
      { title: "이진 탐색 트리 검증", level: "보통", platform: "LeetCode" },
      { title: "BST의 k번째 작은 원소", level: "보통", platform: "LeetCode" },
    ],
    inCurriculum: true,
  },
  {
    id: 2,
    title: "다이나믹 프로그래밍",
    category: "알고리즘",
    difficulty: "상",
    problems: 20,
    duration: "4시간",
    desc: "동적 프로그래밍(DP)은 복잡한 문제를 더 작은 하위 문제로 나누어 해결하는 알고리즘 설계 기법입니다. 메모이제이션(하향식)과 타뷸레이션(상향식) 두 가지 접근 방법이 있으며, 피보나치, LCS, 배낭 문제 등 다양한 곳에 응용됩니다.",
    examples: [
      { title: "피보나치 수열 (DP)", level: "쉬움", platform: "프로그래머스" },
      { title: "계단 오르기", level: "보통", platform: "백준" },
      { title: "LCS (최장 공통 부분 수열)", level: "어려움", platform: "백준" },
    ],
    inCurriculum: true,
  },
  {
    id: 3,
    title: "그래프 탐색 (BFS/DFS)",
    category: "알고리즘",
    difficulty: "중",
    problems: 15,
    duration: "3시간",
    desc: "그래프는 정점(Vertex)과 간선(Edge)으로 이루어진 자료구조로, BFS(너비 우선 탐색)는 최단 경로 문제에, DFS(깊이 우선 탐색)는 경로 탐색 및 백트래킹에 주로 사용됩니다.",
    examples: [
      { title: "미로 최단 경로 (BFS)", level: "보통", platform: "백준" },
      { title: "섬의 개수 세기 (DFS)", level: "보통", platform: "LeetCode" },
      { title: "사이클 감지", level: "어려움", platform: "LeetCode" },
    ],
    inCurriculum: true,
  },
  {
    id: 4,
    title: "해시 테이블",
    category: "자료구조",
    difficulty: "중",
    problems: 10,
    duration: "2시간",
    desc: "해시 테이블은 키-값 쌍을 저장하는 자료구조로, 해시 함수를 이용해 O(1) 평균 시간에 검색, 삽입, 삭제가 가능합니다. 충돌 처리 방법(체이닝, 개방 주소법)을 이해하는 것이 중요합니다.",
    examples: [
      { title: "두 수의 합 (Two Sum)", level: "쉬움", platform: "LeetCode" },
      { title: "완주하지 못한 선수", level: "쉬움", platform: "프로그래머스" },
      { title: "전화번호 목록", level: "보통", platform: "프로그래머스" },
    ],
    inCurriculum: false,
  },
  {
    id: 5,
    title: "정렬 알고리즘",
    category: "알고리즘",
    difficulty: "중",
    problems: 12,
    duration: "2.5시간",
    desc: "다양한 정렬 알고리즘(버블, 선택, 삽입, 합병, 퀵, 힙 정렬)의 시간/공간 복잡도를 이해하고 각 상황에 맞는 정렬 알고리즘을 선택할 수 있어야 합니다.",
    examples: [
      { title: "K번째 큰 원소", level: "보통", platform: "LeetCode" },
      { title: "회의실 배정", level: "보통", platform: "백준" },
      { title: "가장 큰 수 만들기", level: "어려움", platform: "프로그래머스" },
    ],
    inCurriculum: true,
  },
]

// 난이도별 색상 클래스 매핑
const difficultyColor: Record<string, string> = {
  하: "bg-green-100 text-green-700",
  중: "bg-yellow-100 text-yellow-700",
  상: "bg-red-100 text-red-700",
}

// 문제 난이도별 색상 클래스 매핑
const levelColor: Record<string, string> = {
  쉬움: "text-green-600",
  보통: "text-yellow-600",
  어려움: "text-red-600",
}

export default function StudyPage() {
  // 현재 펼쳐진 항목의 ID (null = 모두 닫힘)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // 커리큘럼 수정 모드 (true일 때 각 항목에 추가/제외 버튼 표시)
  const [editMode, setEditMode] = useState(false)

  // 각 주제의 커리큘럼 포함 여부 상태
  // [FE 수정 매뉴얼] 수정 완료 시 PUT /api/v1/curriculum/me/topics 호출로 서버에 저장
  // [BE 매뉴얼] PUT /api/v1/curriculum/me/topics
  //   Request: { topic_ids: number[] } (현재 커리큘럼에 포함된 모든 topic id 배열)
  //   Response: { success: true, updatedAt: string }
  // [DB 매뉴얼] UserCurriculumTopics 테이블: 기존 rows 삭제 후 새 rows INSERT (REPLACE 방식)
  const [inCurriculum, setInCurriculum] = useState<Record<number, boolean>>(
    Object.fromEntries(studyList.map((s) => [s.id, s.inCurriculum]))
  )

  // 항목 펼치기/접기 토글
  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // 커리큘럼 포함/제외 토글 (편집 모드에서만 동작)
  const toggleCurriculum = (id: number) => {
    setInCurriculum((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">

        {/* ── 페이지 헤더 ──────────────────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">공부 목록</h1>
            <p className="text-sm text-muted-foreground">
              ELAW에서 제공하는 학습 주제 목록 · 클릭하면 상세 내용과 예시 문제를 볼 수 있어요
            </p>
          </div>
          {/* 커리큘럼 수정 토글 버튼 */}
          {/* 수정 모드 활성화 시 각 항목에 커리큘럼 추가/제외 버튼이 표시됨 */}
          <Button
            variant={editMode ? "default" : "outline"}
            className="gap-2"
            onClick={() => setEditMode(!editMode)}
          >
            <Edit2 className="h-4 w-4" />
            {editMode ? "수정 완료" : "커리큘럼 수정"}
          </Button>
        </div>

        {/* ── 공부 목록 아코디언 ────────────────────────────────────────── */}
        {/* [FE 수정 매뉴얼] studyList 배열을 GET /api/v1/study/my-list API 데이터로 교체 */}
        <div className="space-y-3">
          {studyList.map((item) => {
            const isExpanded = expandedId === item.id
            const isInCurriculum = inCurriculum[item.id]

            return (
              <Card key={item.id} className={cn(
                "shadow-sm overflow-hidden transition-all",
                isExpanded && "border-primary/50 ring-1 ring-primary/20"
              )}>
                {/* ── 항목 헤더 (클릭 시 상세 토글) ─────────────────────── */}
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => toggleExpand(item.id)}
                  aria-expanded={isExpanded}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* 북 아이콘 */}
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{item.title}</p>
                        {/* 내 커리큘럼 포함 여부 뱃지 */}
                        {isInCurriculum && (
                          <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1">
                            <GraduationCap className="h-2.5 w-2.5" />
                            내 커리큘럼
                          </Badge>
                        )}
                      </div>
                      {/* 카테고리 · 문제 수 · 예상 시간 */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.category}</span>
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {item.problems}문제
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.duration}
                        </span>
                      </div>
                    </div>

                    {/* 난이도 뱃지 + 토글 화살표 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={cn("text-xs border-0", difficultyColor[item.difficulty])}>
                        {item.difficulty}
                      </Badge>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardContent>
                </button>

                {/* ── 상세 내용 패널 (확장 시에만 렌더링) ─────────────────── */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-4 bg-muted/20">
                    {/* 주제 설명 */}
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.desc}</p>

                    {/* 예시 문제 목록 */}
                    {/* [FE 수정 매뉴얼] 각 예시 문제에 링크(백준/LeetCode/프로그래머스 URL) 추가 가능 */}
                    {/* [DB 매뉴얼] ExampleProblems.external_url 컬럼으로 외부 링크 저장 */}
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        예시 문제
                      </h4>
                      <div className="space-y-2">
                        {item.examples.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-card border px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Code className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="text-sm font-medium">{ex.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-medium", levelColor[ex.level])}>
                                {ex.level}
                              </span>
                              <Badge variant="secondary" className="text-xs">{ex.platform}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 커리큘럼 추가/제외 버튼 (편집 모드에서만 표시) */}
                    {editMode && (
                      <div className="flex items-center gap-3 pt-2 border-t">
                        <p className="text-xs text-muted-foreground flex-1">
                          {isInCurriculum ? "현재 내 커리큘럼에 포함되어 있습니다" : "내 커리큘럼에 포함되지 않은 항목입니다"}
                        </p>
                        {/* stopPropagation: 버튼 클릭 시 아코디언 토글이 함께 실행되지 않도록 방지 */}
                        <Button
                          size="sm"
                          variant={isInCurriculum ? "outline" : "default"}
                          className="gap-1 text-xs"
                          onClick={(e) => { e.stopPropagation(); toggleCurriculum(item.id) }}
                        >
                          {isInCurriculum ? (
                            <><X className="h-3 w-3" />커리큘럼 제외</>
                          ) : (
                            <><CheckCircle2 className="h-3 w-3" />커리큘럼 추가</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}