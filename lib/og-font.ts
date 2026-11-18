/* ============================================================
 * OG 卡片字体加载（构建期）
 *
 * satori 渲染中文必须有 CJK 字形。完整 Noto Sans CJK 有 16MB，
 * 从 CDN 拉取在慢网下会超过 Next 单路由 60s 的构建上限。
 * 因此仓库内自带一份「按 OG 用字裁剪」的子集字体（~400KB）：
 *   assets/fonts/NotoSansSC-OG-Bold.otf
 * 由 _analysis 里的 pyftsubset 流程生成，包含站点所有中文字面量。
 *
 * 本地缺失时才回退到远程镜像（保持极端情况的可用性）。
 * ============================================================ */

import fs from "fs/promises";
import path from "path";

const LOCAL_FONT = path.join(process.cwd(), "assets", "fonts", "NotoSansSC-OG-Bold.otf");

const REMOTE_FALLBACKS = [
  "https://fastly.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
  "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
];

let cache: Promise<ArrayBuffer | null> | null = null;

async function readLocal(): Promise<ArrayBuffer | null> {
  try {
    const buf = await fs.readFile(LOCAL_FONT);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return ab.byteLength > 20_000 ? (ab as ArrayBuffer) : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 30_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength > 50_000 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function loadCjkFont(): Promise<ArrayBuffer | null> {
  cache ??= (async () => {
    const local = await readLocal();
    if (local) return local;
    for (const url of REMOTE_FALLBACKS) {
      const data = await fetchWithTimeout(url);
      if (data) return data;
    }
    return null;
  })();
  return cache;
}
