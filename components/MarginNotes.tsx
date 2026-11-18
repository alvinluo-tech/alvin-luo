"use client";

/* ============================================================
 * MarginNotes — 文章旁注（Tufte 式页边注）
 *
 * · 正文里的 {{note: …}} 在构建期变成上标胶囊 [1]，这里负责交互；
 * · 宽屏（≥1280px）：旁注列与正文并排，逐条对齐到引用所在行
 *   （绝对定位 + 碰撞避让，窗口尺寸/字体加载/内容高度变化时重排）；
 * · 窄屏：点击/回车胶囊弹出底部卡片，Esc 或点遮罩关闭；
 * · 纯装饰动效全部尊重 prefers-reduced-motion。
 * ============================================================ */

import { useEffect, useRef, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1280px)";

export default function MarginNotes({ notes }: { notes: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  /* 宽屏：把每条旁注对齐到对应上标胶囊的纵向位置 */
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const mq = window.matchMedia(DESKTOP_QUERY);
    let raf = 0;

    const layout = () => {
      if (!mq.matches) return;
      const asideTop = aside.getBoundingClientRect().top;
      const items = Array.from(aside.querySelectorAll<HTMLElement>(".mn-note"));
      let lastBottom = -Infinity;

      for (const el of items) {
        const n = el.dataset.mn;
        const ref = n ? document.getElementById(`mnr-${n}`) : null;
        if (!ref) continue;
        const refTop = ref.getBoundingClientRect().top - asideTop;
        // 与上标对齐；若与上一条撞车则下推，避免叠字
        const top = Math.max(refTop - 6, lastBottom + 14, 0);
        el.style.top = `${Math.round(top)}px`;
        lastBottom = top + el.offsetHeight;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(layout);
    };

    schedule();
    window.addEventListener("resize", schedule);
    // 字体加载完成后行高会变，重新对齐
    document.fonts?.ready.then(schedule).catch(() => {});

    // 正文高度变化（图片加载/折叠）也触发重排
    const article = document.querySelector<HTMLElement>(".post-layout article");
    const ro = article ? new ResizeObserver(schedule) : null;
    ro?.observe(article!);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [notes]);

  /* 上标点击 / 键盘激活 */
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".post-layout");
    if (!root) return;

    const open = (n: number) => {
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        // 宽屏：高亮对应页边注（不弹卡片，避免遮挡正文）
        const note = document.getElementById(`mnn-${n}`);
        if (!note) return;
        note.classList.add("is-active");
        window.setTimeout(() => note.classList.remove("is-active"), 1600);
        const r = note.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight) {
          note.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }
      setActive(n);
    };

    const onClick = (e: Event) => {
      const ref = (e.target as HTMLElement | null)?.closest?.(".mn-ref") as HTMLElement | null;
      if (!ref) return;
      e.preventDefault();
      const n = Number(ref.dataset.mn);
      if (n) open(n);
    };

    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el?.classList?.contains("mn-ref")) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const n = Number(el.dataset.mn);
      if (n) open(n);
    };

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
    };
  }, []);

  /* Esc 关闭底卡 */
  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (notes.length === 0) return null;

  return (
    <>
      <aside className="post-notes" ref={asideRef} aria-label="页边旁注">
        {notes.map((text, i) => {
          const n = i + 1;
          return (
            <div className="mn-note" key={n} id={`mnn-${n}`} data-mn={n}>
              <span className="mn-num">{n}</span>
              <span className="mn-text">{text}</span>
            </div>
          );
        })}
      </aside>

      {active !== null && (
        <div className="mn-sheet-wrap">
          <button
            type="button"
            className="mn-sheet-backdrop"
            aria-label="关闭旁注"
            onClick={() => setActive(null)}
          />
          <div className="mn-sheet" role="dialog" aria-modal="true" aria-label={`旁注 ${active}`}>
            <span className="mn-sheet-num">{active}</span>
            <p className="mn-sheet-text">{notes[active - 1]}</p>
            <button type="button" className="mn-sheet-close" onClick={() => setActive(null)} aria-label="关闭">
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
