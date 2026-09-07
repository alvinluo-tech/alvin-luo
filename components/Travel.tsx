"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TRIPS, type Trip, countryLabel, dateLabel } from "@/data/trips";
import { T, pick, useLocale } from "./i18n";

/* GitHub Pages 子路径部署：构建时内联 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* 首页胶片只放精选站；一份数据源见 data/trips.ts */
const FILM_TRIPS = (() => {
  const featured = TRIPS.filter((t) => t.featured);
  return featured.length >= 3 ? featured : TRIPS.slice(0, 8);
})();

/* 章节卡：同一国家连续多站时，自动在组前插入分隔卡 */
type FilmItem =
  | { kind: "chapter"; country: string; count: number; key: string }
  | { kind: "trip"; trip: Trip; key: string };

const FILM: FilmItem[] = (() => {
  const items: FilmItem[] = [];
  for (let i = 0; i < FILM_TRIPS.length; i++) {
    const t = FILM_TRIPS[i];
    if (t.country !== FILM_TRIPS[i - 1]?.country) {
      // 数一下连续同国家的站数，>=2 才值得开章节
      let run = 1;
      while (FILM_TRIPS[i + run]?.country === t.country) run++;
      if (run >= 2) {
        items.push({ kind: "chapter", country: t.country, count: run, key: `chapter-${t.country}` });
      }
    }
    items.push({ kind: "trip", trip: t, key: t.img });
  }
  return items;
})();

