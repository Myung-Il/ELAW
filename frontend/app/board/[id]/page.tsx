"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import AppHeader from "@/components/layout/app-header"
import {
  ArrowLeft, Eye, Heart, MessageSquare,
  Loader2, Send, Pencil, Trash2, Check, X,
  Paperclip, Download, FileText, ImageIcon, ZoomIn,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { CATEGORY_STYLE, CATEGORY_LABELS } from "@/lib/constants"

// ── 타입 ──────────────────────────────────────────────────────────

interface Attachment {
  id: number
  original_name: string
  file_size: number
  url: string
}

interface Comment {
  id: number
  author_id: number
  author_name: string
  content: string
  created_at: string
  updated_at: string
}

interface Post {
  id: number
  title: string
  content: string
  category: string
  author_id: number
  author_name: string
  view_count: number
  like_count: number
  is_pinned: boolean
  created_at: string
  updated_at: string
  attachments: Attachment[]
  comments: Comment[]
  user_liked: boolean
}

// ── 헬퍼 ──────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function isImage(name: string) {
  return IMAGE_EXTS.has(getExt(name))
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** fetch → Blob → 강제 다운로드 (크로스오리진 download 속성 한계 우회) */
async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objUrl)
  } catch (e) {
    console.error('다운로드 실패:', e)
    alert('파일 다운로드에 실패했습니다.')
  }
}

// ── 컴포넌트 ──────────────────────────────────────────────────────

