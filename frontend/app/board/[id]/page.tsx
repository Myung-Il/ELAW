// 게시글 상세 페이지 - Read/Update/Delete (CRUD 중 R/U/D)
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import AppHeader from "@/components/layout/app-header"
import { ArrowLeft, ThumbsUp, Eye, MessageCircle, Edit, Trash2, Send } from "lucide-react"
import { cn } from "@/lib/utils"

// [FE 수정 매뉴얼] 실제 구현 시 GET /api/v1/board/{id} 로 데이터 로드
// [BE 매뉴얼] GET /api/v1/board/{id} → 게시글 상세 + 댓글 목록 반환
// [DB 매뉴얼] BoardPosts JOIN BoardComments + Users 테이블
const mockPost = {
  id: 3, category: "QnA",
  title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?",
  author: "kim**", date: "2025.04.24", views: 342, likes: 28,
  isMyPost: false,
  content: `안녕하세요. 이번 5월에 삼성 SW 역량테스트를 보게 되었는데요, 어떻게 준비하면 좋을지 여쭤보고 싶습니다.

현재 알고리즘 중급 수준이고 백준 기준 실버 상위 정도 됩니다. 역테 B형 목표인데 어떤 문제 위주로 풀면 좋을까요?

구체적으로 궁금한 점:
1. 어떤 유형의 문제들이 자주 나오나요?
2. 몇 개월 준비하면 B형 합격 가능할까요?
3. 추천 문제집이나 강의 있으면 알려주세요!`,
}

const mockComments = [
  { id: 1, author: "lee**", date: "2025.04.24 14:23", content: "저도 작년에 준비했는데요, DP랑 그래프 탐색 위주로 많이 나왔어요. 백준 삼성 기출 문제 세트 꼭 풀어보세요!", likes: 12, isMyComment: false },
  { id: 2, author: "choi**", date: "2025.04.24 15:45", content: "B형 기준으로 보통 3~4개월 정도 준비하면 합격할 수 있어요. 코드트리나 인프런의 삼성 역테 강의 추천드립니다. 특히 구현 문제 많이 풀어보세요!", likes: 8, isMyComment: false },
  { id: 3, author: "나(홍길동)", date: "2025.04.25 10:12", content: "감사합니다! 추천해주신 문제들 풀어볼게요.", likes: 2, isMyComment: true },
]

export default function BoardPostPage() {
  const params = useParams()
  const router = useRouter()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(mockPost.likes)
  const [comments, setComments] = useState(mockComments)
  const [newComment, setNewComment] = useState("")

  // 댓글 작성 (Create)
  // [BE 매뉴얼] POST /api/v1/board/{id}/comments
  //   Request: { content }
  //   Response: { comment: { id, author, content, created_at } }
  // [DB 매뉴얼] BoardComments 테이블: id, post_id, author_id, content, created_at
  const handleComment = () => {
    if (!newComment.trim()) return
    setComments([...comments, {
      id: comments.length + 1,
      author: "나(홍길동)",
      date: "방금 전",
      content: newComment,
      likes: 0,
      isMyComment: true,
    }])
    setNewComment("")
  }

  // 댓글 삭제 (Delete)
  // [BE 매뉴얼] DELETE /api/v1/board/comments/{comment_id}
  const handleDeleteComment = (id: number) => {
    setComments(comments.filter((c) => c.id !== id))
  }

  // 좋아요 토글
  // [BE 매뉴얼] POST /api/v1/board/{id}/like (토글 방식)
  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
  }

  const categoryStyle: Record<string, string> = {
    "공지": "bg-blue-100 text-blue-700",
    "행사": "bg-orange-100 text-orange-700",
    "QnA": "bg-green-100 text-green-700",
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-3xl">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          게시판으로
        </button>

        {/* 게시글 본문 */}
        <Card className="shadow-sm mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Badge className={cn("mb-2 border-0 text-xs", categoryStyle[mockPost.category])}>
                  {mockPost.category}
                </Badge>
                <h1 className="text-xl font-bold">{mockPost.title}</h1>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">{mockPost.author}</span>
                  <span>{mockPost.date}</span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {mockPost.views}
                  </span>
                </div>
              </div>

              {/* 내 글인 경우 수정/삭제 버튼 */}
              {mockPost.isMyPost && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                    <Edit className="h-3.5 w-3.5" />
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                    onClick={() => router.back()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 본문 내용 */}
            <div className="prose prose-sm max-w-none">
              {mockPost.content.split("\n").map((line, i) => (
                <p key={i} className={cn("text-sm leading-relaxed", line === "" && "h-2")}>{line}</p>
              ))}
            </div>

            {/* 좋아요 버튼 */}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLike}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-all",
                  liked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary hover:bg-primary/5"
                )}
              >
                <ThumbsUp className={cn("h-4 w-4", liked && "fill-primary")} />
                좋아요 {likeCount}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 댓글 섹션 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <h2 className="font-semibold flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" />
              댓글 {comments.length}개
            </h2>
          </CardHeader>
          <CardContent className="pt-4">
            {/* 댓글 목록 */}
            <div className="space-y-4 mb-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {/* 아바타 */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {comment.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">{comment.date}</span>
                      </div>
                      {/* 내 댓글인 경우 삭제 버튼 */}
                      {comment.isMyComment && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed">{comment.content}</p>
                    {/* 댓글 좋아요 */}
                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {comment.likes}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 댓글 작성 */}
            <div className="border-t pt-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  홍
                </div>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="댓글을 작성하세요..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) handleComment()
                    }}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Ctrl+Enter로 빠른 등록</span>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={handleComment}
                      disabled={!newComment.trim()}
                    >
                      <Send className="h-3.5 w-3.5" />
                      댓글 등록
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}