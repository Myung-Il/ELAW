/**
 * [페이지] 게시글 상세 페이지 (/board/[id])
 *
 * 접근 권한:
 *   - 비로그인 사용자: 이 페이지 접근 시 로그인 안내 후 /login으로 이동
 *   - 로그인 사용자: 게시글 상세 + 댓글 열람, 댓글 작성/삭제, 좋아요 기능 사용 가능
 *
 * CRUD 기능:
 *   - 게시글 수정 (본인 글만): Edit 버튼 → 수정 모드
 *   - 게시글 삭제 (본인 글만): Delete 버튼 → 확인 후 삭제 → 게시판으로 이동
 *   - 댓글 작성: Ctrl+Enter 또는 [댓글 등록] 버튼
 *   - 댓글 삭제 (본인 댓글만): [삭제] 버튼
 *   - 좋아요 토글: 좋아요 버튼 클릭
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   - mockPost, mockComments를 GET /api/v1/board/{id} 로 교체하세요.
 *   - 댓글 작성은 POST /api/v1/board/{id}/comments
 *   - 댓글 삭제는 DELETE /api/v1/board/comments/{comment_id}
 *   - 좋아요는 POST /api/v1/board/{id}/like (토글 방식)
 *
 * [BE 매뉴얼]
 *   - GET /api/v1/board/{id}
 *       Response: { post: { id, title, content, category, author, created_at, views, likes },
 *                   comments: [{ id, author, content, likes, created_at, isMyComment }],
 *                   isMyPost: boolean }
 *   - POST /api/v1/board/{id}/comments
 *       Request: { content }
 *       Response: { comment: { id, author, content, created_at } }
 *   - DELETE /api/v1/board/comments/{comment_id}
 *       - 본인 댓글만 삭제 가능 (403 Forbidden otherwise)
 *   - POST /api/v1/board/{id}/like (토글)
 *       Response: { liked: boolean, likeCount: number }
 *
 * [DB 매뉴얼]
 *   BoardPosts: id, title, content, category, author_id, views, likes, created_at
 *   BoardComments: id, post_id(FK), author_id(FK), content, likes, created_at
 *   - 조회 시 views 컬럼 +1 UPDATE 처리 필요
 *   - 좋아요: BoardLikes 테이블 (user_id, post_id, UNIQUE KEY) 로 중복 방지
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import AppHeader from "@/components/layout/app-header"
import { ArrowLeft, ThumbsUp, Eye, MessageCircle, Edit, Trash2, Send, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

// ─────────────────────────────────────────────────────────────────────────────
// 더미 데이터 (추후 API 연동 필요)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 게시글 더미 데이터
 * [FE 수정 매뉴얼] GET /api/v1/board/{id} 로 교체
 * [DB 매뉴얼] BoardPosts WHERE id = ? + views +1 UPDATE
 */
const mockPost = {
  id: 3,
  category: "QnA",
  title: "삼성 SW 역량테스트 준비 어떻게 하셨나요?",
  author: "kim**",
  date: "2025.04.24",
  views: 342,
  likes: 28,
  isMyPost: false, // [FE 수정 매뉴얼] 실제로는 현재 사용자 ID === 작성자 ID 비교
  content: `안녕하세요. 이번 5월에 삼성 SW 역량테스트를 보게 되었는데요, 어떻게 준비하면 좋을지 여쭤보고 싶습니다.

현재 알고리즘 중급 수준이고 백준 기준 실버 상위 정도 됩니다. 역테 B형 목표인데 어떤 문제 위주로 풀면 좋을까요?

구체적으로 궁금한 점:
1. 어떤 유형의 문제들이 자주 나오나요?
2. 몇 개월 준비하면 B형 합격 가능할까요?
3. 추천 문제집이나 강의 있으면 알려주세요!`,
}

/**
 * 댓글 더미 데이터
 * [FE 수정 매뉴얼] GET /api/v1/board/{id} 응답의 comments 배열로 교체
 * [DB 매뉴얼] BoardComments WHERE post_id = ? ORDER BY created_at ASC
 */
const mockComments = [
  {
    id: 1,
    author: "lee**",
    date: "2025.04.24 14:23",
    content: "저도 작년에 준비했는데요, DP랑 그래프 탐색 위주로 많이 나왔어요. 백준 삼성 기출 문제 세트 꼭 풀어보세요!",
    likes: 12,
    isMyComment: false, // [FE 수정 매뉴얼] 현재 사용자 ID === 댓글 작성자 ID 비교로 교체
  },
  {
    id: 2,
    author: "choi**",
    date: "2025.04.24 15:45",
    content: "B형 기준으로 보통 3~4개월 정도 준비하면 합격할 수 있어요. 코드트리나 인프런의 삼성 역테 강의 추천드립니다.",
    likes: 8,
    isMyComment: false,
  },
  {
    id: 3,
    author: "나(홍길동)",
    date: "2025.04.25 10:12",
    content: "감사합니다! 추천해주신 문제들 풀어볼게요.",
    likes: 2,
    isMyComment: true,
  },
]

