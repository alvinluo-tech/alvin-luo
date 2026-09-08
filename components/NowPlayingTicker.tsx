"use client";

/* 导航迷你 Now Playing：一进站就能看到“这人此刻在听什么”。
   与 MusicBand 共用 lib/music 的 60s 模块缓存，不产生额外网络请求；
   没在播放时整个组件不渲染，导航保持干净。
   点击 → 平滑滚到音乐瓷砖（#now-playing）；其他页面先跳回首页再滚。 */
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMusic, isMusicConfigured } from "@/lib/music";

export default function NowPlayingTicker() {
  const [song, setSong] = useState<{ name: string; artist?: string } | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const clipRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isMusicConfigured()) return;
    let alive = true;
    const load = async () => {
      const np = await getMusic<{
        playing: boolean;
        name?: string;
        artist?: string;
      }>("/api/now-playing");
      if (alive) setSong(np?.playing && np.name ? { name: np.name, artist: np.artist } : null);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* 长歌名 → 无缝跑马灯；短歌名 → 原地展示 */
  useEffect(() => {
    const el = clipRef.current;
    if (el) setOverflowing(el.scrollWidth > el.clientWidth + 2);
  }, [song]);

  if (!song) return null;

  const text = `${song.name}${song.artist ? ` — ${song.artist}` : ""}`;

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") {
      // 其他页面：先 SPA 跳回首页，浏览器再按 hash 滚到音乐瓷砖
      e.preventDefault();
      router.push("/#now-playing");
    }
    // 首页交由 SmoothScroll 的全局锚点接管（lenis 平滑滚动）
  };

  return (
    <a
      className="nav-np"
      href="#now-playing"
      onClick={onClick}
      title={`正在听：${text}`}
      aria-label={`正在播放 ${text}，点击跳到音乐区`}
    >
      <span className="nav-np-dot" aria-hidden="true" />
      <span className="nav-np-clip" ref={clipRef}>
        {overflowing ? (
          <span className="nav-np-scroll">
            <span>{text}&nbsp;&nbsp;✦&nbsp;&nbsp;</span>
            <span aria-hidden="true">{text}&nbsp;&nbsp;✦&nbsp;&nbsp;</span>
          </span>
        ) : (
          text
        )}
      </span>
    </a>
  );
}
