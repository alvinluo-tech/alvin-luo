import { ImageResponse } from "next/og";
import { getAllPosts } from "@/lib/blog";
import { TRIPS } from "@/data/trips";
import { GITHUB_USER } from "@/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Alvin Luo — 2026 年度报告";
/* 静态导出（output: export）要求 image 路由显式静态化 */
export const dynamic = "force-static";

/* CJK 字体：与博客 OG 卡同一份构建期缓存 */
let fontCache: Promise<ArrayBuffer | null> | null = null;
function loadCjkFont() {
  fontCache ??= fetch(
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
  )
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  return fontCache;
}

/* 年度海报：深色底 + 荧光绿数据拼贴，与博客 OG 卡同一视觉体系 */
export default async function OgImage() {
  const posts = getAllPosts().filter((p) => p.date.startsWith("2026"));
  const minutes = posts.reduce((s, p) => s + p.readingMinutes, 0);
  const countries = new Set(TRIPS.map((t) => t.country)).size;
  const fontData = await loadCjkFont();

  const cells: { big: string; small: string }[] = [
    { big: `${posts.length}`, small: "POSTS · 篇文章" },
    { big: `${minutes}`, small: "MIN READ · 分钟" },
    { big: `${countries}`, small: "COUNTRIES · 国家" },
    { big: `${TRIPS.length}`, small: "STOPS · 站" },
  ];

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
          position: "relative",
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
            ANNUAL REPORT · VOL.1
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
          <span style={{ color: "#f0f0e6", fontSize: 150, fontWeight: 800, lineHeight: 1 }}>
            20
          </span>
          <span
            style={{
              color: "#12140e",
              fontSize: 150,
              fontWeight: 800,
              lineHeight: 1,
              background: "#a3e635",
              padding: "0 18px",
              borderRadius: 18,
            }}
          >
            26
          </span>
          <span style={{ color: "#9aa08d", fontSize: 40, fontWeight: 700 }}>
            年度报告 · SO FAR
          </span>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {cells.map((c) => (
            <div
              key={c.small}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                border: "2px solid #3a3f30",
                borderRadius: 14,
                padding: "18px 26px",
              }}
            >
              <span style={{ color: "#a3e635", fontSize: 56, fontWeight: 800, lineHeight: 1 }}>
                {c.big}
              </span>
              <span style={{ color: "#9aa08d", fontSize: 20 }}>{c.small}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            color: "#9aa08d",
            fontSize: 22,
            gap: 16,
            alignItems: "center",
            flexWrap: "nowrap",
          }}
        >
          <span style={{ color: "#a3e635", fontWeight: 700, whiteSpace: "nowrap" }}>
            alvin-luo.me/year
          </span>
          <span>·</span>
          <span style={{ whiteSpace: "nowrap" }}>writing × code × music × world × books</span>
          <span>·</span>
          <span style={{ whiteSpace: "nowrap" }}>GitHub @{GITHUB_USER}</span>
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
