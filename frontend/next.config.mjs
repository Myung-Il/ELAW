/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️  타입 오류가 있어도 빌드가 통과됩니다.
    // 배포 전에는 반드시 아래 명령으로 타입 검사를 수동 실행하세요:
    //   npx tsc --noEmit
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  skipTrailingSlashRedirect: true,
  experimental: {
    // AI 포트폴리오 생성(/api/jobs/<id>/apply/)은 CPU 추론으로 수 분 걸릴 수 있음.
    // rewrites 프록시 기본 타임아웃(30초)이 백엔드 응답 전에 끊지 않도록 300초로 확대.
    proxyTimeout: 300_000,
  },
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    return [
      { source: "/api/:path*/", destination: `${backend}/api/:path*/` },
      { source: "/api/:path*",  destination: `${backend}/api/:path*/` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
    ]
  },
};

export default nextConfig;
