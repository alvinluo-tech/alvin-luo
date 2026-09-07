"use client";

import { useEffect } from "react";

/* 代码块一键复制：挂载后为 .prose 里每个 <pre> 注入复制按钮。
   剪贴板 API 不可用时回退 execCommand */
export default function CodeCopy() {
  useEffect(() => {
    const pres = Array.from(
      document.querySelectorAll<HTMLPreElement>(".prose pre"),
    );
    const cleanups: Array<() => void> = [];

    const copyText = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // 回退：临时 textarea + execCommand
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      }
    };

    for (const pre of pres) {
      if (pre.querySelector(".code-copy")) continue;
      pre.style.position = "relative";
      const btn = document.createElement("button");
      btn.className = "code-copy";
      btn.type = "button";
      btn.textContent = "复制";
      const onClick = async () => {
        const ok = await copyText(pre.innerText.replace(/^复制\n?/, ""));
        btn.textContent = ok ? "已复制 ✓" : "复制失败";
        setTimeout(() => (btn.textContent = "复制"), 1600);
      };
      btn.addEventListener("click", onClick);
      pre.appendChild(btn);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
