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
const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MANIFEST = 5000;

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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

function keyFor(trip: string, takenAt: string): string {
  const d = Number.isFinite(Date.parse(takenAt)) ? new Date(takenAt) : new Date();
  const date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
  return `${PHOTO_PREFIX}${trip}-${date}-${randomSuffix()}.webp`;
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
  const takenAt = Number.isFinite(Date.parse(takenAtRaw))
    ? new Date(takenAtRaw).toISOString()
    : new Date().toISOString();

  const key = keyFor(trip, takenAt);
  await env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: CACHE_IMMUTABLE },
  });

  const w = Number(text(form.get("w"), 8)) || undefined;
  const h = Number(text(form.get("h"), 8)) || undefined;
  const caption = text(form.get("caption"), 300) || undefined;
  const cover = text(form.get("cover"), 3) === "1";

  const meta = {
    key,
    url: publicUrl(env, key),
    trip,
    takenAt,
    w,
    h,
    caption,
    cover,
    bytes: file.size,
    uploadedAt: new Date().toISOString(),
  };

  await env.PHOTOS.put(metaKeyFor(key), JSON.stringify(meta), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });

  return json(meta, 201);
}

async function listMetaKeys(env: Env): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PHOTOS.list({ prefix: META_PREFIX, limit: 1000, cursor });
    for (const obj of page.objects) keys.push(obj.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && keys.length < MAX_MANIFEST);
  return keys;
}

async function handleManifest(env: Env): Promise<Response> {
  const keys = await listMetaKeys(env);
  const photos: Record<string, unknown>[] = [];

  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    const rows = await Promise.all(
      chunk.map(async (key) => {
        const obj = await env.PHOTOS.get(key);
        if (!obj) return null;
        try {
          return JSON.parse(await obj.text());
        } catch {
          return null;
        }
      })
    );
    for (const row of rows) {
      if (row && typeof row.url === "string" && typeof row.trip === "string") photos.push(row);
    }
  }

  photos.sort((a, b) => {
    const ta = Date.parse(String(a.takenAt || ""));
    const tb = Date.parse(String(b.takenAt || ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return String(a.key).localeCompare(String(b.key));
  });

  return json(
    { count: photos.length, photos },
    200,
    { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" }
  );
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
  if (!token || !repo) return json({ error: "GitHub publish is not configured" }, 501);

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
  if (!token || !repo) return json({ error: "GitHub status is not configured" }, 501);

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
        return withCors(json({ ok: true, service: "travel-upload" }, 200));
      }

      if (url.pathname === "/manifest" && request.method === "GET") {
        return withCors(await handleManifest(env));
      }

      if (url.pathname === "/upload" && request.method === "POST") {
        if (!authorized(request, env)) return withCors(json({ error: "unauthorized" }, 401));
        return withCors(await handleUpload(request, env));
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
