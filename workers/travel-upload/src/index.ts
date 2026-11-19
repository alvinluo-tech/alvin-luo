/**
 * travel-upload — 旅行照片上传 Worker
 *
 * 端点：
 *   GET  /health            公开，部署后自检
 *   GET  /manifest          公开，聚合 travel/_meta/*.json（构建时同步用）
 *   POST /upload            需要 Bearer token，multipart：file / trip / takenAt / w / h / cover / caption
 *   POST /publish           需要 Bearer token，触发 GitHub Actions 构建
 *   GET  /status            需要 Bearer token，查最近一次构建状态
 *
 * 绑定与变量见 wrangler.toml；密钥用 `wrangler secret put` 写入。
 * 隐私：EXIF GPS 只在手机端用于归站，Worker 不接收、不存储。
 */

export interface Env {
  PHOTOS: R2Bucket;
  UPLOAD_TOKEN: string;
  PUBLIC_BASE?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string; // alvinluo-tech/alvin-luo
  GITHUB_WORKFLOW?: string; // 默认 deploy.yml
  GITHUB_REF?: string; // 默认 main
  ALLOWED_ORIGINS?: string; // 逗号分隔
}

const DEFAULT_PUBLIC_BASE = "https://pub-996ee35c86674a47bf3eb5e069624f90.r2.dev";
const DEFAULT_ALLOWED = "https://alvin-luo.me";
const PHOTO_PREFIX = "travel/";
const META_PREFIX = "travel/_meta/";
const TRIP_PREFIX = "travel/_trips/";
/** 站点「当前常驻」：由上传页用 IP 属地更新，构建时写进站点 */
const BASE_KEY = "travel/_base.json";
/* 原文件 SHA-256（客户端算）与处理后文件 SHA-256（服务端算）→ 照片指针，
   用于服务端查重。放在 _hashes/ 下，不会被 /manifest 的 _meta/_trips 列表带走。 */
const HASH_PREFIX = "travel/_hashes/";
const THUMB_PREFIX = "travel/_thumbs/";
const GEO_PREFIX = "travel/_geo/";
const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MANIFEST = 5000;

/** 字节数组的 SHA-256（小写 hex）。Workers 自带 WebCrypto */
async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  let hex = "";
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

const SHA_RE = /^[a-f0-9]{64}$/;

/* ---------------- 基础工具 ---------------- */

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const ok = allowedOrigins(env).includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowedOrigins(env)[0] || "",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

/** 常量时间比较，避免 token 被按字符计时猜出来 */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

function authorized(request: Request, env: Env): boolean {
  if (!env.UPLOAD_TOKEN) return false;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && safeEqual(token, env.UPLOAD_TOKEN);
}

function text(value: FormDataEntryValue | null, max = 200): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function publicBase(env: Env): string {
  return (env.PUBLIC_BASE || DEFAULT_PUBLIC_BASE).replace(/\/+$/, "");
}

function publicUrl(env: Env, key: string): string {
  return `${publicBase(env)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function randomSuffix(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function keyFor(trip: string, takenAt: string, ext = "webp"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(takenAt);
  const d = Number.isFinite(Date.parse(takenAt)) ? new Date(takenAt) : new Date();
  const date = m
    ? `${m[1]}${m[2]}${m[3]}`
    : `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
  return `${PHOTO_PREFIX}${trip}-${date}-${randomSuffix()}.${ext}`;
}

function metaKeyFor(key: string): string {
  const base = key.slice(PHOTO_PREFIX.length).replace(/\.[^.]+$/, "");
  return `${META_PREFIX}${base}.json`;
}

/* ---------------- 简易限流（按 isolate，尽力而为） ---------------- */

const hits = new Map<string, { n: number; reset: number }>();

function rateLimited(ip: string, limit = 120, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.reset <= now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  cur.n += 1;
  return cur.n > limit;
}

