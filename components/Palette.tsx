"use client";

import { useEffect, useRef, useState } from "react";
import { GITHUB_URL } from "@/config/site";
import { playClick } from "@/lib/sfx";
import { useRouter } from "next/navigation";

/* ⌘K / Ctrl+K 命令面板：站内跳转（SPA 无刷新）+ 过滤 */
const ITEMS = [
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

export default function Palette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) playClick(900);
          return !v;
        });
        setQuery("");
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = ITEMS.filter((i) =>
    i.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  /* 站内跳转走 router（SPA），外链走 <a> */
  const go = (href: string, external?: boolean) => {
    setOpen(false);
    if (external) return;
    router.push(href);
  };

  return open ? (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="跳转到…（Esc 关闭）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              go(filtered[0].href, filtered[0].external);
            }
          }}
        />
        <ul className="palette-list">
          {filtered.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={(e) => {
                  if (!item.external) e.preventDefault();
                  go(item.href, item.external);
                }}
                target={item.external ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                <span>{item.label}</span>
                <span className="palette-hint">{item.hint}</span>
              </a>
            </li>
          ))}
          {filtered.length === 0 && <li className="palette-empty">没有匹配的结果</li>}
        </ul>
      </div>
    </div>
  ) : null;
}
