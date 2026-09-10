"use client";

/* ============================================================
 * RoomScene — /room 「Alvin 的房间」
 *
 * 等距伪 3D 房间（SVG 手绘，坐标由 iso helper 在运行时生成）：
 *   · 物件即入口：书桌→项目、书架→读书、床→Now、唱片机→正在播放、
 *     明信片串→旅行、X 光海报→旗舰文章、2026 海报→年度报告
 *   · 活着的细节：伦敦时钟走真实时间、窗外天空随时段变化（点窗可切换）、
 *     猫白天睡觉夜里睁眼、唱片机在音乐播放时旋转、台灯夜间点亮
 *   · 桌面端鼠标视差（两层错位）、入场逐件弹起、reduced-motion 全部静止
 *
 * 等距坐标：地板由 u=(-1,.3) / v=(1,.3) 张开，up 沿墙向上；
 * viewbox 1200×720，房间后角 C(600,396)，地板前角 F(600,636)
 * ============================================================ */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { T, pick, useLocale } from "./i18n";
import { getMusic, isMusicConfigured } from "@/lib/music";
import { playClick, playVinylNeedle } from "@/lib/sfx";

const U: [number, number] = [-1, 0.3];
const V: [number, number] = [1, 0.3];
type P = [number, number];
const pt = (o: P, a: number, b = 0, up = 0): P => [
  o[0] + U[0] * a + V[0] * b,
  o[1] + U[1] * a + V[1] * b - up,
];
const poly = (...pts: P[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/** 等距箱体：pos=底面中心，a=沿 u 半宽，b=沿 v 半深，h=高 */
function boxIso(pos: P, a: number, b: number, h: number) {
  const A = pt(pos, -a, -b);
  const B = pt(pos, a, -b);
  const C = pt(pos, a, b);
  const D = pt(pos, -a, b);
  const up = (p: P): P => [p[0], p[1] - h];
  const A2 = up(A), B2 = up(B), C2 = up(C), D2 = up(D);
  return { top: poly(A2, B2, C2, D2), sw: poly(A, D, D2, A2), se: poly(D, C, C2, D2) };
}

/** 悬空/置顶等距箱体：h0=底面高度，h1=顶面高度 */
function boxIsoRaised(pos: P, a: number, b: number, h0: number, h1: number) {
  const A = pt(pos, -a, -b, h0);
  const B = pt(pos, a, -b, h0);
  const C = pt(pos, a, b, h0);
  const D = pt(pos, -a, b, h0);
  const A2 = pt(pos, -a, -b, h1);
  const B2 = pt(pos, a, -b, h1);
  const C2 = pt(pos, a, b, h1);
  const D2 = pt(pos, -a, b, h1);
  return { top: poly(A2, B2, C2, D2), sw: poly(A, D, D2, A2), se: poly(D, C, C2, D2) };
}

/* 房间骨架 */
const C_TOP: P = [600, 96];
const A_TOP: P = [200, 216];
const B_TOP: P = [1000, 216];
const C_BOT: P = [600, 396];
const A_BOT: P = [200, 516];
const B_BOT: P = [1000, 516];
const F: P = [600, 636];

type Sky = "dawn" | "day" | "dusk" | "night";
const SKY_ORDER: Sky[] = ["day", "dusk", "night", "dawn"];
const SKY_NAME: Record<Sky, { en: string; zh: string }> = {
  day: { en: "daytime", zh: "白天" },
  dusk: { en: "dusk", zh: "黄昏" },
  night: { en: "night", zh: "深夜" },
  dawn: { en: "dawn", zh: "清晨" },
};

export default function RoomScene() {
  const router = useRouter();
  const { locale } = useLocale();

  const [now, setNow] = useState<Date | null>(null);
  const [skyOverride, setSkyOverride] = useState<Sky | null>(null);
  const [np, setNp] = useState<{ playing: boolean; name?: string } | null>(null);
  const [meow, setMeow] = useState(false);
  const meowTimer = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isMusicConfigured()) return;
    let alive = true;
    const load = async () => {
      const d = await getMusic<{ playing: boolean; name?: string }>("/api/now-playing");
      if (alive) setNp(d ?? { playing: false });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* 鼠标视差（仅精确指针 + 未开启 reduced-motion） */
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const my = ((e.clientY - r.top) / r.height) * 2 - 1;
      el.style.setProperty("--mx", mx.toFixed(3));
      el.style.setProperty("--my", my.toFixed(3));
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  const hour = now
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      )
    : 12;
  const minute = now
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          minute: "numeric",
        }).format(now),
      )
    : 0;
  const autoSky: Sky =
    hour >= 5 && hour < 8
      ? "dawn"
      : hour >= 8 && hour < 17
        ? "day"
        : hour >= 17 && hour < 20
          ? "dusk"
          : "night";
  const sky: Sky = skyOverride ?? autoSky;
  const isNight = sky === "night";
  const playing = Boolean(np?.playing);

  const hourDeg = ((hour % 12) + minute / 60) * 30;
  const minDeg = minute * 6;

  const pet = () => {
    playClick(900);
    setMeow(true);
    if (meowTimer.current) window.clearTimeout(meowTimer.current);
    meowTimer.current = window.setTimeout(() => setMeow(false), 2400);
  };

  const cycleSky = () => {
    playClick(2200);
    const cur = skyOverride ?? autoSky;
    const next = SKY_ORDER[(SKY_ORDER.indexOf(cur) + 1) % SKY_ORDER.length];
    setSkyOverride(next === autoSky ? null : next);
  };

  return (
    <div className="room-page">
      <header className="room-head">
        <p className="eyebrow">
          <T en="THE ROOM — a place, not a page" zh="THE ROOM — 一个房间，不只是一个页面" />
        </p>
        <h2>
          <T en="Come in. Look around." zh="进来坐。随便看看。" />
        </h2>
        <p className="room-sub">
          <T
            en="Everything in this room is a door: the desk hides my projects, the shelf holds books, the bed knows what I'm doing now — and the cat? Try clicking it."
            zh="房间里的每样东西都是一扇门：书桌里藏着项目，书架上是书，床知道我最近在忙什么——至于那只猫？试试点它。"
          />
        </p>
      </header>

      <div className={`room-stage is-sky-${sky}`} ref={stageRef}>
        <svg
          className="room-svg"
          viewBox="0 0 1200 720"
          role="img"
          aria-label={pick(locale, "An isometric drawing of Alvin's room", "Alvin 的等距小房间")}
        >
          <defs>
            <radialGradient id="lampGlowFloor" cx="45%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.5" />
              <stop offset="45%" stopColor="#fde047" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
            </radialGradient>
            {/* 窗户防溢出遮罩 */}
            <clipPath id="roomWindowClip">
              <polygon
                points={poly(
                  pt(C_BOT, 70, 0, 230),
                  pt(C_BOT, 190, 0, 230),
                  pt(C_BOT, 190, 0, 90),
                  pt(C_BOT, 70, 0, 90),
                )}
              />
            </clipPath>
          </defs>
          {/* ============ 远层：墙 / 地板 / 墙饰 ============ */}
          <g className="room-l room-l-back">
            <polygon className="room-wall" points={poly(C_TOP, A_TOP, A_BOT, C_BOT)} />
            <polygon className="room-wall room-wall-r" points={poly(C_TOP, B_TOP, B_BOT, C_BOT)} />
            <polygon className="room-floor" points={poly(C_BOT, B_BOT, F, A_BOT)} />
            <polygon
              className="room-floor-edge"
              points={poly(A_BOT, F, [F[0], F[1] + 14], [A_BOT[0], A_BOT[1] + 14])}
            />
            <polygon
              className="room-floor-edge"
              points={poly(F, B_BOT, [B_BOT[0], B_BOT[1] + 14], [F[0], F[1] + 14])}
            />
            <g className="room-planks" aria-hidden="true">
              {[80, 160, 240, 320].map((a) => (
                <line
                  key={`u${a}`}
                  x1={pt(C_BOT, a, 0)[0]}
                  y1={pt(C_BOT, a, 0)[1]}
                  x2={pt(C_BOT, a, 400)[0]}
                  y2={pt(C_BOT, a, 400)[1]}
                />
              ))}
              {[80, 160, 240, 320].map((b) => (
                <line
                  key={`v${b}`}
                  x1={pt(C_BOT, 0, b)[0]}
                  y1={pt(C_BOT, 0, b)[1]}
                  x2={pt(C_BOT, 400, b)[0]}
                  y2={pt(C_BOT, 400, b)[1]}
                />
              ))}
            </g>
            <line className="room-skirt" x1={A_BOT[0]} y1={A_BOT[1]} x2={C_BOT[0]} y2={C_BOT[1]} />
            <line className="room-skirt" x1={C_BOT[0]} y1={C_BOT[1]} x2={B_BOT[0]} y2={B_BOT[1]} />

            {/* 串旗 */}
            <g className="room-bunting" aria-hidden="true">
              <path d="M 600 112 Q 400 150 214 228" fill="none" />
              {[0.12, 0.32, 0.52, 0.72, 0.9].map((t, i) => {
                const x = (1 - t) * (1 - t) * 600 + 2 * (1 - t) * t * 400 + t * t * 214;
                const y = (1 - t) * (1 - t) * 112 + 2 * (1 - t) * t * 150 + t * t * 228;
                return (
                  <polygon key={i} className={i % 2 ? "flag-b" : "flag-a"} points={`${x - 11},${y} ${x + 11},${y} ${x},${y + 22}`} />
                );
              })}
              <path d="M 600 112 Q 800 150 986 228" fill="none" />
              {[0.12, 0.32, 0.52, 0.72, 0.9].map((t, i) => {
                const x = (1 - t) * (1 - t) * 600 + 2 * (1 - t) * t * 800 + t * t * 986;
                const y = (1 - t) * (1 - t) * 112 + 2 * (1 - t) * t * 150 + t * t * 228;
                return (
                  <polygon key={i} className={i % 2 ? "flag-a" : "flag-b"} points={`${x - 11},${y} ${x + 11},${y} ${x},${y + 22}`} />
                );
              })}
            </g>

            {/* 窗（点击切换时段） */}
            {(() => {
              const w0 = pt(C_BOT, 70, 0, 230);
              const w1 = pt(C_BOT, 190, 0, 230);
              const w2 = pt(C_BOT, 190, 0, 90);
              const w3 = pt(C_BOT, 70, 0, 90);
              return (
                <g
                  className={`room-hot room-window sky-${sky}`}
                  role="button"
                  tabIndex={0}
                  aria-label={pick(
                    locale,
                    `Window — click to change time of day (now: ${SKY_NAME[sky].en})`,
                    `窗户——点击切换时段（当前：${SKY_NAME[sky].zh}）`,
                  )}
                  onClick={cycleSky}
                  onKeyDown={(e) => e.key === "Enter" && cycleSky()}
                >
                  <g clipPath="url(#roomWindowClip)">
                    <polygon className="room-win-sky" points={poly(w0, w1, w2, w3)} />
                    <path
                      className="room-win-hills"
                      d={`M ${w3[0]} ${w3[1] - 18} Q ${(w3[0] + w2[0]) / 2 - 20} ${w3[1] - 44} ${(w3[0] + w2[0]) / 2 + 12} ${w3[1] - 16} T ${w2[0]} ${w2[1] - 6} L ${w2[0]} ${w2[1]} L ${w3[0]} ${w3[1]} Z`}
                    />
                    {isNight ? (
                      <circle className="room-win-moon" cx={(w0[0] + w1[0]) / 2 + 18} cy={w0[1] + 26} r={11} />
                    ) : (
                      <circle className="room-win-sun" cx={(w0[0] + w1[0]) / 2 - 12} cy={w0[1] + 24} r={12} />
                    )}
                    <g className="room-win-stars" aria-hidden="true">
                      {[
                        [0.22, 0.72],
                        [0.46, 0.85],
                        [0.72, 0.68],
                        [0.34, 0.48],
                        [0.64, 0.42],
                      ].map(([fu, fv], i) => {
                        const p = pt(C_BOT, 70 + fu * 120, 0, 90 + fv * 140);
                        return (
                          <circle
                            key={i}
                            className="room-star"
                            style={{ animationDelay: `${i * 0.7}s` } as React.CSSProperties}
                            cx={p[0]}
                            cy={p[1]}
                            r={2.2}
                          />
                        );
                      })}
                    </g>
                  </g>
                  <polygon className="room-win-frame" points={poly(w0, w1, w2, w3)} />
                  <line
                    className="room-win-frame"
                    x1={(w0[0] + w1[0]) / 2}
                    y1={(w0[1] + w1[1]) / 2}
                    x2={(w3[0] + w2[0]) / 2}
                    y2={(w3[1] + w2[1]) / 2}
                  />
                  <line
                    className="room-win-frame"
                    x1={(w0[0] + w3[0]) / 2}
                    y1={(w0[1] + w3[1]) / 2}
                    x2={(w1[0] + w2[0]) / 2}
                    y2={(w1[1] + w2[1]) / 2}
                  />
                  <polygon className="room-hit" points={poly(w0, w1, w2, w3)} />
                  <g className="room-tag" transform={`translate(${(w0[0] + w3[0]) / 2 - 14}, ${w3[1] + 16})`}>
                    <text>{pick(locale, `now: ${SKY_NAME[sky].en} (click)`, `现在：${SKY_NAME[sky].zh}（点我）`)}</text>
                  </g>
                </g>
              );
            })()}

            {/* 明信片串 → 旅行 */}
            <g
              role="link"
              tabIndex={0}
              className="room-hot"
              aria-label={pick(locale, "Postcards — travel archive", "明信片串——旅行档案")}
              onClick={() => router.push("/travel")}
              onKeyDown={(e) => e.key === "Enter" && router.push("/travel")}
            >
              <g className="room-pop" style={{ "--d": "1.05s" } as React.CSSProperties}>
                <path className="room-string" d="M 252 168 Q 400 122 540 150" fill="none" />
                {[
                  [292, 152, -5],
                  [388, 138, 4],
                  [478, 140, -3],
                ].map(([x, y, r], i) => (
                  <g key={i} transform={`rotate(${r} ${x} ${y})`}>
                    <rect className="room-postcard" x={x - 26} y={y} width={52} height={38} />
                    <rect className="room-postcard-art" x={x - 20} y={y + 6} width={24} height={18} />
                    <line className="room-string" x1={x} y1={y - 2} x2={x} y2={y + 6} />
                  </g>
                ))}
                <g className="room-tag" transform="translate(450,192)">
                  <text>{pick(locale, "travel archive →", "旅行档案 →")}</text>
                </g>
              </g>
            </g>

            {/* 时钟（真实伦敦时间）——挂在右墙左段，避开书架与墙顶边 */}
            <g className="room-clock room-pop" style={{ "--d": "0.9s" } as React.CSSProperties} aria-hidden="true">
              <circle className="room-clock-face" cx={656} cy={186} r={28} />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 30 * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    className="room-clock-tick"
                    x1={656 + Math.sin(a) * 23}
                    y1={186 - Math.cos(a) * 23}
                    x2={656 + Math.sin(a) * 26.5}
                    y2={186 - Math.cos(a) * 26.5}
                  />
                );
              })}
              <line className="room-clock-hand" x1={656} y1={186} x2={656} y2={169} transform={`rotate(${hourDeg} 656 186)`} />
              <line className="room-clock-hand room-clock-min" x1={656} y1={186} x2={656} y2={163} transform={`rotate(${minDeg} 656 186)`} />
              <circle className="room-clock-pin" cx={656} cy={186} r={3} />
            </g>

            {/* X-RAY 海报（右墙）→ 旗舰文章 */}
            <g
              role="link"
              tabIndex={0}
              className="room-hot"
              aria-label={pick(locale, "X-RAY poster — read the story", "X 光海报——读这篇故事")}
              onClick={() => router.push("/blog/xray-hero-effect")}
              onKeyDown={(e) => e.key === "Enter" && router.push("/blog/xray-hero-effect")}
            >
              <g className="room-pop" style={{ "--d": "1.2s" } as React.CSSProperties}>
                <polygon className="room-poster" points="904,270 996,297 996,400 904,373" />
                <path
                  className="room-poster-art"
                  d="M 932 306 q 14 -14 28 0 q 8 10 -2 22 q 18 6 22 24 l -66 0 q 4 -18 22 -24 q -10 -12 -4 -22 Z"
                />
                <line className="room-poster-ray" x1={916} y1={352} x2={988} y2={374} />
                <line className="room-poster-ray" x1={916} y1={358} x2={988} y2={380} />
                <text className="room-poster-text" x={916} y={324} fontSize={13}>X-RAY</text>
                <g className="room-tag" transform="translate(952,414)">
                  <text>{pick(locale, "read the story →", "读这篇故事 →")}</text>
                </g>
              </g>
            </g>

            {/* 2026 REPORT 海报（左墙）→ /year */}
            <g
              role="link"
              tabIndex={0}
              className="room-hot"
              aria-label={pick(locale, "2026 report poster", "2026 年度报告海报")}
              onClick={() => router.push("/year")}
              onKeyDown={(e) => e.key === "Enter" && router.push("/year")}
            >
              <g className="room-pop room-poster-lime" style={{ "--d": "1.35s" } as React.CSSProperties}>
                <polygon className="room-poster room-poster-fill" points="396,182 304,209 304,312 396,285" />
                <text className="room-poster-year" x={318} y={266} fontSize={30}>20</text>
                <text className="room-poster-year room-poster-year2" x={318} y={296} fontSize={30}>26</text>
                <text className="room-poster-text room-poster-text-dark" x={318} y={228} fontSize={12}>REPORT</text>
                <g className="room-tag" transform="translate(315,324)">
                  <text>{pick(locale, "the year report →", "年度报告 →")}</text>
                </g>
              </g>
            </g>
          </g>

          {/* ============ 中层：地毯 + 家具 ============ */}
          <g className="room-l room-l-mid">
            {/* 地毯 */}
            <g className="room-pop" style={{ "--d": "0.15s" } as React.CSSProperties} aria-hidden="true">
              <ellipse className="room-rug" cx={640} cy={588} rx={150} ry={46} />
              <ellipse className="room-rug-inner" cx={640} cy={588} rx={100} ry={30} />
            </g>

            {/* 床 → /now */}
            {(() => {
              const bedP: P = [400, 468];
              const b = boxIso(bedP, 108, 46, 40);
              const quilt = boxIsoRaised([bedP[0] + 30, bedP[1] + 9], 66, 40, 40, 44);
              const pil = boxIsoRaised(pt(bedP, -72, 0), 24, 38, 40, 50);
              return (
                <g
                  role="link"
                  tabIndex={0}
                  className="room-hot"
                  aria-label={pick(locale, "Bed — what I'm doing now", "床——我最近在做什么")}
                  onClick={() => router.push("/now")}
                  onKeyDown={(e) => e.key === "Enter" && router.push("/now")}
                >
                  <g className="room-pop" style={{ "--d": "0.35s" } as React.CSSProperties}>
                    <polygon className="room-box-top" points={b.top} />
                    <polygon className="room-box-sw" points={b.sw} />
                    <polygon className="room-box-se" points={b.se} />
                    <polygon className="room-quilt-side" points={quilt.se} />
                    <polygon className="room-quilt" points={quilt.top} />
                    <line
                      className="room-quilt-line"
                      x1={pt(bedP, 8, -40, 44)[0]}
                      y1={pt(bedP, 8, -40, 44)[1]}
                      x2={pt(bedP, 8, 40, 44)[0]}
                      y2={pt(bedP, 8, 40, 44)[1]}
                    />
                    <line
                      className="room-quilt-line"
                      x1={pt(bedP, 40, -40, 44)[0]}
                      y1={pt(bedP, 40, -40, 44)[1]}
                      x2={pt(bedP, 40, 40, 44)[0]}
                      y2={pt(bedP, 40, 40, 44)[1]}
                    />
                    <polygon className="room-pillow-side" points={pil.se} />
                    <polygon className="room-pillow" points={pil.top} />
                    <rect className="room-mag" x={330} y={432} width={26} height={18} transform="rotate(-6 343 441)" />
                    <g className="room-tag" transform="translate(360,495)">
                      <text>{pick(locale, "what I'm doing now →", "我最近在干嘛 →")}</text>
                    </g>
                  </g>
                </g>
              );
            })()}

            {/* 台灯（夜里亮） */}
            <g className="room-lamp room-pop" style={{ "--d": "0.5s" } as React.CSSProperties} aria-hidden="true">
              <ellipse className="room-lamp-pool" cx={330} cy={548} rx={96} ry={38} fill="url(#lampGlowFloor)" />
              <ellipse className="room-lamp-base" cx={285} cy={556} rx={14} ry={5} />
              <line className="room-lamp-pole" x1={285} y1={554} x2={285} y2={498} />
              <polygon className="room-lamp-shade" points="271,500 299,500 291,480 279,480" />
              <ellipse className="room-lamp-glow" cx={285} cy={504} rx={34} ry={22} />
            </g>

            {/* 书桌 + 显示器 → 项目 */}
            <g
              role="link"
              tabIndex={0}
              className="room-hot"
              aria-label={pick(locale, "Desk — see my projects", "书桌——看我的项目")}
              onClick={() => router.push("/#projects")}
              onKeyDown={(e) => e.key === "Enter" && router.push("/#projects")}
            >
              <g className="room-pop" style={{ "--d": "0.55s" } as React.CSSProperties}>
                {(() => {
                  const desk = boxIso([810, 486], 100, 38, 58);
                  return (
                    <>
                      <polygon className="room-box-top" points={desk.top} />
                      <polygon className="room-box-sw" points={desk.sw} />
                      <polygon className="room-box-se" points={desk.se} />
                    </>
                  );
                })()}
                {/* 显示器（坐标贴合桌面） */}
                <line className="room-desk-leg" x1={786} y1={412} x2={786} y2={394} />
                <g transform="translate(742, 336)">
                  <rect className="room-monitor" x={0} y={0} width={88} height={58} rx={6} />
                  <rect className="room-screen" x={6} y={6} width={76} height={46} rx={3} />
                  <rect className="room-code" x={12} y={14} width={44} height={5} rx={2} />
                  <rect className="room-code room-code-2" x={12} y={25} width={58} height={5} rx={2} />
                  <rect className="room-code room-code-3" x={12} y={36} width={34} height={5} rx={2} />
                  <rect className="room-cursor" x={50} y={36} width={6} height={6} />
                </g>
                <polygon className="room-keyboard" points="800,398 842,386 856,394 814,406" />
                <g aria-hidden="true">
                  <rect className="room-mug" x={760} y={402} width={14} height={16} rx={3} />
                  <path className="room-mug" d="M 774 406 q 8 2 0 9" fill="none" />
                </g>
                <g className="room-tag" transform="translate(750,560)">
                  <text>{pick(locale, "projects live here →", "项目都在这 →")}</text>
                </g>
              </g>
            </g>

            {/* 椅子 */}
            <g className="room-chair room-pop" style={{ "--d": "0.7s" } as React.CSSProperties} aria-hidden="true">
              <ellipse className="room-chair-base" cx={660} cy={536} rx={20} ry={7} />
              <line className="room-chair-pole" x1={660} y1={534} x2={660} y2={498} />
              <polygon className="room-chair-seat" points="638,496 682,488 682,497 638,505" />
              <rect className="room-chair-back" x={637} y={446} width={9} height={46} rx={4} />
            </g>

            {/* 书架（右墙）→ 读书 */}
            <g
              role="link"
              tabIndex={0}
              className="room-hot"
              aria-label={pick(locale, "Bookshelf — what I read", "书架——我在读什么")}
              onClick={() => router.push("/#about")}
              onKeyDown={(e) => e.key === "Enter" && router.push("/#about")}
            >
              <g className="room-pop" style={{ "--d": "0.8s" } as React.CSSProperties}>
                {(() => {
                  const boards = [164, 204, 244];
                  const spineColors = ["#3d4a2a", "#6b6f3f", "#8a8f5a", "#2f3524", "#544a1e", "#7a8a1e"];
                  return (
                    <>
                      <polygon
                        className="room-shelf-frame"
                        points={poly(pt(C_BOT, 0, 108, 160), pt(C_BOT, 0, 260, 160), pt(C_BOT, 0, 260, 288), pt(C_BOT, 0, 108, 288))}
                      />
                      {boards.map((h0, si) => (
                        <g key={h0}>
                          <polygon
                            className="room-shelf-board"
                            points={poly(pt(C_BOT, 0, 112, h0 + 6), pt(C_BOT, 0, 256, h0 + 6), pt(C_BOT, 0, 256, h0), pt(C_BOT, 0, 112, h0))}
                          />
                          {Array.from({ length: 5 }).map((_, bi) => {
                            const x0 = 116 + bi * 27;
                            const h = 26 + ((bi * 7 + si * 5) % 9);
                            const p0 = pt(C_BOT, 0, x0, h0 + 6);
                            const p1 = pt(C_BOT, 0, x0 + 18, h0 + 6);
                            return (
                              <polygon
                                key={bi}
                                className="room-spine"
                                fill={spineColors[(bi + si * 2) % spineColors.length]}
                                points={poly([p0[0], p0[1] - h], [p1[0], p1[1] - h], p1, p0)}
                              />
                            );
                          })}
                        </g>
                      ))}
                    </>
                  );
                })()}
                <g className="room-tag" transform="translate(746,305)">
                  <text>{pick(locale, "what I read →", "我在读什么 →")}</text>
                </g>
              </g>
            </g>

            {/* 唱片机矮柜 → 正在播放 */}
            <g
              role="link"
              tabIndex={0}
              className="room-hot"
              aria-label={pick(locale, "Record player — now playing", "唱片机——正在播放")}
              onClick={() => {
                playVinylNeedle();
                router.push("/#now-playing");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  playVinylNeedle();
                  router.push("/#now-playing");
                }
              }}
            >
              <g className="room-pop" style={{ "--d": "0.45s" } as React.CSSProperties}>
                {(() => {
                  const con = boxIso([400, 600], 66, 24, 34);
                  return (
                    <>
                      <polygon className="room-box-top" points={con.top} />
                      <polygon className="room-box-sw" points={con.sw} />
                      <polygon className="room-box-se" points={con.se} />
                      {/* 经典 Hi-Fi 唱机控制面板：金属旋钮、指示灯与前出音隔栅 */}
                      <g className="room-hifi-details" aria-hidden="true">
                        <line x1={375} y1={616} x2={455} y2={592} stroke="rgba(255,255,255,0.12)" strokeWidth={1.8} />
                        <line x1={375} y1={620} x2={455} y2={596} stroke="rgba(255,255,255,0.12)" strokeWidth={1.8} />
                        <line x1={375} y1={624} x2={455} y2={600} stroke="rgba(255,255,255,0.12)" strokeWidth={1.8} />
                        <circle cx={468} cy={588} r={2.5} fill="#cca43b" stroke="var(--ink)" strokeWidth={0.8} />
                        <circle cx={476} cy={586} r={2.5} fill="#cca43b" stroke="var(--ink)" strokeWidth={0.8} />
                        <circle cx={460} cy={590} r={1.5} fill={playing ? "#a3e635" : "#64748b"} />
                      </g>
                    </>
                  );
                })()}
                {/* 唱片机黑胶唱盘：等距投影保持平面旋转，不再在屏幕 2D 上翻滚 */}
                <g className="room-turntable-deck" transform="translate(406, 566) scale(1, 0.353)">
                  {/* 底盘与黑胶凹槽（固定椭圆平面，绝不侧立翻转） */}
                  <circle className="room-disc-vinyl" r={34} />
                  <circle className="room-disc-groove" r={27} />
                  <circle className="room-disc-groove" r={21} />
                  <circle className="room-disc-groove" r={15} />

                  {/* 随音乐旋转的盘面反光与唱片芯贴纸 */}
                  <g className={playing ? "room-disc-rotor is-spinning" : "room-disc-rotor"}>
                    {/* 蝴蝶形光影高光扫描线 */}
                    <line className="room-disc-shine" x1={-33} y1={0} x2={33} y2={0} />
                    <line className="room-disc-shine-subtle" x1={0} y1={-33} x2={0} y2={33} />
                    {/* 唱片中央红色贴纸 */}
                    <circle className="room-disc-label" r={10} />
                    {/* 唱片印刷纹理与标记点，旋转时能清晰看到围绕中轴的匀速转动 */}
                    <line className="room-disc-label-marker" x1={-8} y1={0} x2={8} y2={0} />
                    <circle className="room-disc-label-dot" cx={5} cy={0} r={2} />
                    {/* 中轴孔 */}
                    <circle className="room-disc-spindle" r={2.5} />
                  </g>
                </g>
                {/* 唱臂（唱头轻轻搭在黑胶唱片音轨上） */}
                <line className="room-tonearm" x1={446} y1={556} x2={426} y2={564} />
                <circle className="room-tonearm-pivot" cx={446} cy={556} r={2.8} />
                <rect className="room-cartridge" x={422} y={562} width={5} height={3} rx={1} transform="rotate(22 424.5 563.5)" />
                {playing && np?.name && (
                  <text className="room-np-label" x={406} y={596} textAnchor="middle">
                    ♪ {np.name.slice(0, 12)}
                  </text>
                )}
                {playing && <text className="room-note room-note-1" x={450} y={548} aria-hidden="true">♪</text>}
                {playing && <text className="room-note room-note-2" x={360} y={538} aria-hidden="true">♫</text>}
                <g className="room-tag" transform="translate(365,630)">
                  <text>{pick(locale, "now playing →", "正在播放 →")}</text>
                </g>
              </g>
            </g>

            {/* 植物（右后角） */}
            <g className="room-plant room-pop" style={{ "--d": "0.25s" } as React.CSSProperties} aria-hidden="true">
              <path className="room-plant-leaf" d="M 922 454 q -26 -34 -6 -62 q 8 30 14 44 q 2 -36 16 -48 q 2 30 -4 52 Z" />
              <polygon className="room-plant-pot" points="912,452 946,452 941,482 917,482" />
            </g>
          </g>

          {/* ============ 前层：猫 ============ */}
          <g className="room-l room-l-front">
            <g
              className="room-hot room-cat"
              role="button"
              tabIndex={0}
              aria-label={pick(locale, "The cat — click to pet", "猫——点一下撸撸它")}
              onClick={pet}
              onKeyDown={(e) => e.key === "Enter" && pet()}
            >
              <g className="room-cat-body">
                <ellipse className="room-cat-fur" cx={592} cy={560} rx={40} ry={21} />
                <path className="room-cat-stripe" d="M 564 546 q 6 14 2 28 M 582 542 q 6 16 2 34 M 600 544 q 5 14 2 30" />
                <path className="room-cat-tail" d="M 556 566 q -28 4 -26 -18" />
                {/* 揣进肚肚下的可爱猫爪爪 */}
                <ellipse className="room-cat-paw" cx={612} cy={571} rx={6.5} ry={3.2} />
                <ellipse className="room-cat-paw" cx={590} cy={573} rx={5.5} ry={2.8} />
                <circle className="room-cat-head" cx={630} cy={552} r={15} />
                <polygon className="room-cat-ear" points="620,540 626,526 632,539" />
                <polygon className="room-cat-ear" points="634,538 642,526 644,540" />
                {/* 粉红小鼻头 */}
                <polygon points="629,554 632,554 630.5,556" fill="#f43f5e" />
                {/* 猫咪表情状态机：撸猫时闭眼享受微笑脸、深夜精神睁眼、白天安静睡觉 */}
                {meow ? (
                  <g className="room-cat-eyes-purr">
                    <path d="M 622 552 q 3.5 -3.5 7 0 M 631 552 q 3.5 -3.5 7 0" />
                    <circle cx={621} cy={556} r={2.5} fill="#f43f5e" opacity={0.65} />
                    <circle cx={639} cy={556} r={2.5} fill="#f43f5e" opacity={0.65} />
                  </g>
                ) : isNight ? (
                  <g className="room-cat-eyes-open">
                    <ellipse cx={625} cy={551} rx={2.2} ry={2.5} />
                    <circle cx={625.8} cy={550.2} r={0.8} fill="#ffffff" />
                    <ellipse cx={635} cy={551} rx={2.2} ry={2.5} />
                    <circle cx={635.8} cy={550.2} r={0.8} fill="#ffffff" />
                  </g>
                ) : (
                  <g className="room-cat-eyes-closed">
                    <path d="M 622 550 q 3.5 3.5 7 0 M 631 550 q 3.5 3.5 7 0" />
                  </g>
                )}
              </g>
              <polygon className="room-hit" points="536,528 660,528 660,588 536,588" />
              {meow && (
                <g className="room-meow" aria-hidden="true">
                  <path className="room-meow-bubble" d="M 650 500 q 30 -18 60 0 q 26 16 0 30 q -30 16 -56 2 l -14 12 l 4 -16 q -18 -14 6 -28 Z" />
                  <text className="room-meow-text" x={682} y={522} textAnchor="middle">喵~</text>
                  <path className="room-meow-heart" d="M 676 480 q 3 -5 6 0 q 3 -5 6 0 q 0 4 -6 8 q -6 -4 -6 -8 Z" />
                </g>
              )}
              <g className="room-tag" transform="translate(554,608)">
                <text>{pick(locale, "pet the cat", "撸猫")}</text>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* 图例 chips：移动端与无障碍的主要入口 */}
      <nav className="room-legend" aria-label="房间导航">
        <Link href="/#projects">🖥 <T en="Desk · Projects" zh="书桌 · 项目" /></Link>
        <Link href="/#about">📚 <T en="Shelf · Books" zh="书架 · 读书" /></Link>
        <Link href="/now">🛏 <T en="Bed · Now" zh="床 · 现在" /></Link>
        <Link href="/#now-playing">♪ <T en="Player · Music" zh="唱片机 · 音乐" /></Link>
        <Link href="/travel">📮 <T en="Postcards · Travel" zh="明信片 · 旅行" /></Link>
        <Link href="/blog/xray-hero-effect">🩻 <T en="Poster · X-Ray" zh="海报 · X 光" /></Link>
        <Link href="/year">🗓 <T en="Poster · 2026 Report" zh="海报 · 2026 报告" /></Link>
      </nav>

      <p className="room-footnote">
        <T
          en="Hand-drawn SVG, no game engine. The clock and window follow the real time in Durham — come back at a different hour and the room changes with it."
          zh="手绘 SVG，没有游戏引擎。时钟和窗户跟着杜伦的真实时间走——换个时间再来，房间会不一样。"
        />
      </p>
    </div>
  );
}
