"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* 滚动淡入：观察到带 data-reveal 的元素或 bento 瓷砖进入视口后加 .is-in
   （配合 globals.css 里的过渡样式）。
   依赖 pathname：本组件挂在 layout 层不会重挂载，
   SPA 换页后新 DOM 必须重新观察，否则瓷砖停留在 opacity: 0 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll("[data-reveal], .bento-grid .tile"),
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
