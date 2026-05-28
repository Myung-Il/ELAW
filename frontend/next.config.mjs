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
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