/* ---------------- 路由 ---------------- */

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (rateLimited(ip)) return json({ error: "too many uploads, try later" }, 429);

  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BYTES + 64 * 1024) return json({ error: "payload too large" }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "expected multipart/form-data" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "missing file" }, 400);
  if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "file size invalid" }, 413);
  if (!/^image\/(webp|jpeg|png)$/.test(file.type)) {
    return json({ error: `unsupported type: ${file.type || "unknown"}` }, 415);
  }

  const trip = text(form.get("trip"), 2);
  if (!/^\d{2}$/.test(trip)) return json({ error: "trip must be two digits" }, 400);

  const takenAtRaw = text(form.get("takenAt"), 40);
  // 保留客户端传来的当地时区（如 +02:00），不要把日期推成 UTC 的前一天
  const takenAt =
    Number.isFinite(Date.parse(takenAtRaw)) && /^\d{4}-\d{2}-\d{2}T/.test(takenAtRaw)
      ? takenAtRaw
      : new Date().toISOString();

  /* 查重：hash = 原文件字节 SHA-256（客户端算）；
     bhash = 处理后的文件字节 SHA-256（服务端算，用来覆盖没有原文件 hash 的老照片）。
     force=1 表示用户明确要求「仍然上传」同一张照片。 */
  const hashRaw = text(form.get("hash"), 64);
  const hash = SHA_RE.test(hashRaw) ? hashRaw : undefined;
  const force = text(form.get("force"), 2) === "1";

  const bytes = await file.arrayBuffer();
  const bhash = await sha256Hex(bytes);

  if (!force) {
    for (const probe of [hash, bhash]) {
      if (!probe) continue;
      const hit = await env.PHOTOS.get(HASH_PREFIX + probe);
      if (!hit) continue;
      let photo: unknown = null;
      try {
        photo = JSON.parse(await hit.text());
      } catch {
        photo = null;
      }
      return json({ error: "duplicate", photo }, 409);
    }
  }

  const key = keyFor(
    trip,
    takenAt,
    file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"
  );
  await env.PHOTOS.put(key, bytes, {
    httpMetadata: { contentType: file.type, cacheControl: CACHE_IMMUTABLE },
  });

  // 可选缩略图：列表/地图只加载它，灯箱才用原图
  const thumb = form.get("thumb");
  let thumbKey: string | undefined;
  let thumbUrl: string | undefined;
  if (
    thumb instanceof File &&
    thumb.size > 0 &&
    thumb.size <= 600 * 1024 &&
    /^image\/(webp|jpeg|png)$/.test(thumb.type)
  ) {
    const base = key.slice(PHOTO_PREFIX.length).replace(/\.[^.]+$/, "");
    const thumbExt =
      thumb.type === "image/jpeg" ? "jpg" : thumb.type === "image/png" ? "png" : "webp";
    thumbKey = `${THUMB_PREFIX}${base}.${thumbExt}`;
    await env.PHOTOS.put(thumbKey, thumb.stream(), {
      httpMetadata: { contentType: thumb.type, cacheControl: CACHE_IMMUTABLE },
    });
    thumbUrl = publicUrl(env, thumbKey);
  }

  const w = Number(text(form.get("w"), 8)) || undefined;
  const h = Number(text(form.get("h"), 8)) || undefined;
  const caption = text(form.get("caption"), 300) || undefined;
  const place = text(form.get("place"), 120) || undefined;
  const cover = text(form.get("cover"), 3) === "1";

  const meta = {
    key,
    url: publicUrl(env, key),
    thumbKey,
    thumbUrl,
    trip,
    takenAt,
    w,
    h,
    caption,
    place,
    cover,
    bytes: file.size,
    hash,
    bhash,
    uploadedAt: new Date().toISOString(),
  };

  await env.PHOTOS.put(metaKeyFor(key), JSON.stringify(meta), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  /* 先写照片与 meta，再登记 hash 指针；下次同文件上传会 409。
     bhash 每次都有，hash 只有客户端算得出来时才写。 */
  for (const probe of [hash, bhash]) {
    if (!probe) continue;
    await env.PHOTOS.put(
      HASH_PREFIX + probe,
      JSON.stringify({ key, trip, takenAt, url: meta.url }),
      { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } }
    );
  }
  invalidateManifest();

  return json(meta, 201);
}

async function listKeys(env: Env, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PHOTOS.list({ prefix, limit: 1000, cursor });
    for (const obj of page.objects) keys.push(obj.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && keys.length < MAX_MANIFEST);
  return keys;
}

