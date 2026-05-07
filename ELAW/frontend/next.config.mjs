/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 개발 단계에서는 타입 에러가 있어도 빌드 허용 (배포 전 해제 권장)
    ignoreBuildErrors: true,
  },
  images: {
    // 외부 이미지 최적화 비활성화 (개발 단계)
    unoptimized: true,
  },
};

export default nextConfig;
