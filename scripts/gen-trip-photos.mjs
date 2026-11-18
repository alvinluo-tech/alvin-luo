#!/usr/bin/env node
/**
 * gen-trip-photos.mjs — 从上传清单生成 data/trip-photos.generated.ts
 *
 * 输入格式（自动识别）：
 *   1. photo_links.txt（Python 上传脚本产出）：每行 `travel/08-beijing.webp: https://…`
 *   2. JSON 对象：{ "travel/08-beijing.webp": "https://…" }
 *   3. JSON 数组：[{ key, url, trip?, takenAt?, w?, h?, caption?, cover? }]
 *   4. Worker manifest：{ photos: [ … ] }
 *
 * 站点归属：优先用条目的 trip 字段（两位编号），否则从对象名解析：
 *   travel/08-beijing.webp → 站点 08。
 * 同一编号多张时，优先 cover: true / 文件名含 cover，其次按拍摄时间升序。
 *
 * 用法：
 *   node scripts/gen-trip-photos.mjs --in photo_links.txt
 *   node scripts/gen-trip-photos.mjs --in manifest.json --base https://pub-xxx.r2.dev
 *   node scripts/gen-trip-photos.mjs --remote https://upload.alvin-luo.me/manifest
 *   node scripts/gen-trip-photos.mjs --check            # 只校验生成文件里的编号
 *
 * 构建安全：--remote 拉取失败时保留现有生成文件（没有就写空表）并 exit 0，
 * 不让网络问题把静态构建打断。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "data", "trip-photos.generated.ts");

/* ---------- 参数 ---------- */
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const inputPath = opt("in");
const remoteUrl = opt("remote");
const outPath = opt("out") || OUT_FILE;
const baseUrl = (opt("base") || "").replace(/\/+$/, "");
const checkOnly = args.includes("--check");
const strict = args.includes("--strict");

/* ---------- 读清单 ---------- */
function normalize(value, keyHint) {
  if (typeof value === "string") return keyHint ? { key: keyHint, url: value } : null;
  if (!value || typeof value !== "object") return null;
  const key = value.key ?? value.Key ?? keyHint;
  const url = value.url ?? value.URL ?? value.publicUrl;
  if (!key || !url) return null;
  return {
    key: String(key),
    url: String(url),
    trip: typeof value.trip === "string" ? value.trip : undefined,
    takenAt: value.takenAt ? String(value.takenAt) : undefined,
    w: Number.isFinite(value.w) ? Number(value.w) : undefined,
    h: Number.isFinite(value.h) ? Number(value.h) : undefined,
    caption: value.caption ? String(value.caption) : undefined,
    cover: value.cover === true,
  };
}

function normalizeTrip(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id ?? value.img ?? "");
  if (!/^\d{2}$/.test(id)) return null;
  const coord = Array.isArray(value.coord) && value.coord.length === 2
    ? [Number(value.coord[0]), Number(value.coord[1])]
    : null;
  if (!value.country || !value.place || !coord || !coord.every(Number.isFinite)) return null;
  return {
    img: id,
    country: String(value.country),
    countryEn: value.countryEn ? String(value.countryEn) : undefined,
    place: String(value.place),
    coord,
  };
}

function readManifest(raw) {
  const text = String(raw).trim();
  if (!text) return { photos: [], trips: [] };

  if (text.startsWith("{") || text.startsWith("[")) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return { photos: data.map((v) => normalize(v)).filter(Boolean), trips: [] };
    if (Array.isArray(data.photos) || Array.isArray(data.trips)) {
      return {
        photos: (data.photos || []).map((v) => normalize(v)).filter(Boolean),
        trips: (data.trips || []).map((v) => normalizeTrip(v)).filter(Boolean),
      };
    }
    if (Array.isArray(data.items)) {
      return { photos: data.items.map((v) => normalize(v)).filter(Boolean), trips: [] };
    }
    return {
      photos: Object.entries(data)
        .map(([key, value]) => normalize(value, key))
        .filter(Boolean),
      trips: [],
    };
  }

  // photo_links.txt 形态：`key: url`
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf(": ");
    if (idx < 0) continue;
    const key = t.slice(0, idx).trim();
    const url = t.slice(idx + 2).trim();
    if (key && url) rows.push({ key, url });
  }
  return { photos: rows, trips: [] };
}

/* ---------- 解析编号 ---------- */
const KEY_RE = /^(?:travel\/)?(\d{2})(?:[-_.].*)?\.(?:webp|jpe?g|png|avif)$/i;

function stopOf(entry) {
  if (entry.trip && /^\d{2}$/.test(entry.trip)) return entry.trip;
  const m = entry.key.match(KEY_RE);
  return m ? m[1] : null;
}

function byTime(a, b) {
  const ta = a.takenAt ? Date.parse(a.takenAt) : NaN;
  const tb = b.takenAt ? Date.parse(b.takenAt) : NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  if (Number.isFinite(ta)) return -1;
  if (Number.isFinite(tb)) return 1;
  return a.key.localeCompare(b.key);
}

