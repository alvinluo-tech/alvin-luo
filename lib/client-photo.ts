/**
 * 手机端照片处理：EXIF 读取 → 元数据剥离 / 转码 → 缩略图。
 *
 * 顺序不能反：canvas 转码会抹掉 EXIF，所以必须先读元数据。
 * 隐私：直传的小图会先剥离 APP1/EXIF 与 IPTC，GPS 绝不进公开桶。
 */

import { TRIPS } from "@/data/trips";

export type PhotoMeta = {
  takenAt: string;
  /** [lng, lat]，仅用于归站，不上传 */
  gps?: [number, number];
  /** EXIF Orientation（1 = 正常） */
  orientation?: number;
};

export type ConvertedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  thumb: Blob;
  thumbWidth: number;
  thumbHeight: number;
};

export type TripSuggestion = {
  /** 50km 内，直接归入 */
  trip?: string;
  /** 50–200km，只是候选，需要用户确认 */
  candidate?: string;
  /** 最近的站点（无论多远），用于提示 */
  nearest?: string;
  distanceKm?: number;
};

export const MAX_EDGE = 2000;
/** 卡片主图在 2–3x 手机上约需 600px 宽；640 比 480 明显更锐，单张只多 ~8KB */
export const THUMB_EDGE = 640;
/** 实测（4000×3000→2000px，canvas 编码）：q82 33.9dB / q85 37.2dB / q90 38.3dB；
 *  q85 只比 q82 大 ~30%，颗粒与细纹理保留明显更好 */
export const WEBP_QUALITY = 0.85;
export const THUMB_QUALITY = 0.8;
/** 超过这个体积就改 JPEG：Safari 的 WebP 编码器可能忽略质量参数，输出接近无损 */
export const MAX_UPLOAD_BYTES = 1_300_000;
/** 缩略图超过这个体积也改 JPEG */
export const MAX_THUMB_BYTES = 280_000;
/** 已经足够小的 JPEG/WebP 直接原样上传（会先剥元数据），避免二次压缩反而变大 */
export const PASSTHROUGH_MAX = 1_000_000;

const EXIF_PICK = [
  "DateTimeOriginal",
  "CreateDate",
  "DateTime",
  "OffsetTimeOriginal",
  "Orientation",
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentOffset(): string {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

function normalizeOffset(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(raw.trim());
  return m ? `${m[1]}${m[2]}:${m[3]}` : null;
}

/** 设备本地时间 → 带偏移的 ISO（兜底用） */
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}${currentOffset()}`;
}

function dms(value: unknown, ref: unknown): number | undefined {
  let deg: number | undefined;
  if (typeof value === "number") deg = value;
  else if (Array.isArray(value) && value.length === 3) {
    const [d, m, s] = value.map(Number);
    if ([d, m, s].every(Number.isFinite)) deg = d + m / 60 + s / 3600;
  }
  if (deg === undefined) return undefined;
  return ref === "S" || ref === "W" ? -deg : deg;
}

/** 读拍摄时间（保留拍摄地时区）与 GPS。失败退化为文件修改时间。 */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  const fallback = localIso(new Date(file.lastModified || Date.now()));
  try {
    const exifr = (await import("exifr")).default;
    const data = (await exifr.parse(file, {
      pick: [...EXIF_PICK],
      translateValues: false,
      reviveValues: false,
      gps: true,
    })) as Record<string, unknown> | undefined;
    if (!data) return { takenAt: fallback };

    // 原始字符串 "2026:11:18 10:30:00"；没有时区就沿用设备时区，但保留墙上时间
    const raw = data.DateTimeOriginal ?? data.CreateDate ?? data.DateTime;
    let takenAt = fallback;
    if (typeof raw === "string") {
      const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
      if (m) {
        const offset = normalizeOffset(data.OffsetTimeOriginal) ?? currentOffset();
        takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`;
      }
    } else if (raw instanceof Date && Number.isFinite(raw.getTime())) {
      takenAt = localIso(raw);
    }

    const lat =
      typeof data.latitude === "number"
        ? data.latitude
        : dms(data.GPSLatitude, data.GPSLatitudeRef);
    const lng =
      typeof data.longitude === "number"
        ? data.longitude
        : dms(data.GPSLongitude, data.GPSLongitudeRef);

    const orientation = Number(data.Orientation);
    return {
      takenAt,
      ...(lng !== undefined && lat !== undefined ? { gps: [lng, lat] as [number, number] } : {}),
      ...(Number.isFinite(orientation) && orientation >= 1 && orientation <= 8 ? { orientation } : {}),
    };
  } catch {
    return { takenAt: fallback };
  }
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * 用照片 GPS 找站点。只有 50km 内才自动归入；50–200km 只给候选；
 * 更远（比如米兰不在清单里）不猜，交给用户选或新建行程。
 */
