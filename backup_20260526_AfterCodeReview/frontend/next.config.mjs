/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️  타입 오류가 있어도 빌드가 통과됩니다.
    // 배포 전에는 반드시 아래 명령으로 타입 검사를 수동 실행하세요:
    //   npx tsc --noEmit
    ignoreBuildErrors: true,
  },
  images: {
    // 외부 이미지 최적화 비활성화 (개발 단계)
    unoptimized: true,
  },
};

export default nextConfig;
