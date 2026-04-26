// 루트 레이아웃 - 모든 페이지에 공통 적용되는 최상위 레이아웃
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// 페이지 메타데이터 - SEO에 활용
export const metadata: Metadata = {
  title: 'ELAW - 학습지원 / 취업연계 플랫폼',
  description: '공과대학 전공 학습 및 취업 연계 플랫폼. AI 커리큘럼, 기업 매칭, 대회 정보 제공',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {children}
        {/* Vercel 웹 분석 - 배포 환경에서 페이지뷰 추적 */}
        <Analytics />
      </body>
    </html>
  )
}