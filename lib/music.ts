"use client";

/* 网易云音乐数据获取：模块级缓存（60 秒 TTL），
   多个组件共用同一份 Promise，避免重复请求 */

import { NETEASE_API } from "@/config/site";

export function isMusicConfigured() {
  return Boolean(NETEASE_API.base && NETEASE_API.key);
}

const TTL = 60_000;
const cache = new Map<string, { ts: number; data: unknown }>();

export async function getMusic<T = unknown>(endpoint: string): Promise<T | null> {
  if (!isMusicConfigured()) return null;
  const hit = cache.get(endpoint);
  if (hit && Date.now() - hit.ts < TTL) return hit.data as T;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${NETEASE_API.base}${endpoint}?key=${NETEASE_API.key}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = (await r.json()) as T;
    cache.set(endpoint, { ts: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}
