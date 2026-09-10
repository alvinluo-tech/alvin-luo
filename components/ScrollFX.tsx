"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* 滚动与指针驱动的动效：
   1. hero 滚动视差 —— 把进度写进 .hero 的 --p（0~1），位移全部由 CSS calc 完成
   2. bento 瓷砖 3D 倾斜 —— 指针位置写入每块瓷砖的 --rx / --ry
   依赖 pathname：layout 层组件不重挂载，SPA 换页后要重新抓取 .hero / .tile */
export default function ScrollFX() {
  const pathname = usePathname();

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".hero");

    /* ---- 视差 ---- */
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!hero) return;
      const p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      hero.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---- 瓷砖倾斜（仅精确指针） ---- */
    const cleanups: Array<() => void> = [];
    if (matchMedia("(pointer: fine)").matches) {
      for (const tile of Array.from(document.querySelectorAll<HTMLElement>(".tile"))) {
        const move = (e: PointerEvent) => {
          const r = tile.getBoundingClientRect();
          const rx = ((e.clientY - r.top) / r.height - 0.5) * -3.5;
          const ry = ((e.clientX - r.left) / r.width - 0.5) * 4.5;
          tile.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
          tile.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
          tile.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(1)}px`);
          tile.style.setProperty("--my", `${(e.clientY - r.top).toFixed(1)}px`);
        };
        const leave = () => {
          tile.style.setProperty("--rx", "0deg");
          tile.style.setProperty("--ry", "0deg");
        };
        tile.addEventListener("pointermove", move);
        tile.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          tile.removeEventListener("pointermove", move);
          tile.removeEventListener("pointerleave", leave);
        });
      }
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      cleanups.forEach((fn) => fn());
    };
  }, [pathname]);

  return null;
}
