/**
 * 地点名工具：反向地理编码结果 + 国家中文名。
 * 只做纯函数，网络请求留在上传页（需要 token）。
 */

export type GeoPlace = {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  label: string;
};

/** ISO 国家码 → 指定语言的国家名（浏览器内置数据，无需额外依赖） */
export function countryName(code: string | undefined, lang: "zh-CN" | "en", fallback?: string): string {
  try {
    if (code) {
      const names = new Intl.DisplayNames([lang], { type: "region" });
      const name = names.of(code.toUpperCase());
      if (name && name !== code) return name;
    }
  } catch {
    /* 旧浏览器不支持 DisplayNames */
  }
  return fallback ?? "";
}

/** ISO 国家码 → 中文名 */
export function countryZh(code?: string, fallback?: string): string {
  return countryName(code, "zh-CN", fallback);
}

/** ISO 国家码 → 英文名 */
export function countryEn(code?: string, fallback?: string): string {
  return countryName(code, "en", fallback);
}

/** 新行程对话框的预填值 */
export function tripFromPlace(geo?: GeoPlace | null): {
  country: string;
  countryEn: string;
  place: string;
} {
  if (!geo) return { country: "", countryEn: "", place: "" };
  return {
    country: countryZh(geo.countryCode, geo.country) || "",
    countryEn: countryEn(geo.countryCode, geo.country) || "",
    place: geo.city || geo.region || "",
  };
}
