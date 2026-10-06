import { ImageResponse } from "next/og";
import { RESUME } from "@/lib/resume";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Alvin Luo — 简历 CV";
/* 静态导出（output: export）要求 image 路由显式静态化 */
export const dynamic = "force-static";

/* CJK 字体：与博客/房间/年报 OG 同一份构建期缓存 */
let fontCache: Promise<ArrayBuffer | null> | null = null;
function loadCjkFont() {
  fontCache ??= fetch(
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
  )
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  return fontCache;
}

/* /resume 分享卡：一张放在桌面上的简历纸 —— 与站内纸面视觉同体系 */
export default async function OgImage() {
  const fontData = await loadCjkFont();

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
        {/* 顶部：身份行 */}
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
            CV
          </div>
          <div style={{ color: "#9aa08d", fontSize: 26 }}>{`${RESUME.updated} 版`}</div>
        </div>

        {/* 中部：姓名 + 一句话 */}
        <div style={{ display: "flex", flexDirection: "column", color: "#f0f0e6" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.15, display: "flex" }}>
            {RESUME.name}
            <span style={{ fontSize: 40, color: "#9aa08d", marginLeft: 26, alignSelf: "flex-end", paddingBottom: 10, letterSpacing: 8 }}>
              {RESUME.nameEn}
            </span>
          </div>
          <div style={{ fontSize: 34, color: "#c9cfba", marginTop: 18, display: "flex" }}>
            {RESUME.education[0].school} 计算机科学硕士 · AI Agent / 全栈
          </div>
        </div>

        {/* 底部：三个可验证的硬数字 */}
        <div style={{ display: "flex", gap: 22, alignItems: "center", color: "#9aa08d", fontSize: 28 }}>
          <span style={{ color: "#a3e635", fontWeight: 700 }}>QS 85</span>
          <span>/</span>
          <span>GPA 3.9/5.0</span>
          <span>/</span>
          <span>CoreLayer 500+ commits</span>
          <span>/</span>
          <span>雅思 6.5</span>
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
