import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/config/site";

/* 构建时生成 sitemap.xml（静态导出支持） */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/$/, "");
  /* 静态页不写 lastModified：每次构建都填 new Date() 会让全部 URL
     永远"刚更新"，搜索引擎的时间信号失真 */
  const staticPages = ["", "/blog", "/travel", "/now", "/year", "/room"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : p === "/year" || p === "/room" ? 0.6 : 0.7,
  }));
  const posts = getAllPosts().map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(p.updated),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...staticPages, ...posts];
}
