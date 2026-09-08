import { ImageResponse } from "next/og";
import { CATEGORY_LABELS, getAllPosts } from "@/lib/blog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Alvin Luo — 博客文章";
/* 静态导出（output: export）要求 image 路由显式静态化 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

/* 文章标题多为中文，satori 默认字体没有 CJK 字形。
   构建时拉取 Noto Sans SC Bold（约 16MB，仅构建期），模块级 Promise 缓存：
   12 篇文章 × 每篇一张图只抓一次。失败时降级为默认字体（中文会变方块，但不阻塞构建） */
let fontCache: Promise<ArrayBuffer | null> | null = null;
function loadCjkFont() {
  fontCache ??= fetch(
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
  )
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  return fontCache;
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getAllPosts().find((p) => p.slug === slug);
  const title = (post?.title ?? slug)
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const category = post ? CATEGORY_LABELS[post.category] ?? post.category : "";
  const fontData = await loadCjkFont();

  /* 标题长度决定字号，避免超长标题溢出卡片 */
  const titleSize = title.length > 24 ? 52 : title.length > 14 ? 66 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#12140e",
          padding: "64px 72px",
          fontFamily: '"noto", sans-serif',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              background: "#a3e635",
              color: "#101400",
              fontWeight: 800,
              fontSize: 32,
              padding: "5px 20px",
              borderRadius: 10,
            }}
          >
            alvin.luo
          </div>
          {category && (
            <div
              style={{
                color: "#a3e635",
                border: "2px solid #a3e635",
                fontWeight: 700,
                fontSize: 26,
                padding: "3px 16px",
                borderRadius: 999,
              }}
            >
              {category}
            </div>
          )}
          {post?.date && (
            <div style={{ color: "#9aa08d", fontSize: 26 }}>{post.date}</div>
          )}
        </div>

        <div
          style={{
            color: "#f0f0e6",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.25,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", color: "#9aa08d", fontSize: 28, gap: 22, alignItems: "center" }}>
          <span style={{ color: "#a3e635", fontWeight: 700 }}>alvin-luo.me</span>
          <span>/</span>
          <span>blog</span>
          {post?.readingMinutes != null && (
            <>
              <span>/</span>
              <span>{post.readingMinutes} min read</span>
            </>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "noto", data: fontData, weight: 700, style: "normal" }]
        : [],
    },
  );
}