/* ---------- 校验站点编号存在 ---------- */
function knownStops() {
  const src = fs.readFileSync(path.join(ROOT, "data", "trips.ts"), "utf8");
  return new Set([...src.matchAll(/img:\s*"(\d{2})"/g)].map((m) => m[1]));
}

/* ---------- 渲染 ---------- */
const esc = (v) => JSON.stringify(v);

function renderPhoto(p) {
  const parts = [`url: ${esc(p.url)}`];
  if (p.takenAt) parts.push(`takenAt: ${esc(p.takenAt)}`);
  if (p.w) parts.push(`w: ${p.w}`);
  if (p.h) parts.push(`h: ${p.h}`);
  if (p.caption) parts.push(`caption: ${esc(p.caption)}`);
  return `{ ${parts.join(", ")} }`;
}

function render(groups, timeline, derivedDates, extraTrips = []) {
  const stops = [...groups.keys()].sort();
  const photoLines = stops
    .map((stop) => {
      const items = groups.get(stop).map((p) => `    ${renderPhoto(p)},`).join("\n");
      return `  ${esc(stop)}: [\n${items}\n  ],`;
    })
    .join("\n");

  const dateLines = [...derivedDates.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([stop, date]) => `  ${esc(stop)}: ${esc(date)},`)
    .join("\n");

  const timelineBody = timeline
    .map((p) => {
      const inner = renderPhoto(p);
      return `  { trip: ${esc(p.trip)}, ${inner.slice(2, -2)} },`;
    })
    .join("\n");

  const tripLines = [...extraTrips]
    .sort((a, b) => a.img.localeCompare(b.img))
    .map((t) => {
      const countryEn = t.countryEn ? `countryEn: ${esc(t.countryEn)}, ` : "";
      return `  { img: ${esc(t.img)}, country: ${esc(t.country)}, ${countryEn}place: ${esc(
        t.place
      )}, date: "", note: "", coord: [${t.coord[0]}, ${t.coord[1]}] },`;
    })
    .join("\n");

  return `/* 由 scripts/gen-trip-photos.mjs 自动生成 —— 请勿手改
 *
 * 用途：R2 批量上传后，把「站点编号 → 照片列表」注入旅行轨迹页。
 * 优先级：trips.ts 里手写的 photoUrl > 本文件 > 本地 public/travel/{img}.webp
 * 重新生成：npm run photos:gen -- --in <photo_links.txt|manifest.json>
 *          npm run photos:gen -- --remote https://upload.alvin-luo.me/manifest
 */

export type GeneratedTripPhoto = {
  url: string;
  /** 拍摄时间（ISO 8601，带偏移则保留） */
  takenAt?: string;
  w?: number;
  h?: number;
  caption?: string;
};

/** 上传页新建、还没写进 trips.ts 的行程（构建时并进 TRIPS） */
export type GeneratedTrip = {
  img: string;
  country: string;
  countryEn?: string;
  place: string;
  date: string;
  note: string;
  coord: [number, number];
};

/** 站点编号 → 照片（第一张为封面） */
export const TRIP_PHOTOS: Record<string, GeneratedTripPhoto[]> = {
${photoLines}
};

/** 站点编号 → 派生日期（"2026.11.16"）。trips.ts 里手写了 date 的优先 */
export const TRIP_DATE: Record<string, string> = {
${dateLines}
};

/** 全局时间线：按拍摄时间升序，供未来的时间轨迹地图使用 */
export const PHOTO_TIMELINE: (GeneratedTripPhoto & { trip: string })[] = [
${timelineBody}
];

/** 上传页新建的行程 */
export const EXTRA_TRIPS: GeneratedTrip[] = [
${tripLines}
];
`;
}

/* ---------- 空表（网络失败且没有旧文件时兜底） ---------- */
function emptyTemplate() {
  return `/* 由 scripts/gen-trip-photos.mjs 自动生成 —— 请勿手改 */
export type GeneratedTripPhoto = {
  url: string;
  takenAt?: string;
  w?: number;
  h?: number;
  caption?: string;
};
export type GeneratedTrip = {
  img: string;
  country: string;
  countryEn?: string;
  place: string;
  date: string;
  note: string;
  coord: [number, number];
};
export const TRIP_PHOTOS: Record<string, GeneratedTripPhoto[]> = {};
export const TRIP_DATE: Record<string, string> = {};
export const PHOTO_TIMELINE: (GeneratedTripPhoto & { trip: string })[] = [];
export const EXTRA_TRIPS: GeneratedTrip[] = [];
`;
}

