import { ImageResponse } from "next/og";

/* 社交分享卡片（og:image）：构建时生成为静态图片。
   只用英文大字排版，避免 ImageResponse 需要额外 CJK 字体文件 */
export const alt = "Alvin Luo — I build things, including myself.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OgImage() {
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
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              background: "#a3e635",
              color: "#101400",
              fontWeight: 800,
              fontSize: 34,
              padding: "6px 22px",
              borderRadius: 10,
            }}
          >
            alvin.luo
          </div>
          <div style={{ color: "#9aa08d", fontSize: 26, letterSpacing: 4 }}>
            SOFTWARE ENGINEER
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ color: "#f0f0e6", fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>
            I build digital
          </div>
          <div style={{ color: "#f0f0e6", fontSize: 96, fontWeight: 800, letterSpacing: -3, display: "flex" }}>
            experiences.{" "}
            <span style={{ background: "#a3e635", color: "#101400", padding: "0 18px" }}>
              abs.
            </span>
          </div>
        </div>

        <div style={{ color: "#9aa08d", fontSize: 30, display: "flex", gap: 24 }}>
          <span>BUILD FOR THE WEB</span>
          <span>/</span>
          <span>BUILD MYSELF</span>
          <span style={{ color: "#a3e635" }}>alvin-luo.me</span>
        </div>
      </div>
    ),
    size,
  );
}
