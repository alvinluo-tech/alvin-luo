"use client";

import { useEffect } from "react";

/* 图片灯箱：点击 .prose 里的图片全屏放大（Esc / 点击空白关闭） */
export default function Lightbox() {
  useEffect(() => {
    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    let open = false;
    /* 打开时才注入 <img>：常驻的 src="" 空图会以当前页 URL 发起一次无效请求 */
    const show = (src: string, alt: string) => {
      overlay.innerHTML = `<img alt="" src="${src.replace(/"/g, "&quot;")}" />`;
      const img = overlay.querySelector("img")!;
      img.alt = alt;
      overlay.classList.add("is-open");
      document.documentElement.style.overflow = "hidden";
      open = true;
    };
    const hide = () => {
      overlay.classList.remove("is-open");
      overlay.querySelector("img")?.remove();
      document.documentElement.style.overflow = "";
      open = false;
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLImageElement && t.closest(".prose")) {
        e.preventDefault();
        show(t.src, t.alt);
      } else if (open) {
        hide();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) hide();
    };

    document.body.appendChild(overlay);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      document.documentElement.style.overflow = "";
    };
  }, []);

  return null;
}