async function readJsonObjects(env: Env, keys: string[]): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    const parsed = await Promise.all(
      chunk.map(async (key) => {
        const obj = await env.PHOTOS.get(key);
        if (!obj) return null;
        try {
          return JSON.parse(await obj.text()) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
    );
    for (const row of parsed) if (row) rows.push(row);
  }
  return rows;
}

/* ---------------- manifest 短缓存（isolate 内存） ----------------
 * /manifest 公开无鉴权，每次请求都要 list + 逐条读全部 sidecar
 * （25 张 = 26 次 R2 读，5000 张 = 5000 次/请求），必须 memo。
 * TTL 30s；任何写操作（上传/修改/删除/新建行程）立即失效——
 * publish 触发的 CI 拉取发生在几分钟之后，不会读到旧清单。 */
let manifestCache: { at: number; body: string } | null = null;
const MANIFEST_TTL_MS = 30_000;

function invalidateManifest(): void {
  manifestCache = null;
}

async function buildManifestBody(env: Env): Promise<string> {
  const [metaKeys, tripKeys] = await Promise.all([
    listKeys(env, META_PREFIX),
    listKeys(env, TRIP_PREFIX),
  ]);

  const [metaRows, tripRows, baseObj] = await Promise.all([
    readJsonObjects(env, metaKeys),
    readJsonObjects(env, tripKeys),
    env.PHOTOS.get(BASE_KEY),
  ]);

  let base: unknown = null;
  if (baseObj) {
    try {
      base = JSON.parse(await baseObj.text());
    } catch {
      base = null;
    }
  }

  const photos = metaRows.filter(
    (row) => typeof row.url === "string" && typeof row.trip === "string"
  );

  photos.sort((a, b) => {
    const ta = Date.parse(String(a.takenAt || ""));
    const tb = Date.parse(String(b.takenAt || ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return String(a.key).localeCompare(String(b.key));
  });

  const trips = tripRows
    .filter(
      (row) =>
        typeof row.id === "string" &&
        typeof row.country === "string" &&
        typeof row.place === "string" &&
        Array.isArray(row.coord)
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return JSON.stringify({ count: photos.length, photos, trips, base });
}

async function handleManifest(env: Env): Promise<Response> {
  const now = Date.now();
  if (!manifestCache || now - manifestCache.at >= MANIFEST_TTL_MS) {
    manifestCache = { at: now, body: await buildManifestBody(env) };
  }
  return new Response(manifestCache.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** 站点「当前常驻」：GET 公开读，POST 需鉴权写。
 *  上传页用 IP 属地检测后写入，构建时由 manifest.base 带进站点。 */
async function handleBase(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const obj = await env.PHOTOS.get(BASE_KEY);
    if (!obj) return json({ base: null }, 200);
    try {
      return json({ base: JSON.parse(await obj.text()) }, 200, { "Cache-Control": "no-store" });
    } catch {
      return json({ base: null }, 200);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "expected application/json" }, 400);
  }
  const place = text(body.place, 40);
  const placeEn = text(body.placeEn, 40);
  const region = text(body.region, 40);
  const country = text(body.country, 40);
  const countryCode = text(body.countryCode, 4);
  const coord = Array.isArray(body.coord) ? body.coord : [];
  const lng = Number(coord[0]);
  const lat = Number(coord[1]);
  if (!place) return json({ error: "place required" }, 400);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: "invalid coord" }, 400);
  }

  const base = {
    place,
    placeEn: placeEn || place,
    region,
    country,
    countryCode,
    coord: [lng, lat],
    updatedAt: new Date().toISOString(),
  };
  await env.PHOTOS.put(BASE_KEY, JSON.stringify(base), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  invalidateManifest();
  return json(base, 200);
}

/** 新建行程：写 travel/_trips/<id>.json，构建时并进 TRIPS */
async function handleTrip(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "expected application/json" }, 400);
  }

  const id = String(body.id ?? "");
  if (!/^\d{2}$/.test(id)) return json({ error: "id must be two digits" }, 400);

  const country = String(body.country ?? "").trim().slice(0, 40);
  const countryEn = String(body.countryEn ?? "").trim().slice(0, 40) || undefined;
  const place = String(body.place ?? "").trim().slice(0, 80);
  if (!country || !place) return json({ error: "country and place are required" }, 400);

  const coord = body.coord;
  if (
    !Array.isArray(coord) ||
    coord.length !== 2 ||
    !coord.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    return json({ error: "coord must be [lng, lat]" }, 400);
  }
  const [lng, lat] = coord as [number, number];
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return json({ error: "coord out of range" }, 400);
  }

  const key = `${TRIP_PREFIX}${id}.json`;
  const existing = await env.PHOTOS.get(key);
  if (existing) {
    const data = (await existing.json().catch(() => null)) as Record<string, unknown> | null;
    if (data?.place && data.place !== place) {
      return json({ error: `trip ${id} already exists (${data.place})` }, 409);
    }
  }

  const trip = {
    id,
    country,
    countryEn,
    place,
    // 坐标压到两位小数（约 1km），够地图用又不暴露精确位置
    coord: [Math.round(lng * 100) / 100, Math.round(lat * 100) / 100],
    createdAt: new Date().toISOString(),
  };

  await env.PHOTOS.put(key, JSON.stringify(trip), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  invalidateManifest();

  return json(trip, existing ? 200 : 201);
}

