"use client";

import { useEffect, useState } from "react";
import { playClick, setSfxEnabled, sfxEnabled } from "@/lib/sfx";

/* 微音效开关：默认静音，开启后主题切换/⌘K 会有机械咔哒声 */
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
      className={on ? "sfx-toggle is-on" : "sfx-toggle"}
      onClick={toggle}
      aria-label={on ? "关闭音效" : "开启微音效"}
      title={on ? "SFX on" : "SFX muted"}
    >
      {on ? "♫" : "♪"}
    </button>
  );
}
