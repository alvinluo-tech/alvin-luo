"use client";

/**
 * 旅行照片灯箱：点击归档卡片 / 缩略图后全屏放大。
 * 支持多图切换、滚轮/双击/按钮缩放、拖动平移、双指捏合、
 * 键盘（← → Esc + - 0）、触屏滑动、焦点陷阱与滚动锁定。
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./TravelLightbox.css";

export type LightboxPhoto = {
  url: string;
  takenAt?: string;
  caption?: string;
};

type Props = {
  photos: LightboxPhoto[];
  startIndex: number;
  title: string;
  subtitle?: string;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;

/** 取 ISO 里的当地日期时间，不换算时区 */
function stamp(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (m) return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("zh-CN") : "";
}

export default function TravelLightbox({ photos, startIndex, title, subtitle, onClose }: Props) {
  const safeStart = Math.max(0, Math.min(startIndex, photos.length - 1));
  const [index, setIndex] = useState(safeStart);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { type: "drag"; startX: number; startY: number; ox: number; oy: number; moved: boolean }
    | { type: "pinch"; dist: number; scale: number; cx: number; cy: number }
    | { type: "swipe"; startX: number; startY: number; moved: boolean }
    | null
  >(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + delta)));
    },
    [photos.length]
  );

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return { x, y };
    const maxX = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const commit = useCallback((nextScale: number, nextOffset: { x: number; y: number }) => {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
  }, []);

  /** 缩放；给了 clientX/Y 就以光标为中心，否则以画面中心 */
  const applyScale = useCallback(
    (nextRaw: number, clientX?: number, clientY?: number) => {
      const prev = scaleRef.current;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextRaw));
      if (Math.abs(next - prev) < 0.001) return;
      if (next === 1) {
        commit(1, { x: 0, y: 0 });
        return;
      }

      let x = offsetRef.current.x;
      let y = offsetRef.current.y;
      if (clientX !== undefined && clientY !== undefined && stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;
        const k = next / prev;
        x = cx - (cx - x) * k;
        y = cy - (cy - y) * k;
      } else {
        const k = next / prev;
        x *= k;
        y *= k;
      }
      commit(next, clampOffset(x, y, next));
    },
    [clampOffset, commit]
  );

  const resetZoom = useCallback(() => commit(1, { x: 0, y: 0 }), [commit]);

  /* 打开：锁滚动 / 焦点 */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, []);

  /* 键盘 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        applyScale(scaleRef.current * 1.35);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        applyScale(scaleRef.current / 1.35);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }
      if (e.key !== "Tab") return;

      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes?.length) return;
      const list = Array.from(nodes);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [applyScale, go, onClose, resetZoom]);

  /* 切图：重置缩放、加载态 */
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    commit(1, { x: 0, y: 0 });
  }, [index, commit]);

  /* 滚轮缩放 */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0016);
      applyScale(scaleRef.current * factor, e.clientX, e.clientY);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [applyScale]);

  /* 预取相邻两张 */
  useEffect(() => {
    for (const i of [index - 1, index + 1]) {
      const p = photos[i];
      if (p) {
        const img = new Image();
        img.src = p.url;
      }
    }
  }, [index, photos]);

  if (!photos.length) return null;
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    stageRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      gesture.current = {
        type: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: scaleRef.current,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      setGesturing(true);
      return;
    }

    if (scaleRef.current > 1) {
      gesture.current = {
        type: "drag",
        startX: e.clientX,
        startY: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
        moved: false,
      };
      setGesturing(true);
    } else {
      gesture.current = { type: "swipe", startX: e.clientX, startY: e.clientY, moved: false };
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.type === "pinch" && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      applyScale(g.scale * (dist / g.dist), g.cx, g.cy);
      return;
    }

    if (g.type === "drag") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) g.moved = true;
      const next = clampOffset(g.ox + dx, g.oy + dy, scaleRef.current);
      commit(scaleRef.current, next);
      return;
    }

    if (g.type === "swipe" && Math.abs(e.clientX - g.startX) > 8) g.moved = true;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (stageRef.current?.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }

    if (g?.type === "swipe" || g?.type === "drag") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const now = Date.now();

      if (!g.moved) {
        // 双击 / 双指轻点：在 1× 与 2.5× 之间切换
        const prevTap = lastTap.current;
        if (
          prevTap &&
          now - prevTap.t < 320 &&
          Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 28
        ) {
          applyScale(scaleRef.current > 1 ? 1 : 2.5, e.clientX, e.clientY);
          lastTap.current = null;
        } else {
          lastTap.current = { t: now, x: e.clientX, y: e.clientY };
        }
      } else if (g.type === "swipe" && scaleRef.current === 1 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
        go(dx > 0 ? -1 : 1);
      }
    }

    if (pointers.current.size === 0) {
      gesture.current = null;
      setGesturing(false);
    } else if (pointers.current.size === 1) {
      const p = Array.from(pointers.current.values())[0];
      gesture.current =
        scaleRef.current > 1
          ? {
              type: "drag",
              startX: p.x,
              startY: p.y,
              ox: offsetRef.current.x,
              oy: offsetRef.current.y,
              moved: false,
            }
          : null;
      setGesturing(false);
    }
  }

  return (
    <div
      className="tl-backdrop"
      data-lenis-prevent
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tl-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 的旅行照片`}
        ref={dialogRef}
      >
        <header className="tl-bar">
          <div className="tl-meta">
            <b>{title}</b>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>

          <div className="tl-zoom" role="group" aria-label="缩放">
            <button
              type="button"
              onClick={() => applyScale(scale / 1.35)}
              disabled={scale <= 1}
              aria-label="缩小"
            >
              −
            </button>
            <span aria-live="polite">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => applyScale(scale * 1.35)}
              disabled={scale >= MAX_SCALE}
              aria-label="放大"
            >
              ＋
            </button>
          </div>

          <span className="tl-counter" aria-live="polite">
            {index + 1} / {photos.length}
          </span>
          <button ref={closeRef} type="button" className="tl-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div
          className={`tl-stage${scale > 1 ? " is-zoomed" : ""}${gesturing ? " is-gesturing" : ""}`}
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="滚轮 / 双击放大，拖动平移"
        >
          {lastLoaded && lastLoaded !== photo.url && !failed ? (
            /* 上一张作为模糊底，切图时不出现纯黑/空白 */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="tl-ghost" src={lastLoaded} alt="" aria-hidden="true" />
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            key={photo.url}
            src={photo.url}
            alt={`${title} 旅行照片 ${index + 1}`}
            className={`tl-image${loaded ? " is-loaded" : ""}`}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transition: gesturing ? "none" : undefined,
            }}
            onLoad={() => {
              setLoaded(true);
              setFailed(false);
              setLastLoaded(photo.url);
            }}
            onError={() => {
              setLoaded(true);
              setFailed(true);
            }}
            draggable={false}
          />

          {!loaded ? <span className="tl-spinner" aria-label="加载中" /> : null}

          {failed ? (
            <p className="tl-error">
              这张图加载失败
              <a href={photo.url} target="_blank" rel="noreferrer">
                在新标签打开
              </a>
            </p>
          ) : null}

          {hasPrev ? (
            <button type="button" className="tl-nav is-prev" onClick={() => go(-1)} aria-label="上一张">
              ‹
            </button>
          ) : null}

          {hasNext ? (
            <button type="button" className="tl-nav is-next" onClick={() => go(1)} aria-label="下一张">
              ›
            </button>
          ) : null}
        </div>

        <footer className="tl-caption">
          {photo.caption ? <p>{photo.caption}</p> : null}
          {photo.takenAt ? (
            <time dateTime={photo.takenAt}>{stamp(photo.takenAt)}</time>
          ) : (
            <span className="tl-caption-empty">{title}</span>
          )}
          <span className="tl-hint">滚轮 / 双击缩放 · 拖动平移</span>
        </footer>
      </div>
    </div>
  );
}

