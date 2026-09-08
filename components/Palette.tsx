"use client";

import { useEffect, useRef, useState } from "react";
import { GITHUB_URL } from "@/config/site";
import { playClick } from "@/lib/sfx";
import { useRouter } from "next/navigation";

type Item = {
  label: string;
  href: string;
  hint: string;
  external?: boolean;
  keywords?: string;
};

/* ⌘K / Ctrl+K 命令面板：站内跳转 + 博客全文检索。
   文章索引由 layout（服务端组件）构建时传入，客户端零读取开销 */
export default function Palette({ posts = [] }: { posts?: Item[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  const ITEMS: Item[] = [
    { label: "首页 — Home", href: "/", hint: "page" },
    { label: "作品 — Projects", href: "/#projects", hint: "section" },
    { label: "旅行 — Travel", href: "/travel", hint: "page" },
    { label: "现在 — Now", href: "/now", hint: "page" },
    { label: "博客 — Blog", href: "/blog", hint: "page" },
    {
      label: "GitHub ↗",
      href: GITHUB_URL,
      hint: "external",
      external: true,
    },
  ];
  const all: Item[] = [...ITEMS, ...posts];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) playClick(900);
          return !v;
        });
        setQuery("");
        setActive(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = all
    .filter((i) => `${i.label} ${i.keywords ?? ""}`.toLowerCase().includes(q))
    .slice(0, 12);

  const move = (dir: 1 | -1) => {
    if (!filtered.length) return;
    setActive((a) => (a + dir + filtered.length) % filtered.length);
  };

  useEffect(() => {
    // 键盘导航时保证高亮项可见
    listRef.current
      ?.querySelector(".is-active")
      ?.scrollIntoView({ block: "nearest" });
  }, [active, query]);

  /* 站内跳转走 router（SPA），外链走 <a> */
  const go = (item: Item) => {
    setOpen(false);
    if (item.external) return;
    router.push(item.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter" && filtered[active]) {
      go(filtered[active]);
    }
  };

  return open ? (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="搜索文章 / 跳转…（↑↓ 选择，Esc 关闭）"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKey}
        />
        <ul className="palette-list" ref={listRef}>
          {filtered.map((item, i) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={i === active ? "is-active" : undefined}
                onClick={(e) => {
                  if (!item.external) e.preventDefault();
                  go(item);
                }}
                target={item.external ? "_blank" : undefined}
                rel="noopener noreferrer"
                onMouseEnter={() => setActive(i)}
              >
                <span>{item.label}</span>
                <span className="palette-hint">{item.hint}</span>
              </a>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="palette-empty">没有匹配的结果</li>
          )}
        </ul>
      </div>
    </div>
  ) : null;
}
