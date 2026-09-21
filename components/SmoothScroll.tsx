"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

/* Lenis 惯性滚动：Lando 站同款丝滑手感。
   - 尊重 prefers-reduced-motion（不开）
   - 页内锚点（#work / #top）走 lenis.scrollTo；
     跨页 "/#x" 链接（如 /room 的家具热点）不拦截——由 Next 完成导航，
     路由变化后 hash 若存在则用 lenis 平滑滚到目标（Lenis 会把原生
     smooth 行为关掉，必须自己接管） */
export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.12 });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const scrollToHash = (hash: string) => {
      const el = document.querySelector(hash);
      if (el) lenis.scrollTo(el as HTMLElement, { offset: -70 });
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const raw = anchor.getAttribute("href") ?? "";
      // 仅拦截"当前页能落地"的锚点："#x" 或同页的 "/#x"
      const hash = raw.startsWith("#") ? raw : pathname === "/" && raw.startsWith("/#") ? raw.slice(1) : "";
      if (!hash || hash.length < 2) return;
      const el = document.querySelector(hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -70 });
    };
    document.addEventListener("click", onClick);

    /* 跨页 hash 导航（router.push("/#projects")）：Next 滚动后 Lenis
       可能停在顶部——路由一变就把 hash 目标滚进来。
       60ms 先试一次，450ms 兜底一次（SPA 首帧布局时序不稳） */
    if (window.location.hash.length > 1) {
      const t1 = window.setTimeout(() => scrollToHash(window.location.hash), 60);
      const t2 = window.setTimeout(() => scrollToHash(window.location.hash), 450);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        cancelAnimationFrame(raf);
        document.removeEventListener("click", onClick);
        lenis.destroy();
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
