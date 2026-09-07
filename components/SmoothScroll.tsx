"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

/* Lenis 惯性滚动：Lando 站同款丝滑手感。
   - 尊重 prefers-reduced-motion（不开）
   - 页内锚点（#work / #top、以及首页上的 /#work 形式）走 lenis.scrollTo */
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

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const raw = anchor.getAttribute("href") ?? "";
      // "#x" 或当前页的 "/#x"（Link 导航到同页 hash 不会触发整页滚动）
      const hash = raw.startsWith("#") ? raw : pathname === "/" && raw.startsWith("/#") ? raw.slice(1) : "";
      if (!hash || hash.length < 2) return;
      const el = document.querySelector(hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -70 });
    };
    document.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
