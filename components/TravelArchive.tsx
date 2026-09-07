"use client";

import { useEffect, useMemo, useState } from "react";
import { TRIPS, type Trip, countryLabel, dateLabel } from "@/data/trips";
import { T, pick, useLocale } from "./i18n";
import WorldMap from "./WorldMap";

/* GitHub Pages 子路径部署：构建时内联 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* /travel 归档页：全部足迹，按国家分组，可筛选 */
const ALL = "__all__"; // “全部”筛选的哨兵值（避免和语言相关的文案比较）
export default function TravelArchive() {
  const [filter, setFilter] = useState(ALL);
  const [focusedCity, setFocusedCity] = useState<string | null>(null);
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
      filter === ALL ? TRIPS : TRIPS.filter((t) => t.country === filter);
    const map = new Map<string, Trip[]>();
    for (const t of list) {
      if (!map.has(t.country)) map.set(t.country, []);
      map.get(t.country)!.push(t);
    }
    return [...map.entries()];
  }, [filter, allLabel]);

  /* 地图点击城市 / 首页直达：相机平滑飞入 + 展开拍立得 + 滚动定位到相册卡片金光高亮 */
  function focusCity(img: string) {
    const trip = TRIPS.find((t) => t.img === img);
    if (!trip) return;
    setFilter(ALL);
    setFocusedCity(img);
    setTimeout(() => {
      const card = document.getElementById(`trip-card-${img}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("is-target-flash");
        setTimeout(() => card.classList.remove("is-target-flash"), 2500);
      } else {
        const group = document.getElementById(`group-${trip.country}`);
        if (!group) return;
        group.scrollIntoView({ behavior: "smooth", block: "start" });
        const title = group.querySelector(".group-title");
        title?.classList.add("is-flash");
        setTimeout(() => title?.classList.remove("is-flash"), 2200);
      }
    }, 850);
  }

  /* 首页胶片跳转深链接动效：读取 ?stop=01 或 ?country=... */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const stopParam = params.get("stop");
    const countryParam = params.get("country");

    if (countryParam) {
      setFilter(countryParam);
      setTimeout(() => {
        const group = document.getElementById(`group-${countryParam}`);
        group?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    } else if (stopParam) {
      // 延迟 300ms 等待页面和 D3 初始化
      setTimeout(() => {
        focusCity(stopParam);
      }, 350);
    }
  }, []);

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
            className={filter === ALL ? "chip is-active" : "chip"}
            onClick={() => setFilter(ALL)}
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

        {/* 城市脉冲导航条：点亮去过的每一站，点击雷达式聚焦到对应分组 */}
        <div className="city-strip" role="group" aria-label={pick(locale, "Stops", "足迹站点")}>
          {TRIPS.map((t) => (
            <button
              key={t.img}
              className={filter === ALL || filter === t.country ? "city is-lit" : "city"}
              title={`${t.place} · ${t.date}`}
              onClick={() => {
                setFilter(ALL);
                requestAnimationFrame(() => {
                  document
                    .getElementById(`group-${t.country}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            >
              <span className="city-dot" aria-hidden="true" />
              <span className="city-name">{t.place.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </header>

      {/* 足迹地图：脉冲点点击 → flyTo 聚焦 + 滚动到对应国家分组 */}
      <div className="archive-map" id="archive-map">
        <WorldMap onCityClick={focusCity} focusedCity={focusedCity} />
      </div>

      {groups.map(([country, trips]) => (
        <section className="archive-group" id={`group-${country}`} key={country}>
          <h2 className="group-title">
            {countryLabel(trips[0], locale)}
            <span>
              <T en={`${trips.length} stops`} zh={`${trips.length} 站`} />
            </span>
          </h2>
          <div className="archive-grid">
            {trips.map((t, i) => (
              <figure
                id={`trip-card-${t.img}`}
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
