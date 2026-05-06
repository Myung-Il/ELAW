// 게시판 페이지
// 공지, 행사, QnA 카테고리로 분류된 게시글 CRUD 기능 포함
// 최상단에 QnA 바로가기 배너 포함
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import AppHeader from "@/components/layout/app-header"
import {
  MessageSquare, Search, Plus, Eye, MessageCircle,
  ThumbsUp, Pin, Bell, Calendar, HelpCircle, Edit, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── 게시글 더미 데이터 ───────────────────────────────────────────────────
// [FE 수정 매뉴얼] posts 배열을 GET /api/v1/board?category=&page=1 API로 교체
// [BE 매뉴얼] GET /api/v1/board?category=공지|행사|QnA&search=&page=1&limit=10
//   Response: { posts: [...], total, page, totalPages }
// [DB 매뉴얼] BoardPosts 테이블: id, title, content, category, author_id, views, likes, is_pinned, created_at
const initialPosts = [
  { id: 1, category: "공지", title: "2025년 상반기 취업 설명회 개최 안내", author: "운영팀", date: "2025.04.25", views: 1240, likes: 45, comments: 12, isPinned: true, content: "안녕하세요 ELAW 회원 여러분. 2025년 상반기 취업 설명회를 다음과 같이 개최합니다.\n\n일시: 2025년 5월 15일(목) 14:00 ~ 17:00\n장소: 온라인 (Zoom 링크 추후 공지)\n참가 기업: 삼성전자, 현대자동차, LG전자, SK하이닉스 외 10개사\n\n많은 참여 부탁드립니다!" },
  { id: 2, category: "행사", title: "현대자동차 그룹 채용 설명회 (04.30)", author: "운영팀", date: "2025.04.23", views: 891, likes: 32, comments: 8, isPinned: true, content: "현대자동차 그룹에서 직접 진행하는 채용 설명회입니다.\n\n■ 일시: 2025년 4월 30일(화) 18:00\n■ 장소: 서울대학교 공학관 2층 강당\n■ 내용: 신입 채용 프로세스, 직무 소개, 현직자 Q&A\n■ 사전 신청 필수 (선착순 300명)" },
  { id: 3, category: "QnA", title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?", author: "kim**", date: "2025.04.24", views: 342, likes: 28, comments: 23, isPinned: false, content: "안녕하세요. 이번 5월에 삼성 SW 역량테스트를 보게 되었는데요, 어떻게 준비하면 좋을지 여쭤보고 싶습니다.\n\n현재 알고리즘 중급 수준이고 백준 기준 실버 상위정도 됩니다. 역테 B형 목표인데 어떤 문제 위주로 풀면 좋을까요?" },
  { id: 4, category: "QnA", title: "CS 면접 단골 질문 정리해주실 분 있나요?", author: "park**", date: "2025.04.22", views: 567, likes: 89, comments: 41, isPinned: false, content: "곧 대기업 최종 면접이 있는데 CS 질문들이 너무 방대해서 어떻게 준비해야 할지 모르겠어요. 많이 나오는 것들 위주로 알려주시면 감사하겠습니다!\n\n특히 OS, 네트워크, 데이터베이스 쪽이 약한데 뭘 중점적으로 봐야 할까요?" },
  { id: 5, category: "공지", title: "ELAW 커리큘럼 업데이트 안내 (2025.04 버전)", author: "운영팀", date: "2025.04.20", views: 678, likes: 34, comments: 5, isPinned: false, content: "2025년 4월 커리큘럼 업데이트 내용을 안내드립니다.\n\n주요 변경사항:\n1. 알고리즘 심화 과정 난이도 조정\n2. 신규 문제 150개 추가\n3. 기업별 맞춤 커리큘럼 기능 강화\n4. AI 추천 알고리즘 개선" },
  { id: 6, category: "행사", title: "AI 해커톤 챌린지 2025 참가 모집", author: "운영팀", date: "2025.04.18", views: 1123, likes: 112, comments: 34, isPinned: false, content: "ELAW x 삼성전자 공동 AI 해커톤 챌린지를 개최합니다!\n\n■ 일시: 2025년 5월 3일(토) ~ 4일(일)\n■ 장소: 삼성전자 서울 R&D 캠퍼스\n■ 상금: 1등 1,000만원, 2등 500만원, 3등 200만원\n■ 참가 자격: 전국 공과대학 재학생/졸업생" },
]

const categories = ["전체", "공지", "행사", "QnA"]

const categoryStyle: Record<string, { badge: string; icon: typeof Bell }> = {
  "공지": { badge: "bg-blue-100 text-blue-700", icon: Bell },
  "행사": { badge: "bg-orange-100 text-orange-700", icon: Calendar },
  "QnA": { badge: "bg-green-100 text-green-700", icon: HelpCircle },
}

export default function BoardPage() {
  const [posts, setPosts] = useState(initialPosts)
  const [activeCategory, setActiveCategory] = useState("전체")
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newPost, setNewPost] = useState({ title: "", category: "QnA", content: "" })

  // 필터링
  const filtered = posts.filter((p) => {
    const matchesCategory = activeCategory === "전체" || p.category === activeCategory
    const matchesSearch = p.title.includes(search) || p.content.includes(search)
    return matchesCategory && matchesSearch
  })

  // 게시글 작성 (QnA CRUD - Create)
  // [BE 매뉴얼] POST /api/v1/board
  //   Request: { title, content, category }
  //   Response: { success: true, post: { id, ... } }
  // [DB 매뉴얼] BoardPosts 테이블에 INSERT
  const handleCreate = () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return
    const created = {
      id: posts.length + 1,
      ...newPost,
      author: "나(홍길동)",
      date: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(".", "."),
      views: 0, likes: 0, comments: 0, isPinned: false,
    }
    setPosts([created, ...posts])
    setNewPost({ title: "", category: "QnA", content: "" })
    setIsCreateOpen(false)
  }

  // 게시글 삭제 (QnA CRUD - Delete)
  // [BE 매뉴얼] DELETE /api/v1/board/{id} - 본인 게시글만 삭제 가능
  // [DB 매뉴얼] BoardPosts 테이블에서 DELETE (soft delete 권장)
  const handleDelete = (id: number) => {
    if (confirm("게시글을 삭제하시겠습니까?")) {
      setPosts(posts.filter((p) => p.id !== id))
    }
  }

  const pinnedPosts = filtered.filter((p) => p.isPinned)
  const normalPosts = filtered.filter((p) => !p.isPinned)

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        {/* ── 상단 QnA 배너 (최상단 고정) ────────────────────── */}
        <div className="mb-6 rounded-2xl bg-primary/5 border border-primary/20 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Q&A 게시판</h3>
                <p className="text-xs text-muted-foreground">궁금한 점을 질문하고 답변을 받아보세요</p>
              </div>
            </div>
            {/* QnA 글쓰기 다이얼로그 */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Q&A 작성하기
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>게시글 작성</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  {/* 카테고리 선택 */}
                  <div className="space-y-2">
                    <Label>카테고리</Label>
                    <div className="flex gap-2">
                      {["QnA", "공지", "행사"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewPost((p) => ({ ...p, category: cat }))}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                            newPost.category === cat
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="post-title">제목</Label>
                    <Input
                      id="post-title"
                      placeholder="제목을 입력하세요"
                      value={newPost.title}
                      onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="post-content">내용</Label>
                    <Textarea
                      id="post-content"
                      placeholder="내용을 입력하세요"
                      value={newPost.content}
                      onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                      className="min-h-[200px] resize-y"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                    <Button onClick={handleCreate} disabled={!newPost.title.trim() || !newPost.content.trim()}>
                      작성하기
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 페이지 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4">게시판</h1>

          {/* 검색 + 카테고리 필터 */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="게시글 검색"
                className="pl-10 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    activeCategory === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 게시글 목록 */}
        <Card className="shadow-sm">
          {/* 상단 고정 게시글 */}
          {pinnedPosts.length > 0 && (
            <div className="border-b">
              {pinnedPosts.map((post) => (
                <PostRow key={post.id} post={post} onDelete={handleDelete} isPinned />
              ))}
            </div>
          )}

          {/* 일반 게시글 */}
          {normalPosts.length > 0 ? (
            normalPosts.map((post, i) => (
              <div key={post.id} className={cn(i < normalPosts.length - 1 && "border-b")}>
                <PostRow post={post} onDelete={handleDelete} />
              </div>
            ))
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-30" />
              <p>게시글이 없습니다</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}

// ─── 게시글 행 컴포넌트 ──────────────────────────────────────────────────
interface Post {
  id: number; category: string; title: string; author: string
  date: string; views: number; likes: number; comments: number
  isPinned: boolean; content: string
}

function PostRow({ post, onDelete, isPinned = false }: { post: Post; onDelete: (id: number) => void; isPinned?: boolean }) {
  const style = categoryStyle[post.category]
  const Icon = style?.icon || MessageSquare
  const isMyPost = post.author.includes("나(")

  return (
    <Link href={`/board/${post.id}`}>
      <div className="flex items-start gap-3 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group">
        {/* 카테고리 뱃지 */}
        <Badge className={cn("text-xs flex-shrink-0 border-0 mt-0.5", style?.badge || "bg-gray-100 text-gray-700")}>
          {post.category}
        </Badge>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isPinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
            <p className={cn(
              "font-medium text-sm truncate group-hover:text-primary transition-colors",
              isPinned && "font-semibold"
            )}>
              {post.title}
            </p>
            {post.comments > 0 && (
              <span className="text-xs text-primary font-semibold flex-shrink-0">[{post.comments}]</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{post.author}</span>
            <span>{post.date}</span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {post.likes}
            </span>
          </div>
        </div>

        {/* 내 글인 경우 수정/삭제 버튼 */}
        {/* [FE 수정 매뉴얼] 실제 구현 시 로그인한 사용자 ID와 작성자 ID 비교 */}
        {isMyPost && (
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); }}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="수정"
              aria-label="게시글 수정"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onDelete(post.id) }}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title="삭제"
              aria-label="게시글 삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </Link>
  )
}