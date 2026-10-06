"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import LangToggle from "./LangToggle";
import SfxToggle from "./SfxToggle";
import NowPlayingTicker from "./NowPlayingTicker";

/* 导航：滚动后变为半透明毛玻璃条。
   站内链接全部走 <Link>（SPA 无刷新切换），外链保持 <a> */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={scrolled ? "nav is-scrolled" : "nav"}>
      {/* TODO: 需要的话可换成自己的 logo 图形 */}
      <Link className="nav-logo" href="/">
        alvin<span className="accent">.luo</span>
      </Link>
      {/* 迷你 Now Playing：在播才出现，点击滚到音乐瓷砖 */}
      <NowPlayingTicker />
      <nav className="nav-links">
        {/* 导航只放 bento 里没有的页面 —— Room/Travel/GitHub 在首页 bento
            有大瓷砖（tile-room / tile-travel / tile-gh），导航里是重复挂号 */}
        <Link href="/#projects">Work</Link>
        <Link href="/resume">CV</Link>
        <Link href="/year">Year</Link>
        <Link href="/blog">Writing</Link>
      </nav>
      <div className="nav-tools">
        <LangToggle />
        <button
          className="palette-trigger"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          aria-label="打开命令面板"
          title="命令面板 (⌘K)"
        >
          ⌘K
        </button>
        <SfxToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
