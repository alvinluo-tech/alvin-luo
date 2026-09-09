"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* 滚动淡入：带 data-reveal 的元素或 bento 瓷砖进入视口后加 .is-in。
   依赖 pathname：本组件挂在 layout 层不会重挂载，
   SPA 换页后新 DOM 必须重新观察，否则内容停留隐身态。

   关键设计（防“区域一片空白”）：
   - CSS 默认可见；只有 JS 判定“在视口下方、还没滚到”的元素才加
     .reveal-pending 隐藏。弱网下 HTML 先到、JS 未水合的窗口里，
     用户滚到哪里都能直接看到内容，不会白屏等水合。
   - 已在视口内 / 视口上方的元素直接 is-in，不播放动画也不隐藏。
   - 不支持 IntersectionObserver 的环境全部直接可见。 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal], .bento-grid .tile"),
    );
    if (!("IntersectionObserver" in window)) return; // 默认可见，无需处理

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            e.target.classList.remove("reveal-pending");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 },
    );

    for (const el of els) {
      // 视口下方的元素才需要“滚到才出现”；视口内/上方直接可见
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add("reveal-pending");
        io.observe(el);
      } else {
        el.classList.add("is-in");
      }
    }
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
