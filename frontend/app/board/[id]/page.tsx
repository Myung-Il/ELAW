"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import AppHeader from "@/components/layout/app-header"
import { ArrowLeft, Eye, Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"

interface Post {
  id: number
  title: string
  content: string
  category: string
  author_name: string
  view_count: number
  is_pinned: boolean
  created_at: string
  updated_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  notice: "공지", event: "행사", qna: "QnA",
}
const CATEGORY_STYLE: Record<string, string> = {
  notice: "bg-blue-100 text-blue-700",
  event: "bg-orange-100 text-orange-700",
  qna: "bg-green-100 text-green-700",
}

export default function BoardPostPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<{ data: Post } | Post>(`/api/board/${id}/`)
      .then((res) => {
        setPost("data" in res && !Array.isArray(res) ? (res as { data: Post }).data : res as Post)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [id])

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

  if (!post) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">게시글을 찾을 수 없습니다.</p>
          <Button variant="outline" onClick={() => router.back()}>돌아가기</Button>
        </div>
      </div>
    )
  }

  const style = CATEGORY_STYLE[post.category] ?? "bg-gray-100 text-gray-700"
  const label = CATEGORY_LABELS[post.category] ?? post.category

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-3xl">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          게시판으로 돌아가기
        </button>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            {/* 카테고리 + 제목 */}
            <div className="mb-4">
              <Badge className={`${style} border-0 text-xs mb-3`}>{label}</Badge>
              <h1 className="text-xl font-bold leading-snug">{post.title}</h1>
            </div>

            {/* 메타 정보 */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6 pb-4 border-b">
              <span>{post.author_name}</span>
              <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.view_count?.toLocaleString() ?? 0}
              </span>
            </div>

            {/* 본문 */}
            <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-line">
              {post.content}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
