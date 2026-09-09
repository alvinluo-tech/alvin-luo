"use client";

/* ============================================================
 * YearReport — /year 年度报告（Scroll-Snap 翻卡 × 真实数据）
 *
 * 卡片 0-6：封面 / 写作 / 代码 / 音乐 / 世界 / 书架 / 海报
 * 数据：博客+旅行 = 构建时 props；GitHub+网易云 = 客户端实时取，失败自动降级
 * 动画：IntersectionObserver 命中卡片 → is-active 触发子元素错峰入场
 *       + 数字 CountUp（rAF 缓出）+ 分类条填充；reduced-motion 全部直出
 * ============================================================ */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { T, pick, useLocale } from "./i18n";
import { getMusic, isMusicConfigured } from "@/lib/music";
import { GITHUB_USER, GITHUB_URL } from "@/config/site";
import { playClick } from "@/lib/sfx";
import { TRIPS } from "@/data/trips";
import { BOOKS } from "./BookshelfTile";

export type YearPost = {
  slug: string;
  title: string;
  date: string;
  category: string;
  readingMinutes: number;
};

export type YearStats = {
  year: string;
  posts: YearPost[];
  tripsTotal: number;
  countries: number;
  latestTrip: {
    place: string;
    placeEn?: string;
    date: string;
    dateEn?: string;
    note: string;
    noteEn?: string;
    img: string;
  } | null;
};

type MusicStats = {
  ok: boolean;
  level?: number | null;
  likedCount?: number | null;
  totalMinutes?: number | null;
};
type Song = { name: string; artist?: string; playCount?: number };

const CATEGORY_LABELS: Record<string, string> = {
  projects: "PROJECTS",
  life: "LIFE",
  course: "COURSE",
};

const STEPS = ["COVER", "WRITING", "CODE", "MUSIC", "WORLD", "BOOKS", "POSTER"];
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* rAF 缓出计数：卡片激活时从 0 滚到目标值；reduced-motion 直接出结果 */
function CountUp({
  to,
  active,
  duration = 1200,
}: {
  to: number;
  active: boolean;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, duration]);
  return <>{val.toLocaleString()}</>;
}

