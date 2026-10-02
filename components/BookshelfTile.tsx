"use client";

/* ============================================================
 * BookshelfTile — 首页「精神食粮」书架
 *
 * 数据在 data/books.ts（与 /year 年度报告书架卡共用）。
 *
 * 设计要点：
 * · 书脊有高低 / 宽窄 / 倾角差异 —— 等高同宽会读成柱状图，不像实物
 * · 「在读」那本固定在第一个位置：五本等重时视线没有落点，主位就是入口
 * · 悬停卡分三级：作者元数据（次）→ 批注（主）→ 星级（脚注）
 * · 悬停预览 + 点击常驻：触屏没有 hover，只靠 :hover 会让批注永远读不到
 * · 书脊文字颜色按对比度自动择优，中调色书脊不再低于 WCAG AA
 * · 字号按标题长度反推，长标题不会被 overflow 静默裁掉
 * · 触屏有「点一下」提示：光有 tap 能力不够，得让人知道能点
 * · 点击是「抽出一本看看」的预览，不是导航：卡片要能随手关掉
 *   （点外部 / Esc / 再点同一本），否则会一直挂在屏幕上
 * ============================================================ */

import { useEffect, useState } from "react";
import { BOOKS } from "@/data/books";
import { T } from "./i18n";

/* 每排最多几本，超出换到下一层搁板（而不是把书挤细） */
const ROW_SIZE = 6;

/* 书脊轮廓：高度 / 宽度 / 倾角。已按高度降序排列 —— 最长的标题会拿到
   第一个（最高最宽），见 profileOf 的分配逻辑 */
const PROFILES = [
  { h: 182, w: 34, lean: -1.2 },
  { h: 176, w: 30, lean: 0.8 },
  { h: 172, w: 40, lean: -0.8 },
  { h: 168, w: 28, lean: 1.2 },
  { h: 162, w: 36, lean: 0 },
  { h: 158, w: 26, lean: -1.4 },
];

/* 书脊内文字可用的高度（减去上下留白） */
const TITLE_INSET = 22;
/* 字号上下限：低于 0.62rem 竖排中文难辨认，高于 0.82rem 短标题会撑破书脊 */
const FS_MIN = 9.6;
const FS_MAX = 13.1;
/* 安全余量：系数是估算值，留 6% 避免真实字体度量偏大时又被截断 */
const SAFETY = 0.94;

/**
 * 竖排文字里 CJK 占满一个字高，拉丁字母约 0.55 —— 再加上
 * CSS 里的 letter-spacing 0.06em，两者都要计入，否则会低估标题长度。
 */
function unitsOf(title: string) {
  let units = 0;
  for (const ch of title) {
    units += (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.55) + 0.06;
  }
  return units;
}

/** 由可用高度与标题长度反推字号（保留两位，避免行内样式出现 17 位小数） */
function fitFontSize(title: string, spineHeight: number) {
  const avail = spineHeight - TITLE_INSET;
  const raw = Math.min(Math.max((avail * SAFETY) / Math.max(unitsOf(title), 1), FS_MIN), FS_MAX);
  return Math.round(raw * 100) / 100;
}

/* ---- 对比度自动选色 ---- */

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* 书脊底色不随主题变化，所以候选文字色也用固定值而不是主题变量，
   否则深色主题下 --paper 变成近黑，压在中调书脊上就看不见了 */
const PAPER_L = luminance("#f8f8f3");
const INK_L = luminance("#101400");

/**
 * 按对比度择优，而不是按「深色就用白字」拍脑袋。
 * 中调书脊（如 #8a8f5a）用纸白只有 3.17:1 不达 AA，
 * 用墨色反而有 5.54:1 —— 必须真的算过才知道该用哪个。
 */
function spineText(hex: string) {
  const l = luminance(hex);
  return contrast(PAPER_L, l) >= contrast(INK_L, l) ? "#f8f8f3" : "#101400";
}