/** 修改已上传照片：归属 / 图注 / 封面 */
async function handlePhotoPatch(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "expected application/json" }, 400);
  }

  const key = String(body.key ?? "");
  if (!/^travel\/\d{2}-[^/]+\.(webp|jpe?g|png)$/i.test(key)) {
    return json({ error: "invalid photo key" }, 400);
  }

  const hasTrip = body.trip !== undefined;
  const hasCaption = body.caption !== undefined;
  const hasPlace = body.place !== undefined;
  const hasCover = body.cover !== undefined;
  if (!hasTrip && !hasCaption && !hasPlace && !hasCover) {
    return json({ error: "nothing to update" }, 400);
  }

  const trip = hasTrip ? String(body.trip) : undefined;
  if (trip !== undefined && !/^\d{2}$/.test(trip)) {
    return json({ error: "trip must be two digits" }, 400);
  }

  const metaKey = metaKeyFor(key);
  const obj = await env.PHOTOS.get(metaKey);
  if (!obj) return json({ error: "photo metadata not found" }, 404);

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(await obj.text()) as Record<string, unknown>;
  } catch {
    return json({ error: "photo metadata is corrupted" }, 500);
  }

  if (trip !== undefined) meta.trip = trip;
  if (hasCaption) {
    const caption = String(body.caption ?? "").trim().slice(0, 300);
    if (caption) meta.caption = caption;
    else delete meta.caption;
  }
  if (hasPlace) {
    const place = String(body.place ?? "").trim().slice(0, 120);
    if (place) meta.place = place;
    else delete meta.place;
  }
  if (hasCover) meta.cover = body.cover === true;
  meta.updatedAt = new Date().toISOString();

  await env.PHOTOS.put(metaKey, JSON.stringify(meta), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  invalidateManifest();

  return json(meta, 200);
}

/** 删除已上传照片（对象 + sidecar + 缩略图） */
async function handlePhotoDelete(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "expected application/json" }, 400);
  }

  const key = String(body.key ?? "");
  if (!/^travel\/\d{2}-[^/]+\.(webp|jpe?g|png)$/i.test(key)) {
    return json({ error: "invalid photo key" }, 400);
  }

  const metaKey = metaKeyFor(key);
  const obj = await env.PHOTOS.get(metaKey);
  let meta: Record<string, unknown> | null = null;
  if (obj) {
    try {
      meta = JSON.parse(await obj.text()) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  }

  await env.PHOTOS.delete(key);
  if (obj) await env.PHOTOS.delete(metaKey);
  if (meta && typeof meta.thumbKey === "string") await env.PHOTOS.delete(meta.thumbKey);
  /* 删掉照片后清 hash/bhash 指针，否则这张照片再也传不回来。
     同一张图被强制上传过多次时，只清指向当前 key 的指针。 */
  for (const probe of [meta?.hash, meta?.bhash]) {
    if (typeof probe !== "string" || !SHA_RE.test(probe)) continue;
    const markerKey = HASH_PREFIX + probe;
    const marker = await env.PHOTOS.get(markerKey);
    if (!marker) continue;
    let pointTo: unknown = null;
    try {
      pointTo = (JSON.parse(await marker.text()) as { key?: string }).key;
    } catch {
      pointTo = null;
    }
    if (!pointTo || pointTo === key) await env.PHOTOS.delete(markerKey);
  }
  invalidateManifest();

  return json({ ok: true, key }, 200);
}

