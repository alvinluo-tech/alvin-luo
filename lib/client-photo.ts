/**
 * 手机端照片处理：EXIF 读取 → 转 WebP。
 * 顺序不能反：canvas 转码会抹掉 EXIF，所以必须先读元数据。
 */

import { TRIPS } from "@/data/trips";

export type PhotoMeta = {
  takenAt: string;
  /** [lng, lat]，仅用于归站，不上传 */
  gps?: [number, number];
};

export type ConvertedPhoto = {
  blob: Blob;
  width: number;
  height: number;
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
export const WEBP_QUALITY = 0.82;

const EXIF_PICK = [
  "DateTimeOriginal",
  "CreateDate",
  "DateTime",
  "OffsetTimeOriginal",
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
] as const;

export function isHeic(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
}

/** 读拍摄时间与 GPS。任何失败都退化为文件修改时间，不阻塞上传。 */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  const fallback = new Date(file.lastModified || Date.now()).toISOString();
  try {
    const exifr = (await import("exifr")).default;
    const data = (await exifr.parse(file, { pick: [...EXIF_PICK], gps: true })) as
      | Record<string, unknown>
      | undefined;
    if (!data) return { takenAt: fallback };

    const rawDate = data.DateTimeOriginal ?? data.CreateDate ?? data.DateTime;
    const date = rawDate instanceof Date ? rawDate : rawDate ? new Date(String(rawDate)) : null;
    const takenAt = date && Number.isFinite(date.getTime()) ? date.toISOString() : fallback;

    const lat = typeof data.latitude === "number" ? data.latitude : undefined;
    const lng = typeof data.longitude === "number" ? data.longitude : undefined;
    return lng !== undefined && lat !== undefined ? { takenAt, gps: [lng, lat] } : { takenAt };
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

/** 解码 → 等比缩到长边 2000 → WebP。方向在解码时已经落进像素。 */
export async function toWebp(file: File): Promise<ConvertedPhoto> {
  const source = await decode(file);
  const sw = "width" in source ? source.width : 0;
  const sh = "height" in source ? source.height : 0;
  if (!sw || !sh) throw new Error("图片尺寸读取失败");

  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 不可用");
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source && typeof source.close === "function") source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
  );
  if (!blob) throw new Error("WebP 编码失败");
  return { blob, width, height };
}

export function formatTakenAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "时间未知";
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
