#!/usr/bin/env node
/* 老照片回填：给没有 bhash 的照片补「成品字节 SHA-256」。
 *
 * 背景：2026-11-19 之前上传的照片只有成品 WebP，没有原文件，无法算原文件 hash。
 * 但同一台手机/同一浏览器重选同一张照片时，重新编码出的成品字节是一致的，
 * 所以回填成品 hash 后，重传这些老照片也能被查重命中。
 *
 * 接口 /backfill 是自验证的：服务端会重新计算 R2 对象的 SHA-256，
 * 只有一致才写入，因此不需要 token，任何人调用都无法伪造。
 *
 * 用法：
 *   node scripts/backfill-bhash.mjs                     # 回填线上全部缺 bhash 的照片
 *   node scripts/backfill-bhash.mjs --dry               # 只统计，不写入
 *   node scripts/backfill-bhash.mjs --api http://127.0.0.1:8791 --manifest http://127.0.0.1:8791/manifest
 */
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const API = arg("--api", "https://upload.alvin-luo.me").replace(/\/+$/, "");
const MANIFEST = arg("--manifest", `${API}/manifest`);
const DRY = args.includes("--dry");
const CONCURRENCY = Number(arg("--concurrency", "4"));

async function getJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw err;
      await new Promise((r) => setTimeout(r, i * 1500));
    }
  }
}

async function getBytes(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i === tries) throw err;
      await new Promise((r) => setTimeout(r, i * 1500));
    }
  }
}

async function backfillOne(photo) {
  const bytes = await getBytes(photo.url);
  const bhash = createHash("sha256").update(bytes).digest("hex");
  if (DRY) return { key: photo.key, bhash, status: "dry" };
  const res = await fetch(`${API}/backfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: photo.key, bhash }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => ({}));
  return { key: photo.key, bhash, status: res.status, data };
}

(async () => {
  const manifest = await getJson(MANIFEST);
  const photos = (manifest.photos || []).filter((p) => p.url && p.key);
  const todo = photos.filter((p) => !p.bhash);
  console.log(`manifest: ${photos.length} 张，缺 bhash: ${todo.length} 张${DRY ? "（dry-run）" : ""}`);
  if (!todo.length) return;

  let ok = 0;
  let failed = 0;
  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const photo = queue.shift();
      try {
        const r = await backfillOne(photo);
        ok += 1;
        console.log(`  ✓ ${r.key}  ${r.bhash.slice(0, 10)}…  ${r.status}`);
      } catch (err) {
        failed += 1;
        console.log(`  ✗ ${photo.key}  ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  console.log(`\n完成：${ok} 成功 / ${failed} 失败${DRY ? "（未写入）" : ""}`);
  if (failed) process.exitCode = 1;
})();