export default function BoardPostPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [post, setPost]           = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 댓글
  const [newComment, setNewComment]   = useState("")
  const [submitting, setSubmitting]   = useState(false)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")
  const [savingEdit, setSavingEdit]   = useState(false)

  // 좋아요
  const [liking, setLiking] = useState(false)

  // 이미지 모달
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState("")

  // 현재 사용자
  const [myId, setMyId] = useState<number | null>(null)

  // React StrictMode 이중 호출 방지
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    try {
      const token = localStorage.getItem("access_token")
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]))
        setMyId(payload.user_id ?? payload.id ?? null)
      }
    } catch { /* ignore */ }

    api.get<{ data: Post } | Post>(`/api/board/${id}/`)
      .then((res) => {
        const data = "data" in res && !Array.isArray(res)
          ? (res as { data: Post }).data
          : res as Post
        setPost(data)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [id])

  // ── 이미지 모달 ────────────────────────────────────────────────
  const openPreview = (url: string, name: string) => {
    setPreviewUrl(url)
    setPreviewName(name)
  }
  const closePreview = () => setPreviewUrl(null)

  // ── 좋아요 ──────────────────────────────────────────────────────
  const toggleLike = async () => {
    if (!post || liking) return
    setLiking(true)
    try {
      const res = await api.post<{ liked: boolean; like_count: number }>(`/api/board/${id}/like/`, {})
      setPost((p) => p ? { ...p, user_liked: res.liked, like_count: res.like_count } : p)
    } catch { /* ignore */ } finally {
      setLiking(false)
    }
  }

  // ── 댓글 작성 ──────────────────────────────────────────────────
  const submitComment = async () => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await api.post<Comment>(`/api/board/${id}/comments/`, { content: newComment.trim() })
      setPost((p) => p ? { ...p, comments: [...p.comments, res] } : p)
      setNewComment("")
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  // ── 댓글 수정 ──────────────────────────────────────────────────
  const saveEdit = async (commentId: number) => {
    if (!editContent.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const res = await api.patch<Comment>(`/api/board/${id}/comments/${commentId}/`, { content: editContent.trim() })
      setPost((p) => p ? { ...p, comments: p.comments.map((c) => c.id === commentId ? res : c) } : p)
      setEditingId(null)
    } catch { /* ignore */ } finally {
      setSavingEdit(false)
    }
  }

  // ── 댓글 삭제 ──────────────────────────────────────────────────
  const deleteComment = async (commentId: number) => {
    if (!confirm("댓글을 삭제할까요?")) return
    try {
      await api.delete(`/api/board/${id}/comments/${commentId}/`)
      setPost((p) => p ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p)
    } catch { /* ignore */ }
  }

  // ── 로딩 / 없음 ────────────────────────────────────────────────
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

  const style      = CATEGORY_STYLE[post.category] ?? "bg-gray-100 text-gray-700"
  const label      = CATEGORY_LABELS[post.category] ?? post.category
  const isLoggedIn = myId !== null
  const images     = (post.attachments ?? []).filter((a) => isImage(a.original_name))
  const files      = (post.attachments ?? []).filter((a) => !isImage(a.original_name))

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />

      {/* ── 이미지 미리보기 모달 ─────────────────────────────── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closePreview}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={closePreview}
          >
            <X className="h-7 w-7" />
          </button>
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={previewName}
              className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="flex items-center gap-3">
              <p className="text-white/80 text-sm">{previewName}</p>
              <Button
                size="sm"
                variant="secondary"
                className="gap-2"
                onClick={() => downloadFile(previewUrl, previewName)}
              >
                <Download className="h-3.5 w-3.5" />
                다운로드
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 lg:px-8 py-8 max-w-3xl space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          게시판으로 돌아가기
        </button>

        {/* 본문 카드 */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {/* 카테고리 + 제목 */}
            <div className="mb-4">
              <Badge className={`${style} border-0 text-xs mb-3`}>{label}</Badge>
              <h1 className="text-xl font-bold leading-snug">{post.title}</h1>
            </div>

            {/* 메타 */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6 pb-4 border-b">
              <span>{post.author_name}</span>
              <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.view_count.toLocaleString()}</span>
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{post.like_count}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{post.comments.length}</span>
            </div>

            {/* 본문 */}
            <div className="text-sm leading-relaxed whitespace-pre-line mb-6">
              {post.content}
            </div>

            {/* ── 첨부파일 섹션 ──────────────────────────────── */}
            {(images.length > 0 || files.length > 0) && (
              <div className="mb-6 rounded-xl border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="h-4 w-4 text-primary" />
                  첨부파일 {post.attachments.length}개
                </div>

                {/* 이미지 썸네일 그리드 */}
                {images.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">이미지 ({images.length}개) — 클릭하면 크게 볼 수 있어요</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {images.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="relative group rounded-lg overflow-hidden border aspect-square bg-muted focus:outline-none"
                          onClick={() => openPreview(a.url, a.original_name)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.url}
                            alt={a.original_name}
                            className="w-full h-full object-cover group-hover:brightness-75 transition-all"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="h-6 w-6 text-white drop-shadow" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 파일 다운로드 목록 */}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">파일 ({files.length}개)</p>
                    {files.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/50 hover:bg-primary/[0.02] transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.original_name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(a.file_size)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 flex-shrink-0 h-8 text-xs"
                          onClick={() => downloadFile(a.url, a.original_name)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          다운로드
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 좋아요 */}
            <div className="flex justify-center pt-2 border-t gap-3 items-center">
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-2 transition-all", post.user_liked && "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100")}
                onClick={toggleLike}
                disabled={!isLoggedIn || liking}
              >
                <Heart className={cn("h-4 w-4", post.user_liked && "fill-rose-500 text-rose-500")} />
                좋아요 {post.like_count > 0 && post.like_count}
              </Button>
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground">좋아요는 로그인 후 가능합니다</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 댓글 카드 */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              댓글 {post.comments.length}개
            </h2>

            {/* 댓글 목록 */}
            <div className="space-y-4 mb-6">
              {post.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">첫 댓글을 남겨보세요!</p>
              ) : (
                post.comments.map((comment) => {
                  const isMine    = myId !== null && comment.author_id === myId
                  const isEditing = editingId === comment.id
                  return (
                    <div key={comment.id} className="group">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                          {comment.author_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{comment.author_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                            </span>
                            {isMine && !isEditing && (
                              <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button"
                                  onClick={() => { setEditingId(comment.id); setEditContent(comment.content) }}
                                  className="text-muted-foreground hover:text-foreground p-1"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button type="button"
                                  onClick={() => deleteComment(comment.id)}
                                  className="text-muted-foreground hover:text-destructive p-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={2}
                                className="text-sm resize-none"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveEdit(comment.id)} disabled={savingEdit}>
                                  <Check className="h-3 w-3" />저장
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditingId(null)}>
                                  <X className="h-3 w-3" />취소
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground/80 whitespace-pre-line">{comment.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* 댓글 작성 */}
            {isLoggedIn ? (
              <div className="border-t pt-4 space-y-2">
                <Textarea
                  placeholder="댓글을 입력하세요..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitComment() }}
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">Ctrl+Enter로 빠르게 등록</p>
                  <Button size="sm" className="gap-2" onClick={submitComment} disabled={submitting || !newComment.trim()}>
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    댓글 등록
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t pt-4 text-center text-sm text-muted-foreground">
                댓글을 작성하려면 로그인이 필요합니다.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