/* ---------------- 老照片哈希回填 ----------------
 * 服务端只有处理后的成品，没有原文件，所以补的是「成品字节的 SHA-256」(bhash)。
 * 接口自验证：只接受与 R2 实际对象字节完全一致的 hash，任何人都无法伪造，
 * 因此不需要 token；同一张照片重复调用是幂等的。
 * 限流按 IP（与上传分开计数），防止被刷成 R2 读放大。 */
const backfillHits = new Map<string, number[]>();
function backfillLimited(ip: string): boolean {
  const now = Date.now();
  const list = (backfillHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (list.length >= 120) {
    backfillHits.set(ip, list);
    return true;
  }
  list.push(now);
  backfillHits.set(ip, list);
  return false;
}

async function handleBackfill(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (backfillLimited(ip)) return json({ error: "too many requests" }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "expected application/json" }, 400);
  }

  const key = String(body.key ?? "");
  if (!/^travel\/\d{2}-[^/]+\.(webp|jpe?g|png)$/i.test(key)) {
    return json({ error: "invalid photo key" }, 400);
  }
  const bhash = String(body.bhash ?? "").toLowerCase();
  if (!SHA_RE.test(bhash)) return json({ error: "invalid bhash" }, 400);

  const obj = await env.PHOTOS.get(key);
  if (!obj) return json({ error: "photo not found" }, 404);

  const actual = await sha256Hex(await obj.arrayBuffer());
  if (actual !== bhash) return json({ error: "hash mismatch", actual }, 409);

  const metaKey = metaKeyFor(key);
  const metaObj = await env.PHOTOS.get(metaKey);
  let meta: Record<string, unknown> = {};
  if (metaObj) {
    try {
      meta = JSON.parse(await metaObj.text()) as Record<string, unknown>;
    } catch {
      meta = {};
    }
  }
  if (meta.bhash === bhash) {
    /* 已经回填过：仍确保指针存在（幂等） */
    await env.PHOTOS.put(HASH_PREFIX + bhash, JSON.stringify({
      key,
      trip: meta.trip ?? null,
      takenAt: meta.takenAt ?? null,
      url: meta.url ?? publicUrl(env, key),
    }), { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } });
    return json({ ok: true, key, bhash, unchanged: true }, 200);
  }

  await env.PHOTOS.put(metaKey, JSON.stringify({ ...meta, bhash }), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  await env.PHOTOS.put(HASH_PREFIX + bhash, JSON.stringify({
    key,
    trip: meta.trip ?? null,
    takenAt: meta.takenAt ?? null,
    url: meta.url ?? publicUrl(env, key),
  }), { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } });
  invalidateManifest();

  return json({ ok: true, key, bhash }, 200);
}

type GeoPlace = {
  ok: true;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  label: string;
  lat: number;
  lng: number;
  provider: "nominatim" | "photon";
};

/* Nominatim 要求 ≤1 req/s；同 isolate 内串行化，配合 R2 缓存 */
let geoChain: Promise<void> = Promise.resolve();
let geoLast = 0;

function geopace(): Promise<void> {
  const run = geoChain.then(async () => {
    const wait = 1100 - (Date.now() - geoLast);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    geoLast = Date.now();
  });
  geoChain = run.catch(() => {});
  return run;
}

