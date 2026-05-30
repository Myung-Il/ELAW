const BASE_URL = ""

export async function refreshAccessToken(): Promise<string> {
  const refresh = localStorage.getItem("refresh_token")
  if (!refresh) throw new Error("refresh_token 없음")

  const res = await fetch(`${BASE_URL}/api/accounts/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) throw new Error("토큰 갱신 실패")
  const data = await res.json()
  localStorage.setItem("access_token", data.access)
  return data.access
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && retry) {
    try {
      const newToken = await refreshAccessToken()
      headers["Authorization"] = `Bearer ${newToken}`
      const retryRes = await fetch(`${BASE_URL}${path}`, { ...options, headers })
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({}))
        const fieldError = Object.values(body as Record<string, unknown>)
          .map((v) => (Array.isArray(v) ? String(v[0]) : null))
          .find(Boolean)
        throw new Error(
          (body as Record<string, string>)?.detail ??
            (body as Record<string, string>)?.message ??
            (body as Record<string, string>)?.error ??
            fieldError ??
            `HTTP ${retryRes.status}`,
        )
      }
      const text = await retryRes.text()
      return text ? JSON.parse(text) : ({} as T)
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        document.cookie = "has_token=; path=/; max-age=0"
        window.location.href = "/login"
      }
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.")
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const fieldError = Object.values(body as Record<string, unknown>)
      .map((v) => (Array.isArray(v) ? String(v[0]) : null))
      .find(Boolean)
    throw new Error(
      (body as Record<string, string>)?.detail ??
        (body as Record<string, string>)?.message ??
        (body as Record<string, string>)?.error ??
        fieldError ??
        `HTTP ${res.status}`,
    )
  }

  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),

  /** FormData 파일 업로드 — Content-Type 헤더를 설정하지 않아 브라우저가 multipart boundary를 자동으로 설정 */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,  // Content-Type 없음 → 브라우저가 multipart/form-data; boundary=... 자동 설정
      body: formData,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        (body as Record<string, string>)?.message ??
        (body as Record<string, string>)?.detail ??
        `HTTP ${res.status}`
      )
    }

    const text = await res.text()
    return text ? JSON.parse(text) : ({} as T)
  },
}
