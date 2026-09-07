"use client";

import { useEffect, useMemo, useState } from "react";
import { TRIPS, type Trip, countryLabel, dateLabel } from "@/data/trips";
import { T, pick, useLocale } from "./i18n";

/* GitHub Pages 子路径部署：构建时内联 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* /travel 归档页：全部足迹，按国家分组，可筛选 */
export default function TravelArchive() {
  const [filter, setFilter] = useState("全部");
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const { locale } = useLocale();

  /* “全部”筛选键在两种语言下都归一到 “全部” */
  const allLabel = locale === "zh" ? "全部" : "All";

  /* 国家 → 站数（筛选条用） */
  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of TRIPS) map.set(t.country, (map.get(t.country) ?? 0) + 1);
    return [...map.entries()];
  }, []);

  /* 当前筛选下的分组（保持首次出现的国家顺序） */
  const groups = useMemo(() => {
    const list =
      filter === allLabel ? TRIPS : TRIPS.filter((t) => t.country === filter);
    const map = new Map<string, Trip[]>();
    for (const t of list) {
      if (!map.has(t.country)) map.set(t.country, []);
      map.get(t.country)!.push(t);
    }
    return [...map.entries()];
  }, [filter, allLabel]);

  /* 占位框兜底：懒加载图片在水合前 404 时，onError 会错过 */
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
      document.querySelectorAll<HTMLImageElement>(".acard-photo img").forEach((img) => {
        if (img.complete && img.naturalWidth === 0) markFromSrc(img.src);
      });
    }, 1200);
    return () => {
      document.removeEventListener("error", onErr, true);
      clearTimeout(sweep);
    };
  }, [filter]);

  return (
    <main className="archive">
      <header className="archive-head">
        <p className="eyebrow">ARCHIVE — <span className="cn">全部足迹</span></p>
        <h1>
          <T
            en={
              <>
                Every stamp
                <br />
                in the passport.
              </>
            }
            zh={
              <>
                护照上的
                <br />
                每一枚印记。
              </>
            }
          />
        </h1>
        <p className="archive-stats">
          <T
            en={`${countryCounts.length} countries/regions · ${TRIPS.length} stops · more to come`}
            zh={`${countryCounts.length} 国家/地区 · ${TRIPS.length} 站 · 持续更新`}
          />
        </p>

        <div className="filter-row" role="group" aria-label={pick(locale, "Filter by country", "按国家筛选")}>
          <button
            className={filter === allLabel ? "chip is-active" : "chip"}
            onClick={() => setFilter(allLabel)}
          >
            {allLabel} {TRIPS.length}
          </button>
          {countryCounts.map(([c, n]) => {
            const sample = TRIPS.find((t) => t.country === c);
            return (
              <button
                key={c}
                className={filter === c ? "chip is-active" : "chip"}
                onClick={() => setFilter(c)}
              >
                {sample ? countryLabel(sample, locale) : c} {n}
              </button>
            );
          })}
        </div>
      </header>

      {groups.map(([country, trips]) => (
        <section className="archive-group" key={country}>
          <h2 className="group-title">
            {countryLabel(trips[0], locale)}
            <span>
              <T en={`${trips.length} stops`} zh={`${trips.length} 站`} />
            </span>
          </h2>
          <div className="archive-grid">
            {trips.map((t, i) => (
              <figure
                className="postcard acard"
                key={t.img}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="postcard-photo">
                  {failed[t.img] ? (
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
                              public/travel/{t.img}.jpg
                            </>
                          }
                          zh={
                            <>
                              把照片放进
                              <br />
                              public/travel/{t.img}.jpg
                            </>
                          }
                        />
                      </p>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${BASE_PATH}/travel/${t.img}.jpg`}
                      alt={pick(locale, `Travel photo of ${t.place}`, `${t.place} 的旅行照片`)}
                      onError={() => setFailed((f) => ({ ...f, [t.img]: true }))}
                    />
                  )}
                  <span className="country-chip">{countryLabel(t, locale)}</span>
                </div>
                <figcaption>
                  <b>{t.place}</b>
                  <span>
                    {dateLabel(t, locale)} — <T en={t.noteEn ?? t.note} zh={t.note} />
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <p className="archive-foot">
        <T en="Next stop? — " zh="下一站？ — " />
        <a href="/">BACK TO HOME ↑</a>
      </p>
    </main>
  );
}
