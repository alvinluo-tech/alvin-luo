"use client";

import { useEffect, useState } from "react";
import { playClick, setSfxEnabled, sfxEnabled } from "@/lib/sfx";

/* 微音效开关：默认静音，开启后主题切换/⌘K 会有机械咔哒声。
   视觉与主题按钮同族（胶囊 + 线性图标）：静音 = 喇叭加斜杠，
   开启 = 喇叭带声波 + 荧光绿底（全站“激活 = lime”语言） */
export default function SfxToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(sfxEnabled());
  }, []);

  const toggle = () => {
    const next = !on;
    setSfxEnabled(next);
    setOn(next);
    if (next) playClick(2200);
  };

  return (
    <button
      type="button"
      className={on ? "sfx-toggle is-on" : "sfx-toggle"}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "关闭音效" : "开启微音效"}
      title={on ? "SFX on" : "SFX muted"}
    >
      {on ? (
        /* 声波喇叭 */
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.5 4.5 6.8 8.5H3.8v7h3l4.7 4V4.5Z" />
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
          <path d="M18.4 6.4a8.2 8.2 0 0 1 0 11.2" />
        </svg>
      ) : (
        /* 静音喇叭 */
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.5 4.5 6.8 8.5H3.8v7h3l4.7 4V4.5Z" />
          <path d="m16 9.8 4.4 4.4M20.4 9.8 16 14.2" />
        </svg>
      )}
    </button>
  );
}
