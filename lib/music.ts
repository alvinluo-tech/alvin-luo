"use client";

/* ============================================================
 * 网易云音乐数据层（领域模块）
 *
 * 类型、领域函数、useMusic hook 都在这里：获取/轮询/缓存/降级
 * 的策略只有这一个落点，组件只消费。
 * 模块级 60s TTL 缓存 —— 多组件共享同一 Promise，不产生重复网络请求。
 * ============================================================ */

import { useEffect, useState } from "react";
import { NETEASE_API } from "@/config/site";

/* ---- 领域类型（组件从这里导入，不要各自内联） ---- */

export type NowPlaying = {
  playing: boolean;
  name?: string;
  artist?: string;
  album?: string;
  cover?: string;
  lyricLine?: string | null;
};

export type Song = {
  name: string;
  artist?: string;
  cover?: string;
  playCount?: number;
  reason?: string;
};

export type Playlist = { id: number; name: string; cover: string; trackCount: number };

export type MusicStats = {
  ok: boolean;
  level?: number | null;
  likedCount?: number | null;
  totalSongs?: number | null;
  totalMinutes?: number | null;
};

export type DailyPickSong = { name: string; artist?: string; reason?: string };

/* ---- 配置与缓存 ---- */

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

/* ---- 领域函数：调用方不再拼端点字符串 ---- */

export const getNowPlaying = () => getMusic<NowPlaying>("/api/now-playing");
export const getOnRepeat = () => getMusic<{ songs: Song[] }>("/api/on-repeat");
export const getPlaylists = () => getMusic<{ playlists: Playlist[] }>("/api/playlists");
export const getStats = () => getMusic<MusicStats>("/api/stats");
export const getDailyPicks = () => getMusic<{ songs: DailyPickSong[] }>("/api/daily-picks");

/* ---- useMusic：轮询订阅 hook ----
 * data: 最近一次成功数据（null = 还没拿到 / 接口挂了 / 未配置）
 * settled: 首次加载是否已结束（区分"加载中"和"加载完成但没有数据"）
 * refreshMs <= 0 表示只取一次不轮询 */

export function useMusic<T>(
  endpoint: string,
  refreshMs = 60_000,
): { data: T | null; settled: boolean } {
  const [state, setState] = useState<{ data: T | null; settled: boolean }>({
    data: null,
    settled: false,
  });

  useEffect(() => {
    if (!isMusicConfigured()) return;
    let alive = true;
    const load = async (force = false) => {
      if (!force && typeof document !== "undefined" && document.hidden) return;
      const d = await getMusic<T>(endpoint);
      if (alive) setState({ data: d, settled: true });
    };

    // 首次载入
    void load(true);

    // 标签页重新可见时立即刷新
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void load(true);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    let id: ReturnType<typeof setInterval> | null = null;
    if (refreshMs > 0 && Number.isFinite(refreshMs)) {
      id = setInterval(() => void load(false), refreshMs);
    }

    return () => {
      alive = false;
      if (id) clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [endpoint, refreshMs]);

  return state;
}