export default function BookshelfTile() {
  /* 点击常驻的那一本（触屏 / 键盘用；鼠标仍可纯靠 hover 预览） */
  const [open, setOpen] = useState<string | null>(null);

  /* 抽出来的卡片要能随手关掉 —— 只靠「再点同一本」太隐蔽，
     读者会以为它卡住了。三条关闭路径：
     1) 点这一本以外的任何地方   2) 按 Esc   3) 再点同一本（onClick 里的 toggle）
     用 pointerdown 而不是 click：触屏上 click 有 ~300ms 延迟 */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      /* 落在「当前展开的这一本」之内的都不关闭 ——
         书脊按钮自己处理 toggle，卡片内部的批注文字/星级/外链要能正常选中与点击，
         否则读者想选一句批注就会把卡片点没了 */
      if ((target as HTMLElement | null)?.closest?.(".book.is-open")) return;
      setOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /* 「在读」固定在第一位：这是全排唯一的视觉落点。
     排序必须稳定 —— 只把第一本 reading 的挪到前面，其余保持数据顺序，
     否则每次改数据书架都会重排，读者记住的位置就失效了。 */
  const ordered = (() => {
    const i = BOOKS.findIndex((b) => b.reading);
    if (i <= 0) return BOOKS;
    return [BOOKS[i], ...BOOKS.slice(0, i), ...BOOKS.slice(i + 1)];
  })();

  /* 按标题长度分配轮廓：最长的标题配最高最宽的书脊。
     这样既保证字号不会小到看不清，也符合「厚书更大」的直觉，
     而不是让长标题随机落到一本矮书上被截断。 */
  const profileOf: (typeof PROFILES)[number][] = [];
  ordered
    .map((b, i) => ({ i, u: unitsOf(b.title) }))
    .sort((a, b) => b.u - a.u)
    .forEach(({ i }, rank) => {
      profileOf[i] = PROFILES[rank % PROFILES.length];
    });

  /* 超过 ROW_SIZE 本就换到下一层搁板，而不是把每本挤细 */
  const items = ordered.map((b, i) => ({ b, idx: i, p: profileOf[i] }));
  const rows: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += ROW_SIZE) {
    rows.push(items.slice(i, i + ROW_SIZE));
  }

  /* 排数传给 CSS：.shelf-scene 的 min-height 按 --rows 递增。
     卡片净空只在第一排需要（其余排的卡片向上落在上一排的空隙里），
     但整块高度必须随排数涨，否则第二排会被压出瓷砖。 */
  const sceneStyle = { "--rows": rows.length } as React.CSSProperties;

  return (
    <article className={`tile tile-books${open ? " has-open" : ""}`}>
      <h3 className="tile-title">
        BOOKSHELF — 精神食粮
        <span className="shelf-count">{BOOKS.length} 本</span>
      </h3>

      {/* 触屏没有 hover，能力有了但没人知道能点 —— 给一句明确提示。
         桌面隐藏（鼠标悬停自然会展开，多这句是噪音） */}
      <p className="shelf-hint">
        <T en="Tap a spine to read my note" zh="点书脊看批注" />
      </p>

      <div className="shelf-scene" aria-label="推荐书架" style={sceneStyle}>
        {rows.map((row, ri) => (
          <div className="shelf-row" key={ri}>
            {row.map(({ b, idx, p }) => {
              /* key 用 title+序号：同名书（如中英各一册）不会撞 key */
              const id = `${b.title}-${idx}`;
              const noteId = `shelf-note-${idx}`;
              const isOpen = open === id;

              return (
                <div
                  className={`book${isOpen ? " is-open" : ""}${b.reading ? " is-reading" : ""}`}
                  key={id}
                  style={
                    {
                      "--bh": `${p.h}px`,
                      "--bw": `${p.w}px`,
                      "--bl": `${p.lean}deg`,
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="book-btn"
                    aria-expanded={isOpen}
                    aria-controls={noteId}
                    title={b.reading ? `${b.title}（在读）` : b.title}
                    onClick={() => setOpen(isOpen ? null : id)}
                  >
                    <span
                      className="book-spine"
                      style={{ background: b.color, color: spineText(b.color) }}
                    >
                      <span
                        className="book-title"
                        style={{ fontSize: `${fitFontSize(b.title, p.h)}px` }}
                      >
                        {b.title}
                      </span>
                      {b.reading && <span className="book-reading" aria-hidden="true" />}
                    </span>
                  </button>

                  <div className="book-note" id={noteId}>
                    <p className="note-meta">
                      {b.en} · {b.author}
                      {b.year ? ` · ${b.year}` : ""}
                    </p>
                    <p className="note-body">{b.note}</p>
                    {/* 在读进度：把「在读」从装饰变成一个可读的信号 */}
                    {b.reading && typeof b.progress === "number" && (
                      <p className="note-progress">
                        <span className="np-label">
                          <T en="Reading" zh="在读" />
                        </span>
                        <span
                          className="np-track"
                          role="progressbar"
                          aria-valuenow={b.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${b.progress}%`}
                        >
                          <span className="np-fill" style={{ width: `${b.progress}%` }} />
                        </span>
                        <b>{b.progress}%</b>
                      </p>
                    )}
                    <p className="note-foot">
                      <span className="note-stars" aria-label={`${b.stars} 星推荐`}>
                        {"★".repeat(b.stars)}
                        {b.stars < 5 && (
                          <span className="stars-dim" aria-hidden="true">
                            {"☆".repeat(5 - b.stars)}
                          </span>
                        )}
                      </span>
                      {b.link && (
                        <a
                          className="note-link"
                          href={b.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看详情 ↗
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </article>
  );
}
