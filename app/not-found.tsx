"use client";

/* ============================================================
 * 404 —— 「房间断电」
 *
 * 原有 X-ray 文案保留，叠加一层可玩的空间感：
 * · 手电筒：鼠标移动处是唯一透光的洞（radial-gradient 遮罩）
 * · 黑暗里的猫眼：两粒 lime 光点，只在暗处可见，缓慢眨
 * · 触屏没有 mousemove —— 遮罩退化为静态 vignette，猫眼居中常亮
 * · reduced-motion：不眨眼
 * ============================================================ */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { T } from "@/components/i18n";

export default function NotFound() {
  const darkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = darkRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      el.style.setProperty("--fx", e.clientX + "px");
      el.style.setProperty("--fy", e.clientY + "px");
      el.classList.add("has-pointer");
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <main className="nf">
      {/* 断电层：默认静态 vignette，鼠标进入后变成跟随的手电筒 */}
      <div className="nf-dark" ref={darkRef} aria-hidden="true">
        <span className="nf-eyes">
          <i />
          <i />
        </span>
      </div>

      <p className="eyebrow nf-z">404 — PAGE NOT FOUND</p>
      <h1 className="nf-title nf-z">
        <T
          en={
            <>
              This page got
              <br />
              <em className="abs">X-RAYed</em> through.
            </>
          }
          zh={
            <>
              这一页被
              <br />
              <em className="abs">透视</em>穿了。
            </>
          }
        />
      </h1>
      <p className="nf-sub nf-z">
        <T
          en={
            <>
              The lights are out — the cat knows where it went.
              <br />
              Maybe it&apos;s at the gym, maybe on the next flight out.
            </>
          }
          zh={
            <>
              房间断电了——猫知道它去哪了。
              <br />
              也许它正在健身房，也许在下一站旅行里。
            </>
          }
        />
      </p>
      <div className="nf-links nf-z">
        <Link className="btn btn-primary" href="/">
          <T en="Back home ↑" zh="回首页 ↑" />
        </Link>
        <Link className="btn" href="/room">
          <T en="Find the cat 🐾" zh="去找猫 🐾" />
        </Link>
      </div>
      <span className="nf-ghost nf-z" aria-hidden="true">
        404
      </span>
    </main>
  );
}