export function suggestTrip(gps?: [number, number]): TripSuggestion {
  if (!gps) return {};
  const ranked = TRIPS.map((t) => ({ id: t.img, d: distanceKm(gps, t.coord) })).sort((a, b) => a.d - b.d);
  const best = ranked[0];
  if (!best) return {};

  const distanceKmRounded = Math.round(best.d);
  if (best.d <= 50) return { trip: best.id, nearest: best.id, distanceKm: distanceKmRounded };
  if (best.d <= 200) return { candidate: best.id, nearest: best.id, distanceKm: distanceKmRounded };
  return { nearest: best.id, distanceKm: distanceKmRounded };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    /* Safari 旧版本 / HEIC 走下面的兜底 */
  }

  try {
    return await loadImage(file);
  } catch {
    /* 继续 */
  }

  if (isHeic(file)) {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(out) ? out[0] : out;
    return await loadImage(blob);
  }

  throw new Error("这个格式浏览器解不了，请换一张或把 iPhone 相机格式设为「兼容性最佳」");
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function draw(canvas: HTMLCanvasElement, source: CanvasImageSource): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 不可用");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
}

function hasAlpha(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  } catch {
    return false;
  }
  return false;
}

/** JPEG：去掉 APP1（EXIF/XMP）、APP13（IPTC）、COM，其余原样；找不到 SOS 就返回原图 */
function stripJpeg(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 3 < input.length) {
    if (input[i] !== 0xff) return input;
    const marker = input[i + 1];
    if (marker === 0xda) {
      for (let j = i; j < input.length; j++) out.push(input[j]);
      return new Uint8Array(out);
    }
    const len = (input[i + 2] << 8) | input[i + 3];
    if (len < 2) return input;
    const end = i + 2 + len;
    if (end > input.length) return input;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) for (let j = i; j < end; j++) out.push(input[j]);
    i = end;
  }
  return input;
}

/** WebP：去掉 EXIF / XMP chunk，保留 ICCP 与像素数据 */
function stripWebp(input: Uint8Array): Uint8Array {
  if (input.length < 12) return input;
  const four = (offset: number) => String.fromCharCode(...input.slice(offset, offset + 4));
  if (four(0) !== "RIFF" || four(8) !== "WEBP") return input;

  const chunks: { four: string; start: number; end: number }[] = [];
  let i = 12;
  while (i + 8 <= input.length) {
    const tag = four(i);
    const size =
      (input[i + 4] | (input[i + 5] << 8) | (input[i + 6] << 16) | (input[i + 7] << 24)) >>> 0;
    const end = i + 8 + size + (size % 2);
    if (end > input.length) return input;
    chunks.push({ four: tag, start: i, end });
    i = end;
  }

  const kept = chunks.filter((c) => c.four !== "EXIF" && c.four !== "XMP ");
  if (kept.length === chunks.length) return input;

  const body: number[] = [];
  for (const c of kept) for (let j = c.start; j < c.end; j++) body.push(input[j]);

  const riffSize = 4 + body.length;
  const out = new Uint8Array(8 + riffSize);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  out[4] = riffSize & 255;
  out[5] = (riffSize >> 8) & 255;
  out[6] = (riffSize >> 16) & 255;
  out[7] = (riffSize >> 24) & 255;
  out.set([0x57, 0x45, 0x42, 0x50], 8);
  out.set(body, 12);
  return out;
}

function bytesBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

async function stripMetadata(file: File): Promise<Blob> {
  if (file.type === "image/jpeg") {
    const stripped = stripJpeg(new Uint8Array(await file.arrayBuffer()));
    return bytesBlob(stripped, "image/jpeg");
  }
  if (file.type === "image/webp") {
    const stripped = stripWebp(new Uint8Array(await file.arrayBuffer()));
    return bytesBlob(stripped, "image/webp");
  }
  return file;
}

/**
 * 解码 → 缩略图 + 主图。
 * 1) 小 JPEG/WebP（≤1MB、≤2000px、无 GPS、方向正常）→ 剥掉元数据后原样上传；
 * 2) 其余 → canvas 转 WebP；过大且不透明时改 JPEG；透明图保留 WebP。
 */
export async function toOptimizedImage(
  file: File,
  opts: { hasGps?: boolean; orientation?: number } = {}
): Promise<ConvertedPhoto> {
  const source = await decode(file);
  const sw = "width" in source ? source.width : 0;
  const sh = "height" in source ? source.height : 0;
  if (!sw || !sh) throw new Error("图片尺寸读取失败");

  const webSafe = file.type === "image/jpeg" || file.type === "image/webp";
  const canPassThrough =
    webSafe &&
    file.size <= PASSTHROUGH_MAX &&
    Math.max(sw, sh) <= MAX_EDGE &&
    !opts.hasGps &&
    (opts.orientation ?? 1) === 1;

  // 缩略图（列表 / 地图 / 胶片用它，灯箱才用主图）
  const thumbScale = Math.min(1, THUMB_EDGE / Math.max(sw, sh));
  const tw = Math.max(1, Math.round(sw * thumbScale));
  const th = Math.max(1, Math.round(sh * thumbScale));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = tw;
  thumbCanvas.height = th;
  draw(thumbCanvas, source as CanvasImageSource);

  const alpha = hasAlpha(thumbCanvas);
  let thumb = await canvasBlob(thumbCanvas, "image/webp", THUMB_QUALITY);
  if (!thumb) throw new Error("缩略图编码失败");
  if (thumb.size > MAX_THUMB_BYTES) {
    const jpeg = await canvasBlob(thumbCanvas, "image/jpeg", 0.8);
    if (jpeg && jpeg.size < thumb.size) thumb = jpeg;
  }

  let blob: Blob;
  let width: number;
  let height: number;

  if (canPassThrough) {
    blob = await stripMetadata(file);
    width = sw;
    height = sh;
  } else {
    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    width = Math.max(1, Math.round(sw * scale));
    height = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas, source as CanvasImageSource);

    const webp = await canvasBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!webp) throw new Error("图片编码失败");

    let out = webp;
    if (webp.size > MAX_UPLOAD_BYTES && !alpha) {
      let jpeg = await canvasBlob(canvas, "image/jpeg", 0.82);
      if (jpeg && jpeg.size > 2_000_000) {
        const smaller = await canvasBlob(canvas, "image/jpeg", 0.72);
        if (smaller && smaller.size < jpeg.size) jpeg = smaller;
      }
      if (jpeg && jpeg.size < webp.size) out = jpeg;
    }
    blob = out;
  }

  if ("close" in source && typeof source.close === "function") source.close();

  return { blob, width, height, thumb, thumbWidth: tw, thumbHeight: th };
}

export function isHeic(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
}

/** 原文件字节的 SHA-256（查重用）。环境不支持或读取失败时返回 undefined，不影响上传 */
export async function sha256Hex(file: Blob): Promise<string | undefined> {
  try {
    const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
    if (!subtle) return undefined;
    const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
    let hex = "";
    for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
    return hex;
  } catch {
    return undefined;
  }
}

/** 显示拍摄时间：直接取 ISO 里的当地日期与时间（不换算时区） */
export function formatTakenAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (m) return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "时间未知";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