export default function YearReport({ stats }: { stats: YearStats }) {
  const { locale } = useLocale();
  const year = stats.year;
  const posts = stats.posts;

  /* ---- 写作统计（构建时数据，直接算） ---- */
  const minutes = posts.reduce((s, p) => s + p.readingMinutes, 0);
  const catCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});
  const longest = [...posts].sort((a, b) => b.readingMinutes - a.readingMinutes)[0];
  const first = posts[0];
  const last = posts[posts.length - 1];

  /* ---- 音乐（客户端实时） ---- */
  const [music, setMusic] = useState<{
    stats: MusicStats | null;
    repeat: Song[];
  } | null>(null);
  /* ---- GitHub（客户端实时，逐级降级） ---- */
  const [gh, setGh] = useState<{
    repos?: number;
    followers?: number;
    pushedThisYear?: number;
    top?: { name: string; stars: number; url: string }[];
    failed?: boolean;
  } | null>(null);
  const [chartOk, setChartOk] = useState(true);
  const [tripImgFailed, setTripImgFailed] = useState(false);

  useEffect(() => {
    const img = document.querySelector<HTMLImageElement>(".yr-photo-frame img");
    if (img && img.complete && img.naturalWidth === 0) {
      setTripImgFailed(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    if (isMusicConfigured()) {
      (async () => {
        const [s, r] = await Promise.all([
          getMusic<MusicStats>("/api/stats"),
          getMusic<{ songs: Song[] }>("/api/on-repeat"),
        ]);
        if (alive)
          setMusic({ stats: s, repeat: (r?.songs ?? []).slice(0, 3) });
      })();
    }
    (async () => {
      try {
        const u = await fetch(
          `https://api.github.com/users/${GITHUB_USER}`,
        ).then((r) => (r.ok ? r.json() : null));
        const repos = await fetch(
          `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`,
        ).then((r) => (r.ok ? r.json() : null));
        if (!alive) return;
        if (!u && !Array.isArray(repos)) {
          setGh({ failed: true });
          return;
        }
        const top = Array.isArray(repos)
          ? [...repos]
              .sort(
                (a, b) =>
                  b.stargazers_count - a.stargazers_count ||
                  b.pushed_at.localeCompare(a.pushed_at),
              )
              .slice(0, 3)
              .map((r) => ({
                name: r.name,
                stars: r.stargazers_count ?? 0,
                url: r.html_url,
              }))
          : undefined;
        setGh({
          repos: u?.public_repos,
          followers: u?.followers,
          pushedThisYear: Array.isArray(repos)
            ? repos.filter(
                (r) =>
                  typeof r.pushed_at === "string" &&
                  r.pushed_at.startsWith(year),
              ).length
            : undefined,
          top,
        });
      } catch {
        if (alive) setGh({ failed: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [year]);

  /* ---- 翻卡：IntersectionObserver 派发 is-active ---- */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".yr-card"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting)
            setStep(Number((e.target as HTMLElement).dataset.step ?? 0));
        }
      },
      { root, threshold: 0.55 },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  /* 键盘 ↑↓ 翻卡（输入框聚焦时让路；⌘K 面板 preventDefault 的事件不再处理） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const delta =
        e.key === "ArrowDown" || e.key === "PageDown"
          ? 1
          : e.key === "ArrowUp" || e.key === "PageUp"
            ? -1
            : 0;
      if (!delta) return;
      const cards = scrollerRef.current?.querySelectorAll<HTMLElement>(".yr-card");
      if (!cards) return;
      const next = Math.min(cards.length - 1, Math.max(0, step + delta));
      if (next !== step) {
        e.preventDefault();
        cards[next].scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const jump = (i: number) => {
    playClick(900);
    scrollerRef.current
      ?.querySelectorAll<HTMLElement>(".yr-card")
      [i]?.scrollIntoView({ behavior: "smooth" });
  };

  /* ---- 复制分享链接 ---- */
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`https://alvin-luo.me/year`);
      setCopied(true);
      playClick(2200);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用（非安全上下文）静默 */
    }
  };

  const cats = Object.entries(catCounts);
  /* 按中文名去重，保留 en/zh 两种显示名 */
  const seen = new Set<string>();
  const countryPairs: { zh: string; en: string }[] = [];
  for (const t of TRIPS) {
    if (!seen.has(t.country)) {
      seen.add(t.country);
      countryPairs.push({ zh: t.country, en: t.countryEn ?? t.country });
    }
  }

  return (
    <div className="yr-page">
      {/* 右侧进度轨道 */}
      <nav className="yr-rail" aria-label="报告进度">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={i === step ? "is-on" : undefined}
            onClick={() => jump(i)}
            aria-label={label}
            title={label}
          >
            <i />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="yr-scroller" data-lenis-prevent ref={scrollerRef}>
        {/* ============ 0 封面 ============ */}
        <section className={`yr-card ${step === 0 ? "is-active" : ""}`} data-step="0">
          <div className="yr-inner yr-cover">
            <span className="washi washi-tl" aria-hidden="true" />
            <span className="washi washi-br" aria-hidden="true" />
            <p className="eyebrow yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              ALVIN.LUO — ANNUAL REPORT · VOL.1
            </p>
            <h1 className="yr-type" aria-label={`${year} Year in Review`}>
              <span className="yr-anim yr-type-solid" style={{ "--i": 1 } as React.CSSProperties}>
                20
              </span>
              <span className="yr-anim yr-type-outline" style={{ "--i": 2 } as React.CSSProperties}>
                26
              </span>
            </h1>
            <p className="yr-sub yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
              <T
                en="YEAR IN REVIEW — SO FAR. Every number on this report is real data from this site."
                zh="年度报告 · 中期版。下面每一个数字都是这个网站的真实数据。"
              />
            </p>
            <div className="yr-chips yr-anim" style={{ "--i": 4 } as React.CSSProperties}>
              <span>WRITING ×{posts.length}</span>
              <span>GITHUB @{GITHUB_USER}</span>
              <span>NETEASE FM</span>
              <span>{stats.countries} COUNTRIES</span>
              <span>×{BOOKS.length} BOOKS</span>
            </div>
            <p className="yr-scroll-hint yr-anim" style={{ "--i": 5 } as React.CSSProperties} aria-hidden="true">
              SCROLL ↓
            </p>
          </div>
        </section>

        {/* ============ 1 写作 ============ */}
        <section className={`yr-card ${step === 1 ? "is-active" : ""}`} data-step="1">
          <div className="yr-inner">
            <p className="yr-label yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              <T en="01 · WRITING" zh="01 · 写作" />
            </p>
            <div className="yr-figures">
              <div className="yr-fig yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                <strong>
                  <CountUp to={posts.length} active={step === 1} />
                  <T en=" posts" zh=" 篇" />
                </strong>
                <span>
                  <T en="published this year" zh="今年发布" />
                </span>
              </div>
              <div className="yr-fig yr-anim" style={{ "--i": 2 } as React.CSSProperties}>
                <strong>
                  <CountUp to={minutes} active={step === 1} />
                  <T en=" min" zh=" 分钟" />
                </strong>
                <span>
                  <T en="of reading, end to end" zh="从头读完需要" />
                </span>
              </div>
            </div>
            <div className="yr-bars yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
              {cats.map(([cat, n]) => (
                <div className="yr-bar-row" key={cat}>
                  <span className="yr-bar-name">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="yr-bar">
                    <i
                      style={
                        {
                          "--w": `${Math.round((n / Math.max(1, posts.length)) * 100)}%`,
                        } as React.CSSProperties
                      }
                    />
                  </span>
                  <span className="yr-bar-n">×{n}</span>
                </div>
              ))}
            </div>
            <div className="yr-notes yr-anim" style={{ "--i": 4 } as React.CSSProperties}>
              <p>
                <T en="First post " zh="第一篇发布于 " />
                <b>{first?.date.slice(0, 10)}</b>
                <T en=" · latest " zh="，最新一篇 " />
                <b>{last?.date.slice(0, 10)}</b>
              </p>
              {longest && (
                <p>
                  <T en="Longest read — " zh="最长的一篇 — " />
                  <Link className="yr-link" href={`/blog/${longest.slug}`}>
                    {longest.title}（{longest.readingMinutes}
                    <T en=" min" zh=" 分钟" />）→
                  </Link>
                </p>
              )}
              <p>
                <Link className="yr-link" href="/blog">
                  <T en="Browse all posts" zh="翻全部文章" /> →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* ============ 2 代码 ============ */}
        <section className={`yr-card ${step === 2 ? "is-active" : ""}`} data-step="2">
          <div className="yr-inner">
            <p className="yr-label yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              <T en="02 · CODE" zh="02 · 代码" />
            </p>
            <div className="yr-figures">
              {gh?.repos != null && (
                <div className="yr-fig yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                  <strong>
                    <CountUp to={gh.repos} active={step === 2} />
                  </strong>
                  <span>
                    <T en="public repos" zh="公开仓库" />
                  </span>
                </div>
              )}
              {gh?.pushedThisYear != null && (
                <div className="yr-fig yr-anim" style={{ "--i": 2 } as React.CSSProperties}>
                  <strong>
                    <CountUp to={gh.pushedThisYear} active={step === 2} />
                  </strong>
                  <span>
                    <T en={`repos pushed in ${year}`} zh={`今年还在更新的仓库`} />
                  </span>
                </div>
              )}
              {gh?.followers != null && (
                <div className="yr-fig yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
                  <strong>
                    <CountUp to={gh.followers} active={step === 2} />
                  </strong>
                  <span>
                    <T en="followers" zh="关注者" />
                  </span>
                </div>
              )}
            </div>
            <div className="yr-chart yr-anim" style={{ "--i": 4 } as React.CSSProperties}>
              {chartOk && !gh?.failed ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://ghchart.rshah.org/9dc500/${GITHUB_USER}`}
                  alt={`${GITHUB_USER} 的 GitHub 贡献热力图`}
                  loading="eager"
                  onError={() => setChartOk(false)}
                />
              ) : (
                <p className="yr-fallback">
                  <T
                    en={
                      <>
                        Chart unreachable right now — see it on{" "}
                        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                          GitHub
                        </a>{" "}
                        directly.
                      </>
                    }
                    zh={
                      <>
                        贡献图暂时加载不出来——直接去{" "}
                        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                          GitHub
                        </a>{" "}
                        看吧。
                      </>
                    }
                  />
                </p>
              )}
            </div>
            {gh?.top && gh.top.length > 0 && (
              <div className="yr-repos yr-anim" style={{ "--i": 5 } as React.CSSProperties}>
                <T en="Most starred — " zh="星最多的仓库 — " />
                {gh.top.map((r, i) => (
                  <span key={r.name}>
                    {i > 0 && " · "}
                    <a className="yr-link" href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.name} ★{r.stars}
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============ 3 音乐 ============ */}
        <section className={`yr-card ${step === 3 ? "is-active" : ""}`} data-step="3">
          <div className="yr-inner">
            <p className="yr-label yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              <T en="03 · MUSIC" zh="03 · 音乐" />
            </p>
            {!isMusicConfigured() ? (
              <p className="yr-fallback yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                <T
                  en="Music service not connected — wire NETEASE_API in config/site.ts."
                  zh="音乐服务未连线——在 config/site.ts 里配置 NETEASE_API 即可点亮。"
                />
              </p>
            ) : music?.stats?.ok ? (
              <>
                <div className="yr-figures">
                  {music.stats.level != null && (
                    <div className="yr-fig yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                      <strong>
                        LV.<CountUp to={music.stats.level} active={step === 3} />
                      </strong>
                      <span>
                        <T en="NetEase level" zh="网易云等级" />
                      </span>
                    </div>
                  )}
                  {music.stats.totalMinutes != null && (
                    <div className="yr-fig yr-anim" style={{ "--i": 2 } as React.CSSProperties}>
                      <strong>
                        ≈
                        <CountUp
                          to={Math.round((music.stats.totalMinutes ?? 0) / 60)}
                          active={step === 3}
                        />
                        <T en=" h" zh=" 小时" />
                      </strong>
                      <span>
                        <T
                          en={`${music.stats.totalMinutes?.toLocaleString()} minutes all-time`}
                          zh={`累计听歌 ${music.stats.totalMinutes?.toLocaleString()} 分钟`}
                        />
                      </span>
                    </div>
                  )}
                  {music.stats.likedCount != null && (
                    <div className="yr-fig yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
                      <strong>♥ <CountUp to={music.stats.likedCount} active={step === 3} /></strong>
                      <span>
                        <T en="liked songs" zh="红心歌曲" />
                      </span>
                    </div>
                  )}
                </div>
                {music.repeat.length > 0 && (
                  <ol className="yr-repeat yr-anim" style={{ "--i": 4 } as React.CSSProperties}>
                    {music.repeat.map((s, i) => (
                      <li key={s.name}>
                        <em>{i + 1}</em>
                        <b>{s.name}</b>
                        <span>{s.artist}</span>
                        {s.playCount != null && (
                          <i>
                            <T en={`×${s.playCount} plays`} zh={`循环 ${s.playCount} 次`} />
                          </i>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="yr-fallback yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                <T en="Stats unreachable right now — retry later." zh="统计暂时拿不到——晚点再回来看看。" />
              </p>
            )}
          </div>
        </section>

        {/* ============ 4 世界 ============ */}
        <section className={`yr-card ${step === 4 ? "is-active" : ""}`} data-step="4">
          <div className="yr-inner yr-world">
            <p className="yr-label yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              <T en="04 · WORLD" zh="04 · 世界" />
            </p>
            <div className="yr-figures">
              <div className="yr-fig yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                <strong>
                  <CountUp to={stats.tripsTotal} active={step === 4} />
                  <T en=" stops" zh=" 站" />
                </strong>
                <span>
                  <T en="on the map so far" zh="地图足迹累计" />
                </span>
              </div>
              <div className="yr-fig yr-anim" style={{ "--i": 2 } as React.CSSProperties}>
                <strong>
                  <CountUp to={stats.countries} active={step === 4} />
                  <T en=" countries" zh=" 个国家" />
                </strong>
                <span>
                  {countryPairs
                    .map((c) => (locale === "en" ? c.en : c.zh))
                    .join(" · ")}
                </span>
              </div>
            </div>
            {stats.latestTrip && (
              <div className="yr-postcard yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
                <span className={`yr-photo-frame ${tripImgFailed ? "is-fallback" : ""}`}>
                  {!tripImgFailed ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${BASE_PATH}/travel/${stats.latestTrip.img}.jpg`}
                      alt={pick(locale, stats.latestTrip.placeEn ?? stats.latestTrip.place, stats.latestTrip.place)}
                      onError={() => setTripImgFailed(true)}
                    />
                  ) : (
                    <div className="yr-photo-stamp-wrap" aria-hidden="true">
                      <span className="yr-stamp-icon">✈</span>
                      <span className="yr-stamp-text">
                        {pick(locale, stats.latestTrip.placeEn ?? stats.latestTrip.place, stats.latestTrip.place)}
                      </span>
                    </div>
                  )}
                  <i className="yr-tape" aria-hidden="true" />
                </span>
                <div className="yr-photo-meta">
                  <b>
                    {pick(
                      locale,
                      stats.latestTrip.placeEn ?? stats.latestTrip.place,
                      stats.latestTrip.place,
                    )}
                  </b>
                  <span>
                    {pick(locale, stats.latestTrip.dateEn ?? stats.latestTrip.date, stats.latestTrip.date)}
                  </span>
                  <p>{pick(locale, stats.latestTrip.noteEn ?? stats.latestTrip.note, stats.latestTrip.note)}</p>
                  <Link className="yr-link" href="/travel">
                    <T en="Open the travel archive" zh="打开旅行档案" /> →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============ 5 书架 ============ */}
        <section className={`yr-card ${step === 5 ? "is-active" : ""}`} data-step="5">
          <div className="yr-inner">
            <p className="yr-label yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              <T en="05 · BOOKS" zh="05 · 书架" />
            </p>
            <div className="yr-figures">
              <div className="yr-fig yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
                <strong>
                  ×<CountUp to={BOOKS.length} active={step === 5} />
                </strong>
                <span>
                  <T en="books on the shelf this year" zh="今年书架收录" />
                </span>
              </div>
            </div>
            <div className="yr-shelf yr-anim" style={{ "--i": 2 } as React.CSSProperties}>
              {BOOKS.map((b, i) => (
                <div className="yr-book" key={b.title} style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                  <i style={{ background: b.color }} aria-hidden="true" />
                  <b>{b.title}</b>
                  <em aria-label={`${b.stars} 星`}>
                    {"★".repeat(b.stars)}
                    {"☆".repeat(5 - b.stars)}
                  </em>
                </div>
              ))}
            </div>
            <p className="yr-note yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
              <T
                en="Hover the real bookshelf on the homepage — every spine pulls out with a note."
                zh="首页的书架可以互动——每本书抽出来都有一条批注。"
              />
              <Link className="yr-link" href="/#about">
                <T en="Go pull one out" zh="去抽一本" /> →
              </Link>
            </p>
          </div>
        </section>

        {/* ============ 6 海报 ============ */}
        <section className={`yr-card ${step === 6 ? "is-active" : ""}`} data-step="6">
          <div className="yr-inner yr-finale">
            <p className="yr-label yr-anim" style={{ "--i": 0 } as React.CSSProperties}>
              <T en="06 · POSTER" zh="06 · 海报" />
            </p>
            <div className="yr-poster yr-anim" style={{ "--i": 1 } as React.CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE_PATH}/year/opengraph-image`}
                alt={`${year} 年度报告海报`}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="yr-poster-stamp" aria-hidden="true">
                <T en="UNOFFICIAL · MID-YEAR" zh="非官方 · 中期版" />
              </span>
            </div>
            <div className="yr-actions yr-anim" style={{ "--i": 2 } as React.CSSProperties}>
              <button className="btn btn-primary" onClick={share}>
                {copied ? (
                  <T en="Link copied ✓" zh="链接已复制 ✓" />
                ) : (
                  <T en="Copy & share this report" zh="复制链接，分享这份报告" />
                )}
              </button>
              <Link className="btn btn-ghost" href="/room">
                <T en="Visit my room →" zh="来我的房间坐坐 →" />
              </Link>
            </div>
            <p className="yr-note yr-anim" style={{ "--i": 3 } as React.CSSProperties}>
              <T
                en="See you in the year-end edition. — generated from real data, updated as the year goes."
                zh="年终版再见。— 全部真实数据，随年份推进持续更新。"
              />
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
