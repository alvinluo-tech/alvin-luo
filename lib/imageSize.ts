/* ============================================================
 * 图片固有尺寸读取（构建期 / 服务端专用）
 *
 * 为什么需要：正文 <img> 若不带 width/height，浏览器在图片下载完成前
 * 无法预留高度 —— 长文每张图都会造成一次布局位移（CLS）。
 * 这里在构建期解析文件头拿到真实尺寸，注入到 <img> 上，
 * 浏览器即可据 aspect-ratio 提前占位。
 *
 * 只解析文件头（WebP / PNG / JPEG），不引入任何依赖。
 * 读取失败返回 null，调用方退化为不注入 —— 不影响渲染。
 * ============================================================ */

import fs from "fs";

export type ImageSize = { width: number; height: number };

/* 同一构建内同一张图会被多次查询（文章页 + RSS + sitemap），做一层记忆化 */
const cache = new Map<string, ImageSize | null>();

/* ---- WebP：RIFF 容器，三种 chunk 布局不同 ---- */
function webpSize(head: Buffer): ImageSize | null {
  const fourcc = head.toString("ascii", 12, 16);

  /* VP8X（扩展格式，带 alpha / 动画）：canvas 宽高各 24-bit LE，存的是 值-1 */
  if (fourcc === "VP8X") {
    return {
      width: head.readUIntLE(24, 3) + 1,
      height: head.readUIntLE(27, 3) + 1,
    };
  }

  /* VP8L（无损）：4 字节内打包 14-bit 宽-1 与 14-bit 高-1 */
  if (fourcc === "VP8L") {
    const b = head.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }

  /* VP8 （有损）：14-bit 宽 / 高，低 2 位是缩放系数 */
  if (fourcc === "VP8 ") {
    return {
      width: head.readUInt16LE(26) & 0x3fff,
      height: head.readUInt16LE(28) & 0x3fff,
    };
  }

  return null;
}

/* ---- JPEG：逐段扫描，命中 SOFn 段即可取到尺寸 ---- */
function jpegSize(file: string): ImageSize | null {
  const fd = fs.openSync(file, "r");
  try {
    /* SOF 段通常在文件前部；64KB 足够覆盖（含渐进式 JPEG） */
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    let i = 2; // 跳过 SOI
    while (i + 9 < n) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      /* SOF0-SOF15，排除 DHT(C4) / JPG(C8) / DAC(CC) */
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      /* 其余段：跳过（段长含自身 2 字节） */
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

export function imageSize(file: string): ImageSize | null {
  const hit = cache.get(file);
  if (hit !== undefined) return hit;
  const result = readSize(file);
  cache.set(file, result);
  return result;
}

function readSize(file: string): ImageSize | null {
  try {
    const fd = fs.openSync(file, "r");
    const head = Buffer.alloc(32);
    const n = fs.readSync(fd, head, 0, 32, 0);
    fs.closeSync(fd);
    if (n < 12) return null;

    /* PNG：IHDR 紧随 8 字节签名 + 4 字节长度 + 4 字节类型 */
    if (head.readUInt32BE(0) === 0x89504e47) {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }

    /* WebP */
    if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") {
      return webpSize(head);
    }

    /* JPEG */
    if (head[0] === 0xff && head[1] === 0xd8) {
      return jpegSize(file);
    }

    return null;
  } catch {
    return null;
  }
}