/* ---------- 远程拉取 ---------- */
async function fetchRemote(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- main ---------- */
async function main() {
  const stops = knownStops();

  if (checkOnly) {
    const existing = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : "";
    const photoIds = [...existing.matchAll(/^  "(\d{2})": \[/gm)].map((m) => m[1]);
    const tripIds = [...existing.matchAll(/img: "(\d{2})"/g)].map((m) => m[1]);
    const allowed = new Set([...stops, ...tripIds]);
    const unknown = photoIds.filter((id) => !allowed.has(id));
    console.log(
      `生成文件里 ${photoIds.length} 个有照片的站点、${tripIds.length} 个新建行程；trips.ts 手写 ${stops.size} 个站点。`
    );
    if (unknown.length) {
      console.error(`✗ 生成文件引用了不存在的站点编号：${unknown.join(", ")}`);
      process.exit(1);
    }
    console.log("✓ 编号全部有效");
    return;
  }

  let raw = null;
  if (remoteUrl) {
    try {
      raw = await fetchRemote(remoteUrl);
      console.log(`✓ 已拉取 ${remoteUrl}`);
    } catch (e) {
      const hasOld = fs.existsSync(outPath) && fs.readFileSync(outPath, "utf8").trim().length > 0;
      console.warn(`⚠ 拉取失败（${e.message}）`);
      if (hasOld) {
        console.warn("  保留上一次生成的 data/trip-photos.generated.ts，跳过本次同步。");
      } else {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, emptyTemplate(), "utf8");
        console.warn("  没有旧文件可用，写入空表以保证构建继续。");
      }
      if (strict) process.exit(1);
      return;
    }
  } else if (inputPath) {
    if (!fs.existsSync(inputPath)) {
      console.error(`✗ 清单不存在：${inputPath}`);
      process.exit(1);
    }
    raw = fs.readFileSync(inputPath, "utf8");
  } else {
    console.error(
      "用法：node scripts/gen-trip-photos.mjs --in <photo_links.txt|manifest.json> [--base https://pub-xxx.r2.dev]\n" +
        "      node scripts/gen-trip-photos.mjs --remote https://upload.alvin-luo.me/manifest\n" +
        "      node scripts/gen-trip-photos.mjs --check"
    );
    process.exit(1);
  }

  const { photos: rows, trips: extraTrips } = readManifest(raw);
  for (const row of rows) {
    if (!/^https?:\/\//.test(row.url)) {
      if (!baseUrl) {
        console.error(`✗ ${row.key} 的链接不是绝对地址，且未提供 --base`);
        process.exit(1);
      }
      row.url = `${baseUrl}/${row.key.replace(/^\/+/, "")}`;
    }
  }

  const groups = new Map();
  for (const row of rows) {
    const stop = stopOf(row);
    if (!stop) {
      console.warn(`  ! 跳过无法识别编号的对象：${row.key}`);
      continue;
    }
    if (!groups.has(stop)) groups.set(stop, []);
    groups.get(stop).push(row);
  }

  const allowed = new Set([...stops, ...extraTrips.map((t) => t.img)]);
  const unknown = [...groups.keys()].filter((id) => !allowed.has(id));
  if (unknown.length) {
    console.warn(`⚠ 这些编号在 trips.ts / 新建行程里都找不到，已跳过：${unknown.join(", ")}`);
    for (const id of unknown) groups.delete(id);
  }

  // 每组排序并把封面放第一
  for (const [, items] of groups) {
    items.sort(byTime);
    const coverIdx = items.findIndex((p) => p.cover || /[-_.]cover\./i.test(p.key));
    if (coverIdx > 0) items.unshift(...items.splice(coverIdx, 1));
  }

  // 派生日期：该站最早一张有拍摄时间的照片 → YYYY.MM.DD（取 ISO 里的当地日期）
  const derivedDates = new Map();
  for (const [stop, items] of groups) {
    const first = items.find((p) => p.takenAt && Number.isFinite(Date.parse(p.takenAt)));
    if (!first) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(first.takenAt);
    if (m) {
      derivedDates.set(stop, `${m[1]}.${m[2]}.${m[3]}`);
      continue;
    }
    const d = new Date(first.takenAt);
    derivedDates.set(
      stop,
      `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
    );
  }

  // 全局时间线
  const timeline = [];
  for (const [stop, items] of groups) {
    for (const p of items) {
      if (p.takenAt && Number.isFinite(Date.parse(p.takenAt))) timeline.push({ ...p, trip: stop });
    }
  }
  timeline.sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, render(groups, timeline, derivedDates, extraTrips), "utf8");

  const total = [...groups.values()].reduce((n, items) => n + items.length, 0);
  console.log(
    `✓ 生成 ${groups.size} 个站点 / ${total} 张照片 / ${timeline.length} 条时间线 → ${path.relative(ROOT, outPath)}`
  );
  for (const stop of [...groups.keys()].sort()) {
    const items = groups.get(stop);
    console.log(`  ${stop}  ${items.length} 张${derivedDates.has(stop) ? `  最早 ${derivedDates.get(stop)}` : ""}`);
  }
  const missing = [...stops].filter((s) => !groups.has(s));
  if (missing.length) console.log(`\n仍未上传照片的站点（${missing.length}）：${missing.join(" ")}`);
}

main().catch((e) => {
  console.error(`✗ ${e.stack || e.message}`);
  process.exit(1);
});

