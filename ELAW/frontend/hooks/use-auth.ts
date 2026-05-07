/**
 * [훅] useAuth - 인증 상태 관리 훅
 *
 * 역할: 현재 사용자의 로그인/비로그인 상태를 판별합니다.
 *       로그인 상태에 따라 UI를 분기 처리하는 모든 페이지에서 사용합니다.
 *
 * 사용 예시:
 *   const { isLoggedIn, isLoading, userName, userDept } = useAuth()
 *   if (isLoggedIn) { ... }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [FE 수정 매뉴얼]
 *   현재는 로컬스토리지(localStorage)의 'isLoggedIn' 플래그로 상태를 임시 관리합니다.
 *   실제 운영 시에는 아래 방식 중 하나로 교체해야 합니다:
 *     1. JWT 기반: localStorage의 access_token 존재 여부 + 만료 시간 검증
 *     2. 서버 세션: Next.js 미들웨어에서 쿠키(HttpOnly) 검사
 *     3. React Context: 전역 AuthProvider + AuthContext 패턴
 *
 * [BE 매뉴얼]
 *   로그인 상태 확인 API: GET /api/v1/auth/me
 *     - 헤더: Authorization: Bearer {access_token}
 *     - 성공 응답 (200): { id, name, dept, is_first_login }
 *     - 실패 응답 (401): 토큰 없음 또는 만료
 *
 * [DB 매뉴얼]
 *   Users 테이블 컬럼: id, user_id, name, dept, password_hash, created_at
 *   Sessions 테이블 (옵션): id, user_id, token_hash, expires_at
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import { useState, useEffect } from "react"

/** 인증 상태 타입 정의 */
interface AuthState {
  /** 로그인 여부 */
  isLoggedIn: boolean
  /** 로딩 중 여부 (클라이언트 하이드레이션 대기 중) */
  isLoading: boolean
  /** 로그인된 사용자 이름 (비로그인 시 빈 문자열) */
  userName: string
  /** 로그인된 사용자 학과 (비로그인 시 빈 문자열) */
  userDept: string
}

/**
 * 현재 로그인 상태를 반환하는 훅
 *
 * SSR/CSR 환경 모두에서 안전하게 동작합니다.
 * isLoading이 true인 동안은 상태가 확정되지 않았으므로, UI에서 스켈레톤 등을 보여주세요.
 */
export function useAuth(): AuthState {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [userDept, setUserDept] = useState("")

  useEffect(() => {
    // localStorage는 브라우저(클라이언트)에서만 접근 가능합니다.
    // Next.js SSR 환경에서는 useEffect 안에서만 접근해야 합니다.

    // [FE 수정 매뉴얼] 실제 운영 시 아래 localStorage 코드를 API 호출로 교체하세요.
    // 예시:
    //   const res = await fetch("/api/v1/auth/me", {
    //     headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
    //   })
    //   if (res.ok) { const user = await res.json(); setIsLoggedIn(true); setUserName(user.name) }
    //   else { setIsLoggedIn(false) }

    const loggedIn = localStorage.getItem("isLoggedIn") === "true"
    const storedName = localStorage.getItem("userName") || "홍길동"
    const storedDept = localStorage.getItem("userDept") || "컴퓨터공학과"

    setIsLoggedIn(loggedIn)
    setUserName(loggedIn ? storedName : "")
    setUserDept(loggedIn ? storedDept : "")
    setIsLoading(false)
  }, [])

  return { isLoggedIn, isLoading, userName, userDept }
}

/**
 * 로그인 성공 시 인증 정보를 로컬스토리지에 저장하는 함수
 *
 * [FE 수정 매뉴얼] 실제 운영 시 access_token을 저장하는 방식으로 교체하세요.
 *   - access_token은 메모리 또는 sessionStorage (보안 강화)
 *   - refresh_token은 HttpOnly 쿠키 (XSS 방어)
 *
 * @param name - 사용자 이름
 * @param dept - 사용자 학과
 * @param accessToken - JWT 액세스 토큰 (추후 사용)
 */
export function saveAuthState(name: string, dept: string, accessToken?: string): void {
  localStorage.setItem("isLoggedIn", "true")
  localStorage.setItem("userName", name)
  localStorage.setItem("userDept", dept)
  if (accessToken) {
    localStorage.setItem("access_token", accessToken)
  }
}

/**
 * 로그아웃 시 인증 정보를 모두 제거하는 함수
 *
 * [BE 매뉴얼] 로그아웃 API: POST /api/v1/auth/logout
 *   - 서버 세션 무효화 또는 리프레시 토큰 블랙리스트 처리
 */
export function clearAuthState(): void {
  localStorage.removeItem("isLoggedIn")
  localStorage.removeItem("userName")
  localStorage.removeItem("userDept")
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
}
