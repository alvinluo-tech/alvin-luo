import { ImageResponse } from "next/og";
import { GITHUB_USER } from "@/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Alvin Luo — The Room";
/* 静态导出（output: export）要求 image 路由显式静态化 */
export const dynamic = "force-static";

/* CJK 字体：与博客/年度报告 OG 同一份构建期缓存 */
let fontCache: Promise<ArrayBuffer | null> | null = null;
function loadCjkFont() {
  fontCache ??= fetch(
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
  )
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  return fontCache;
}

/* /room 分享卡：纸面底 + 等距立方体意象 + 房间文案，与站内视觉同体系 */
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
          background: "#f8f8f3",
          padding: "64px 72px",
          fontFamily: '"noto", sans-serif',
          position: "relative",
        }}
      >
        {/* 等距立方体群：房间家具的抽象意象（手绘 SVG 风格的色块） */}
        <div
          style={{
            position: "absolute",
            right: 40,
            bottom: 90,
            width: 420,
            height: 360,
            display: "flex",
          }}
        >
          {/* 立方体 A（书桌） */}
          <div style={{ position: "absolute", left: 130, top: 130, width: 200, height: 120, display: "flex" }}>
            <div style={{ position: "absolute", left: 50, top: 0, width: 100, height: 58, background: "#f3ecd8", border: "3px solid #101400", transform: "rotate(-30deg) skewX(30deg)" }} />
            <div style={{ position: "absolute", left: 0, top: 29, width: 100, height: 58, background: "#dcd2b8", border: "3px solid #101400", transform: "skewY(-30deg)" }} />
            <div style={{ position: "absolute", left: 100, top: 58, width: 100, height: 58, background: "#c4b89a", border: "3px solid #101400", transform: "skewY(30deg)" }} />
          </div>
          {/* 立方体 B（唱片机矮柜，小一号错位摆） */}
          <div style={{ position: "absolute", left: 0, top: 200, width: 130, height: 80, display: "flex" }}>
            <div style={{ position: "absolute", left: 33, top: 0, width: 64, height: 37, background: "#f3ecd8", border: "3px solid #101400", transform: "rotate(-30deg) skewX(30deg)" }} />
            <div style={{ position: "absolute", left: 0, top: 19, width: 64, height: 37, background: "#dcd2b8", border: "3px solid #101400", transform: "skewY(-30deg)" }} />
            <div style={{ position: "absolute", left: 64, top: 37, width: 64, height: 37, background: "#c4b89a", border: "3px solid #101400", transform: "skewY(30deg)" }} />
          </div>
          {/* 黑胶唱片 */}
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 186,
              width: 74,
              height: 74,
              borderRadius: 999,
              background: "#23261c",
              border: "3px solid #101400",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "#d2ff00", border: "3px solid #101400" }} />
          </div>
        </div>

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
              color: "#5b6052",
              border: "2px solid #101400",
              fontWeight: 700,
              fontSize: 26,
              padding: "3px 16px",
              borderRadius: 999,
            }}
          >
            THE ROOM
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
          <div style={{ color: "#101400", fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>
            一个房间，
          </div>
          <div
            style={{
              color: "#101400",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.1,
              display: "flex",
              alignItems: "baseline",
            }}
          >
            <span>不只是</span>
            <span style={{ background: "#d2ff00", padding: "0 14px" }}>一个页面</span>
            <span>。</span>
          </div>
        </div>

        <div style={{ display: "flex", color: "#5b6052", fontSize: 26, gap: 20, alignItems: "center" }}>
          <span style={{ color: "#5b6052", fontWeight: 700 }}>alvin-luo.me/room</span>
          <span>·</span>
          <span>desk · shelf · bed · vinyl · cat</span>
          <span>·</span>
          <span>@{GITHUB_USER}</span>
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
