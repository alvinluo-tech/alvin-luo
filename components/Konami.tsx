"use client";

/* ============================================================
 * Konami 彩蛋：↑↑↓↓←→←→BA
 *
 * 全站任何页面输入经典秘籍 → lime 纸屑雨 + 终端式 toast。
 * 设计约束：
 * · 纸屑是 DOM 粒子而非 canvas —— 一次性 60 个 span，2.4s 后整层移除，
 *   不与 Lenis/rAF 常驻动画抢帧
 * · prefers-reduced-motion 时不撒纸屑，只出 toast（彩蛋仍在，动效降级）
 * · 输入跟踪用小写化的 key 序列比对，方向键 + B A 都算
 * ============================================================ */

import { useEffect, useRef } from "react";
import { playClick } from "@/lib/sfx";

const CODE = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

export default function Konami() {
  const progress = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const expected = CODE[progress.current];
      progress.current = k === expected ? progress.current + 1 : k === CODE[0] ? 1 : 0;
      if (progress.current < CODE.length) return;
      progress.current = 0;
      fire();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

function fire() {
  if (document.querySelector(".konami-layer")) return; // 别叠加

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = document.createElement("div");
  layer.className = "konami-layer";
  layer.setAttribute("aria-hidden", "true");

  if (!reduced) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 64; i++) {
      const p = document.createElement("i");
      p.className = "konami-bit";
      p.style.left = Math.random() * 100 + "vw";
      /* 三种长度 × 随机时长/延迟/旋转，避免整齐划一像 bugs */
      p.style.setProperty("--kd", (0.9 + Math.random() * 1.1).toFixed(2) + "s");
      p.style.setProperty("--kdl", (Math.random() * 0.5).toFixed(2) + "s");
      p.style.setProperty("--kr", Math.round(Math.random() * 720 - 360) + "deg");
      p.style.height = 6 + Math.round(Math.random() * 8) + "px";
      frag.appendChild(p);
    }
    layer.appendChild(frag);
  }

  const toast = document.createElement("div");
  toast.className = "konami-toast";
  toast.textContent = "↑↑↓↓←→←→BA · 你找到了猫的键盘 🐾";
  layer.appendChild(toast);

  document.body.appendChild(layer);
  playClick(1200);
  setTimeout(() => playClick(1600), 120);
  setTimeout(() => layer.remove(), 2600);
}
