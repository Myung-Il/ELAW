"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import AppHeader from "@/components/layout/app-header"
import {
  MessageSquare, Search, Plus, Eye, Bell, Calendar, HelpCircle, Loader2, Pin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { CATEGORY_STYLE, CATEGORY_LABELS } from "@/lib/constants"

interface Post {
  id: number
  title: string
  content: string
  category: string
  author_name: string
  view_count: number
  is_pinned: boolean
  created_at: string
}

interface BoardResponse {
  data?: Post[]
  results?: Post[]
  count?: number
}

const CATEGORIES = ["전체", "notice", "event", "qna"]
// CATEGORY_LABELS, CATEGORY_STYLE → lib/constants.ts 에서 임포트
const CATEGORY_ICONS: Record<string, typeof Bell> = {
  notice: Bell, event: Calendar, qna: HelpCircle,
}

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("전체")
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newPost, setNewPost] = useState({ title: "", category: "qna", content: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchPosts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== "전체") params.set("category", activeCategory)
      if (search.trim()) params.set("search", search.trim())

      const res = await api.get<BoardResponse | Post[]>(`/api/board/?${params}`)
      const list = Array.isArray(res) ? res : (res.data ?? res.results ?? [])
      setPosts(list)
    } catch (err) {
      console.error("게시판 로드 실패:", err)
    } finally {
      setIsLoading(false)
    }
  }, [activeCategory, search])

  useEffect(() => {
    const t = setTimeout(fetchPosts, 200)
    return () => clearTimeout(t)
  }, [fetchPosts])

  const handleCreate = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return
    setIsSubmitting(true)
    try {
      const res = await api.post<{ data: Post } | Post>("/api/board/", newPost)
      const created = "data" in res ? (res as { data: Post }).data : res as Post
      setPosts([created, ...posts])
      setNewPost({ title: "", category: "qna", content: "" })
      setIsCreateOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("403")) {
        alert("관리자만 공지·행사 글을 작성할 수 있습니다.")
      } else {
        console.error("게시글 작성 실패:", err)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const pinnedPosts = posts.filter((p) => p.is_pinned)
  const normalPosts = posts.filter((p) => !p.is_pinned)

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
        {/* QnA 배너 */}
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

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Q&A 작성하기
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>게시글 작성</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>카테고리</Label>
                    <div className="flex gap-2">
                      {["qna", "notice", "event"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewPost((p) => ({ ...p, category: cat }))}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                            newPost.category === cat
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary",
                          )}
                        >
                          {CATEGORY_LABELS[cat] ?? cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-title">제목</Label>
                    <Input
                      id="post-title"
                      value={newPost.title}
                      onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                      placeholder="제목을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-content">내용</Label>
                    <Textarea
                      id="post-content"
                      value={newPost.content}
                      onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
                      placeholder="내용을 입력하세요"
                      className="min-h-[120px]"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={isSubmitting || !newPost.title.trim() || !newPost.content.trim()}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    작성 완료
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 페이지 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            커뮤니티 게시판
          </h1>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    activeCategory === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {cat === "전체" ? "전체" : CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="검색"
                className="pl-10 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* 고정 게시글 */}
            {pinnedPosts.map((post) => (
              <PostRow key={post.id} post={post} pinned />
            ))}
            {pinnedPosts.length > 0 && normalPosts.length > 0 && (
              <div className="border-t my-2" />
            )}
            {/* 일반 게시글 */}
            {normalPosts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
            {posts.length === 0 && (
              <div className="py-20 text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-30" />
                <p className="font-medium">게시글이 없습니다</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function PostRow({ post, pinned = false }: { post: Post; pinned?: boolean }) {
  const style = CATEGORY_STYLE[post.category] ?? "bg-gray-100 text-gray-700"
  const label = CATEGORY_LABELS[post.category] ?? post.category

  return (
    <Link href={`/board/${post.id}`}>
      <Card className={cn("cursor-pointer transition-all hover:border-primary hover:shadow-sm", pinned && "bg-primary/5")}>
        <CardContent className="flex items-center gap-3 p-4">
          {pinned && <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
          <Badge className={`${style} text-xs flex-shrink-0 border-0`}>{label}</Badge>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{post.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {post.author_name} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.view_count?.toLocaleString() ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