async function fetchJson(url: string, ms = 9000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "alvin-luo.me travel upload (+https://alvin-luo.me)" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseNominatim(data: unknown, lat: number, lng: number): GeoPlace | null {
  const root = (data ?? {}) as Record<string, unknown>;
  const a = (root.address ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "string" ? v : "");
  const city =
    pick(a.city) ||
    pick(a.town) ||
    pick(a.village) ||
    pick(a.hamlet) ||
    pick(a.municipality) ||
    pick(a.county) ||
    pick(a.state);
  const region = pick(a.state) || pick(a.county) || pick(a.municipality);
  const country = pick(a.country).split(" / ")[0];
  const countryCode = pick(a.country_code).toUpperCase();
  const label = [city, country].filter(Boolean).join(", ");
  if (!label) return null;
  return { ok: true, city, region, country, countryCode, label, lat, lng, provider: "nominatim" };
}

function parsePhoton(data: unknown, lat: number, lng: number): GeoPlace | null {
  const root = (data ?? {}) as { features?: Array<{ properties?: Record<string, unknown> }> };
  const p = root.features?.[0]?.properties ?? {};
  const pick = (v: unknown) => (typeof v === "string" ? v : "");
  const city = pick(p.city) || pick(p.name) || pick(p.county) || pick(p.state);
  const region = pick(p.state) || pick(p.county);
  const country = pick(p.country);
  const countryCode = pick(p.countrycode).toUpperCase();
  const label = [city, country].filter(Boolean).join(", ");
  if (!label) return null;
  return { ok: true, city, region, country, countryCode, label, lat, lng, provider: "photon" };
}

/** 先 Nominatim（中文优先），失败再退 Photon */
async function lookupPlace(lat: number, lng: number): Promise<GeoPlace | null> {
  await geopace();
  const nominatim = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=zh,en&lat=${lat}&lon=${lng}`
  );
  if (nominatim) {
    const parsed = parseNominatim(nominatim, lat, lng);
    if (parsed) return parsed;
  }
  const photon = await fetchJson(
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`
  );
  return photon ? parsePhoton(photon, lat, lng) : null;
}

/** 反向地理编码 + R2 缓存（坐标先取 2 位小数，约 1km）。返回 null = 上游都失败 */
async function geocodeWithCache(env: Env, lat: number, lng: number): Promise<GeoPlace | null> {
  const lat2 = Math.round(lat * 100) / 100;
  const lng2 = Math.round(lng * 100) / 100;
  const key = `${GEO_PREFIX}${lat2},${lng2}.json`;

  const cached = await env.PHOTOS.get(key);
  if (cached) {
    const data = await cached.json().catch(() => null);
    if (data) return data as GeoPlace;
  }

  const out = await lookupPlace(lat2, lng2);
  if (!out) return null;

  await env.PHOTOS.put(key, JSON.stringify(out), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  return out;
}

async function handleGeocode(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return json({ error: "invalid coords" }, 400);
  }

  const out = await geocodeWithCache(env, lat, lng);
  if (!out) return json({ error: "geocode failed" }, 502);
  return json(out, 200, { "Cache-Control": "public, max-age=86400" });
}

function githubEnv(env: Env) {
  return {
    token: env.GITHUB_TOKEN || "",
    repo: env.GITHUB_REPO || "",
    workflow: env.GITHUB_WORKFLOW || "deploy.yml",
    ref: env.GITHUB_REF || "main",
  };
}

async function handlePublish(env: Env): Promise<Response> {
  const { token, repo, workflow, ref } = githubEnv(env);
  if (!token) return json({ error: "GITHUB_TOKEN secret is not set" }, 501);
  if (!repo) return json({ error: "GITHUB_REPO var is not set" }, 501);

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "travel-upload-worker",
      },
      body: JSON.stringify({ ref }),
    }
  );

  if (res.status !== 204) {
    const body = (await res.text()).slice(0, 300);
    return json({ error: `GitHub dispatch failed (${res.status})`, detail: body }, 502);
  }
  return json({ ok: true, dispatched: true, workflow, ref }, 202);
}

