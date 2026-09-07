"use client";

import { useEffect, useState } from "react";

type Item = { id: string; text: string; depth: number };

/* 长文浮动目录：滚动时高亮当前章节（IntersectionObserver） */
export default function Toc({ items }: { items: Item[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const { id } of items) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <nav className="toc" aria-label="目录">
      <p className="toc-title">目录</p>
      <ul>
        {items.map((t) => (
          <li key={t.id} className={t.depth === 3 ? "is-sub" : ""}>
            <a href={`#${t.id}`} className={t.id === active ? "is-active" : ""}>
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
