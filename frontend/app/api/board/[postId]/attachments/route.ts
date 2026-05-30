import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params
  const authHeader = request.headers.get("authorization") ?? ""

  // Next.js App Router가 multipart/form-data를 올바르게 파싱
  const formData = await request.formData()

  const backendRes = await fetch(
    `${BACKEND}/api/board/${postId}/attachments/`,
    {
      method: "POST",
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        // Content-Type은 설정하지 않음 — fetch가 FormData에 맞춰 자동 설정
      },
      body: formData,
    }
  )

  const data = await backendRes.json().catch(() => ({}))
  return NextResponse.json(data, { status: backendRes.status })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params
  const authHeader = request.headers.get("authorization") ?? ""
  const url = new URL(request.url)

  const backendRes = await fetch(
    `${BACKEND}/api/board/${postId}/attachments${url.pathname.split("/attachments")[1]}`,
    {
      method: "DELETE",
      headers: authHeader ? { Authorization: authHeader } : {},
    }
  )

  return new NextResponse(null, { status: backendRes.status })
}