async function handleStatus(env: Env): Promise<Response> {
  const { token, repo, workflow } = githubEnv(env);
  if (!token) return json({ error: "GITHUB_TOKEN secret is not set" }, 501);
  if (!repo) return json({ error: "GITHUB_REPO var is not set" }, 501);

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "travel-upload-worker",
      },
    }
  );
  if (!res.ok) return json({ error: `GitHub API ${res.status}` }, 502);

  const data = (await res.json()) as {
    workflow_runs?: Array<{
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
      updated_at: string;
    }>;
  };
  const run = data.workflow_runs?.[0];
  if (!run) return json({ state: "none" }, 200);
  return json(
    {
      state: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    },
    200
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const withCors = (res: Response) => {
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    };

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        /* 诊断口（geocode/probe/photon）会打上游第三方服务，必须带 token：
           否则任何人都能刷 /health 让 Worker 出口 IP 被 Nominatim 限流。
           geocode=1 走 R2 缓存（固定坐标只有首次会真正请求上游）。 */
        const diagnostics = url.searchParams.get("geocode") || url.searchParams.get("photon");
        if (diagnostics && !authorized(request, env)) {
          return withCors(json({ error: "unauthorized" }, 401));
        }

        if (url.searchParams.get("geocode") === "1") {
          const sample = await geocodeWithCache(env, 63.419, -19.006);
          return withCors(
            json(
              {
                ok: true,
                geocode: sample
                  ? {
                      status: 200,
                      provider: sample.provider,
                      city: sample.city,
                      country: sample.country,
                      countryCode: sample.countryCode,
                      label: sample.label,
                    }
                  : { status: "failed" },
              },
              200
            )
          );
        }

        if (url.searchParams.get("geocode") === "probe") {
          const probes: Record<string, string> = {
            photon: "https://photon.komoot.io/reverse?lat=63.419&lon=-19.006&lang=en",
            nominatim:
              "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=63.419&lon=-19.006&accept-language=en",
            bdc: "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=63.419&longitude=-19.006&localityLanguage=en",
            wiki: "https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=63.419%7C-19.006&gsradius=10000&gslimit=3&format=json",
            overpass:
              "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bnode%28around%3A5000%2C63.419%2C-19.006%29%5Bplace~%22city%7Ctown%7Cvillage%22%5D%3Bout%201%3B",
          };
          const out: Record<string, string | number> = {};
          await Promise.all(
            Object.entries(probes).map(async ([key, target]) => {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 8000);
              try {
                const r = await fetch(target, {
                  headers: { "User-Agent": "alvin-luo.me travel upload (contact@alvin-luo.me)" },
                  signal: ctrl.signal,
                });
                out[key] = r.status;
              } catch {
                out[key] = "error";
              } finally {
                clearTimeout(timer);
              }
            })
          );
          return withCors(json({ ok: true, probe: out }, 200));
        }

        let photon: number | string | undefined;
        if (diagnostics === "1" && url.searchParams.get("photon") === "1") {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 8000);
          try {
            const r = await fetch(
              "https://photon.komoot.io/reverse?lat=63.419&lon=-19.006&lang=en",
              { headers: { "User-Agent": "alvin-luo.me travel upload" }, signal: ctrl.signal }
            );
            photon = r.status;
          } catch {
            photon = "error";
          } finally {
            clearTimeout(timer);
          }
        }
        return withCors(
          json(
            {
              ok: true,
              service: "travel-upload",
              github: { configured: Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO) },
              ...(photon !== undefined ? { photon } : {}),
            },
            200
          )
        );
      }

      if (url.pathname === "/manifest" && request.method === "GET") {
        return withCors(await handleManifest(env));
      }

      if (url.pathname === "/trip" && request.method === "POST") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handleTrip(request, env));
      }

      if (url.pathname === "/base" && request.method === "GET") {
        return withCors(await handleBase(request, env));
      }

      if (url.pathname === "/base" && request.method === "POST") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handleBase(request, env));
      }

      if (url.pathname === "/geocode" && request.method === "GET") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handleGeocode(request, env));
      }

      if (url.pathname === "/photo" && request.method === "PATCH") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handlePhotoPatch(request, env));
      }

      if (url.pathname === "/photo" && request.method === "DELETE") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handlePhotoDelete(request, env));
      }

      if (url.pathname === "/upload" && request.method === "POST") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handleUpload(request, env));
      }

      if (url.pathname === "/backfill" && request.method === "POST") {
        /* 自验证接口：只接受与 R2 对象字节一致的 hash，因此不要求 token */
        return withCors(await handleBackfill(request, env));
      }

      if (url.pathname === "/publish" && request.method === "POST") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handlePublish(env));
      }

      if (url.pathname === "/status" && request.method === "GET") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handleStatus(env));
      }

      return withCors(json({ error: "not found" }, 404));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return withCors(json({ error: "internal", detail: message.slice(0, 300) }, 500));
    }
  },
};