/** 카테고리 배지 색상 */
const categoryStyle: Record<string, string> = {
  공지: "bg-blue-100 text-blue-700",
  행사: "bg-orange-100 text-orange-700",
  QnA: "bg-green-100 text-green-700",
}

export default function BoardPostPage() {
  const params = useParams()
  const router = useRouter()

  /** 인증 상태 확인 */
  const { isLoggedIn, isLoading } = useAuth()

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(mockPost.likes)
  const [comments, setComments] = useState(mockComments)
  const [newComment, setNewComment] = useState("")

  /**
   * 비로그인 상태에서 이 페이지에 접근한 경우
   * 로딩 완료 후 로그인 안내를 표시합니다.
   * (리다이렉트 대신 인라인 안내 UI 제공)
   */

  // ─── 댓글 작성 핸들러 (Create) ───────────────────────────────────────────────
  /**
   * [FE 수정 매뉴얼] 실제 API 호출로 교체:
   *   const res = await fetch(`/api/v1/board/${params.id}/comments`, {
   *     method: "POST",
   *     headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
   *     body: JSON.stringify({ content: newComment })
   *   })
   *   const data = await res.json()
   *   setComments([...comments, data.comment])
   *
   * [BE 매뉴얼] POST /api/v1/board/{id}/comments
   * [DB 매뉴얼] BoardComments INSERT + BoardPosts.comments_count +1
   */
  const handleComment = () => {
    if (!newComment.trim()) return
    setComments([
      ...comments,
      {
        id: comments.length + 1,
        author: "나(홍길동)",
        date: "방금 전",
        content: newComment,
        likes: 0,
        isMyComment: true,
      },
    ])
    setNewComment("")
  }

  // ─── 댓글 삭제 핸들러 ─────────────────────────────────────────────────────────
  /**
   * [BE 매뉴얼] DELETE /api/v1/board/comments/{comment_id}
   * [DB 매뉴얼] BoardComments soft delete (deleted_at 처리 권장)
   */
  const handleDeleteComment = (id: number) => {
    setComments(comments.filter((c) => c.id !== id))
  }

  // ─── 좋아요 토글 핸들러 ───────────────────────────────────────────────────────
  /**
   * [FE 수정 매뉴얼] 실제 API 호출로 교체:
   *   const res = await fetch(`/api/v1/board/${params.id}/like`, { method: "POST", ... })
   *   const data = await res.json()
   *   setLiked(data.liked); setLikeCount(data.likeCount)
   *
   * [BE 매뉴얼] POST /api/v1/board/{id}/like
   *   - 이미 좋아요면 취소, 아니면 추가 (토글 방식)
   * [DB 매뉴얼] BoardLikes (user_id, post_id) UNIQUE KEY로 중복 방지
   */
  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
  }

  // 로딩 중 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        로딩 중...
      </div>
    )
  }

  // 비로그인 상태에서 이 페이지 접근 시 로그인 안내 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="text-center max-w-sm">
            {/* 자물쇠 아이콘 */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <LogIn className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">로그인이 필요합니다</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              게시글 상세 내용은 로그인 후 확인할 수 있습니다.
              <br />
              ELAW 회원이라면 지금 바로 로그인하세요.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/login">
                <Button size="lg" className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  로그인하기
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg" className="w-full">
                  회원가입
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                게시판으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── 로그인 상태: 게시글 상세 화면 ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-3xl">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          게시판으로
        </button>

        {/* ── 게시글 본문 카드 ────────────────────────────────────── */}
        <Card className="shadow-sm mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* 카테고리 배지 */}
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

              {/* 본인 게시글인 경우 수정/삭제 버튼 */}
              {/* [FE 수정 매뉴얼] mockPost.isMyPost를 실제 user.id === post.author_id로 교체 */}
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
            {/* 게시글 본문 - 줄바꿈 처리 */}
            <div className="prose prose-sm max-w-none">
              {mockPost.content.split("\n").map((line, i) => (
                <p key={i} className={cn("text-sm leading-relaxed", line === "" && "h-2")}>
                  {line}
                </p>
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

        {/* ── 댓글 섹션 ──────────────────────────────────────────── */}
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
                  {/* 작성자 아바타 */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {comment.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">{comment.date}</span>
                      </div>
                      {/* 본인 댓글에만 삭제 버튼 표시 */}
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

            {/* 댓글 작성 영역 */}
            <div className="border-t pt-4">
              <div className="flex gap-3">
                {/* 현재 사용자 아바타 */}
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
                      // Ctrl+Enter로 빠른 댓글 등록
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
