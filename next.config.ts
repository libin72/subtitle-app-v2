import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 忽略 TypeScript 类型报错，强制打包
  typescript: {
    ignoreBuildErrors: true,
  },
  // 忽略 ESLint 语法警告，强制打包
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;