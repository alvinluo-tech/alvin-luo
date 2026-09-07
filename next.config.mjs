/** @type {import('next').NextConfig} */
const nextConfig = {
  // 默认构建：标准服务端构建，部署到 Vercel（支持 /api 代理路由）
  // 设置 BUILD_STATIC=1 时：纯静态导出到 out/，用于 GitHub Pages
  //   （静态模式下没有 /api 代理，NOW PLAYING 瓷砖会走优雅降级）
  output: process.env.BUILD_STATIC === "1" ? "export" : undefined,

  // GitHub Pages 项目页部署在 /<仓库名>/ 子路径下，构建时通过环境变量注入：
  //   NEXT_PUBLIC_BASE_PATH=/<仓库名> npm run build
  // 部署到 Vercel 或自定义域名（用户名.github.io 根站点）时无需设置
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",

  // 纯静态导出不支持图片优化服务，我们也不用 next/image
  images: { unoptimized: true },
};

export default nextConfig;