export default function Travel() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const { locale } = useLocale();

  /* 国家/地区去重计数（护照印章用） */
  const countries = new Set(TRIPS.map((t) => t.country));

  /* 站数多时自动切换紧凑卡片，防止胶片过长显得冗余 */
  const dense = FILM.length > 11;

  /* 占位框兜底：懒加载图片可能在 React 水合前就 404 了，
     onError 会错过那次错误 —— 用捕获监听 + 延迟扫描双保险 */
  useEffect(() => {
    const markFromSrc = (src: string) => {
      const m = src.match(/travel\/(\d+)\.jpg/);
      if (m) setFailed((f) => (f[m[1]] ? f : { ...f, [m[1]]: true }));
    };
    const onErr = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLImageElement) markFromSrc(t.src);
    };
    document.addEventListener("error", onErr, true);
    const sweep = setTimeout(() => {
      document.querySelectorAll<HTMLImageElement>(".postcard-photo img").forEach((img) => {
        if (img.complete && img.naturalWidth === 0) markFromSrc(img.src);
      });
    }, 1200);
    return () => {
      document.removeEventListener("error", onErr, true);
      clearTimeout(sweep);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    /* 减少动效 / 窄屏：不钉住，退化为原生横向滑动 */
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !matchMedia("(min-width: 901px)").matches
    ) {
      return;
    }

    let ticking = false;
    const applyHeight = () => {
      // 区块高度 = 一屏 + 胶片溢出量（滚动距离与横移 1:1，再多也不“卡”）
      if (!matchMedia("(min-width: 901px)").matches) {
        section.style.height = "";
        return;
      }
      const wrap = track.parentElement;
      if (!wrap) return;
      const overflow = Math.max(0, track.scrollWidth - wrap.clientWidth);
      const h = Math.min(
        window.innerHeight * 4.8,
        Math.max(window.innerHeight * 2.2, window.innerHeight + overflow),
      );
      section.style.height = `${Math.round(h)}px`;
    };
    const update = () => {
      ticking = false;
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      section.style.setProperty("--tp", p.toFixed(4));
      const wrap = track.parentElement;
      if (!wrap) return;
      const overflow = Math.max(0, track.scrollWidth - wrap.clientWidth);
      track.style.transform = `translate3d(${(-p * overflow).toFixed(1)}px, 0, 0)`;
      // 站数计数：让用户知道“没卡住，在第几站”
      if (countRef.current) {
        const stations = FILM_TRIPS.length;
        const cur = Math.min(stations, Math.floor(p * stations) + 1);
        countRef.current.textContent = `${String(cur).padStart(2, "0")} / ${String(stations).padStart(2, "0")} 站`;
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    const onResize = () => {
      applyHeight();
      onScroll();
    };
    applyHeight();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section className={dense ? "travel is-dense" : "travel"} id="travel" ref={sectionRef}>
      <div className="travel-pin">
        <div className="travel-head">
          <p className="eyebrow">
            <T en="PASSPORT" zh="PASSPORT — 足迹" />
          </p>
          <div className="travel-head-row">
            <h2>
              <T
                en={
                  <>
                    Code travels.
                    <br />
                    So do I.
                  </>
                }
                zh={
                  <>
                    代码去远方，
                    <br />
                    我也是。
                  </>
                }
              />
            </h2>
            {/* 护照印章：去过几国几城，一眼可见 */}
            <div
              className="passport-stamp"
              aria-label={pick(
                locale,
                `Visited ${countries.size} countries/regions`,
                `去过 ${countries.size} 个国家和地区`,
              )}
            >
              <b>{countries.size}</b>
              <span>
                <T en="countries" zh="国家 / 地区" />
                <br />
                <T en={`${TRIPS.length} stops`} zh={`${TRIPS.length} 站`} />
              </span>
            </div>
            <Link className="travel-all" href="/travel">
              <T
                en={
                  <>
                    Full archive
                    <br />
                    ALL STAMPS →
                  </>
                }
                zh={
                  <>
                    全部足迹
                    <br />
                    ARCHIVE →
                  </>
                }
              />
            </Link>
          </div>
        </div>

        <div className="travel-track" ref={trackRef}>
          {FILM.map((item) =>
            item.kind === "chapter" ? (
              /* 章节分隔卡：同一国家连续多站（点击筛选该国家足迹） */
              <Link
                href={`/travel?country=${encodeURIComponent(item.country)}`}
                className="postcard postcard-chapter postcard-link"
                key={item.key}
                title={pick(locale, `View all ${item.country} stops in archive`, `在归档中查看${item.country}所有足迹`)}
              >
                <div className="chapter-inner">
                  <span className="chapter-label">CHAPTER</span>
                  <b>
                    {countryLabel(
                      FILM_TRIPS.find((t) => t.country === item.country) ??
                        ({ country: item.country } as Trip),
                      locale,
                    )}
                  </b>
                  <span className="chapter-count">
                    <T en={`${item.count} stops →`} zh={`${item.count} 站 →`} />
                  </span>
                </div>
              </Link>
            ) : (
              /* 明信片照片卡片：点击直达 /travel 地图聚焦 + 相册卡片高亮 */
              <Link
                href={`/travel?stop=${item.trip.img}`}
                className="postcard postcard-link"
                key={item.key}
                title={pick(locale, `Explore ${item.trip.place} on map & stories`, `在足迹地图与相册中查看 ${item.trip.place}`)}
              >
                <div className="postcard-photo">
                  {failed[item.trip.img] ? (
                    <div className="photo-placeholder">
                      <span className="plane" aria-hidden="true">
                        ✈
                      </span>
                      <p>
                        <T
                          en={
                            <>
                              Drop your photo at
                              <br />
                              public/travel/{item.trip.img}.jpg
                            </>
                          }
                          zh={
                            <>
                              把照片放进
                              <br />
                              public/travel/{item.trip.img}.jpg
                            </>
                          }
                        />
                      </p>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${BASE_PATH}/travel/${item.trip.img}.jpg`}
                      alt={pick(
                        locale,
                        `Travel photo of ${item.trip.place}`,
                        `${item.trip.place} 的旅行照片`,
                      )}
                      loading="lazy"
                      onError={() => setFailed((f) => ({ ...f, [item.trip.img]: true }))}
                    />
                  )}
                  <span className="postcard-no">N°{item.trip.img}</span>
                  <span className="country-chip">{countryLabel(item.trip, locale)}</span>
                  <span className="postcard-explore-hint">
                    {locale === "en" ? "EXPLORE ↗" : "探索本站 ↗"}
                  </span>
                </div>
                <figcaption>
                  <b>{item.trip.place}</b>
                  <span>
                    {dateLabel(item.trip, locale)} —{" "}
                    <T
                      en={item.trip.noteEn ?? item.trip.note}
                      zh={item.trip.note}
                    />
                  </span>
                </figcaption>
              </Link>
            ),
          )}

          {/* 叙事收尾：下一站（点击直接进入全量足迹地图） */}
          <Link
            href="/travel"
            className="postcard postcard-next postcard-link"
            title={locale === "en" ? "Explore full travel map" : "查看全部足迹地图"}
          >
            <div className="next-inner">
              <span className="plane-big" aria-hidden="true">
                ✈
              </span>
              <b>
                <T en="Next stop?" zh="下一站？" />
              </b>
              <span>ALL FOOTPRINTS →</span>
            </div>
          </Link>
        </div>

        {/* 胶片进度条 + 站数计数 */}
        <div className="travel-progress-row" aria-hidden="true">
          <div className="travel-progress">
            <i />
          </div>
          <span className="travel-count" ref={countRef}>
            01 / {String(FILM_TRIPS.length).padStart(2, "0")} 站
          </span>
        </div>
      </div>
    </section>
  );
}
