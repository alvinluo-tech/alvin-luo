"use client";

/**
 * 旅行照片灯箱：点击归档卡片 / 缩略图后全屏放大。
 * 支持多图切换、键盘（← → Esc）、触屏左右滑、焦点陷阱与滚动锁定。
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + delta)));
    },
    [photos.length]
  );

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [go, onClose]);

  useEffect(() => {
    setLoaded(false);
  }, [index]);

  // 预取相邻两张，切换时不再白屏
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

  return (
    <div
      className="tl-backdrop"
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
          <span className="tl-counter" aria-live="polite">
            {index + 1} / {photos.length}
          </span>
          <button ref={closeRef} type="button" className="tl-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div
          className="tl-stage"
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < 50) return;
            go(dx > 0 ? -1 : 1);
          }}
        >
          {hasPrev ? (
            <button type="button" className="tl-nav is-prev" onClick={() => go(-1)} aria-label="上一张">
              ‹
            </button>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.url}
            src={photo.url}
            alt={`${title} 旅行照片 ${index + 1}`}
            className={loaded ? "is-loaded" : ""}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            draggable={false}
          />

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
        </footer>
      </div>
    </div>
  );
}
