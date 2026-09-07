"use client";

import { useEffect } from "react";

/* 滚动淡入：观察到带 data-reveal 的元素或 bento 瓷砖进入视口后加 .is-in
   （配合 globals.css 里的过渡样式） */
export default function ScrollReveal() {
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
  }, []);

  return null;
}
