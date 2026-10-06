"use client";

/* ============================================================
 * NowLive —— /now 页的实时数据条
 *
 * /now 的宿敌是「过时」：手写 SECTIONS 一两个月才更新一次。
 * 这三条从站内已有数据源自动同步，永远和现实一致：
 *   READING ← data/books.ts 的 reading/progress（首页书架同一份）
 *   MUSIC   ← /api/stats（网易云，useMusic 60s 缓存）
 *   CODE    ← GitHub API（年报页同一套 fetchGitHubYear）
 * 接口不可用时不假装有数据：显示降级文案。
 * ============================================================ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BOOKS } from "@/data/books";
import { useMusic, type MusicStats } from "@/lib/music";
import { fetchGitHubYear, type GitHubYearStats } from "@/lib/github";
import { T } from "./i18n";

export default function NowLive() {
  const reading = BOOKS.find((b) => b.reading);
  const stats = useMusic<MusicStats>("/api/stats", 300_000);
  const [gh, setGh] = useState<GitHubYearStats | null>(null);
  const year = typeof window === "undefined" ? 2026 : new Date().getFullYear();

  useEffect(() => {
    let alive = true;
    fetchGitHubYear(String(new Date().getFullYear()))
      .then((d) => alive && setGh(d))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const musicBody = stats.data?.ok
    ? `Lv.${stats.data.level ?? "-"} · 红心 ${stats.data.likedCount ?? "-"} 首 · 累计 ${Math.round((stats.data.totalMinutes ?? 0) / 60)} 小时`
    : stats.settled
      ? null
      : undefined; /* undefined = 还在同步 */

  const ghOk = gh && !gh.failed && (gh.pushedThisYear ?? 0) > 0;
  const codeBody = ghOk
    ? `${gh!.pushedThisYear} 个活跃仓库${gh!.top?.[0] ? ` · ${gh!.top[0].name} ★${gh!.top[0].stars}` : ""}`
    : gh
      ? null
      : undefined;

  const cards = [
    {
      key: "reading",
      label: "READING · 在读",
      href: "/#about",
      external: false,
      body: reading ? (
        <>
          《{reading.title}》 <b>{reading.progress ?? "?"}%</b>
        </>
      ) : null,
    },
    {
      key: "music",
      label: "MUSIC · 网易云",
      href: "/#now-playing",
      external: false,
      body: musicBody,
    },
    {
      key: "code",
      label: `CODE · ${year} GITHUB`,
      href: gh?.top?.[0]?.url ?? "https://github.com/alvinluo-tech",
      external: true,
      body: codeBody,
    },
  ];

  return (
    <section className="now-live" aria-label="实时数据">
      <p className="now-live-head">
        <span className="now-live-dot" aria-hidden="true" />
        <T en="LIVE — synced from this site's real data, never hand-updated" zh="LIVE — 由本站真实数据自动同步，永不手更" />
      </p>
      <div className="now-live-grid">
        {cards.map((c) => {
          const inner = (
            <>
              <span className="now-live-label">{c.label}</span>
              <span className="now-live-body">
                {c.body === undefined ? (
                  <i className="now-live-loading">syncing…</i>
                ) : c.body === null ? (
                  <i className="now-live-loading">
                    <T en="source asleep" zh="数据源休息中" />
                  </i>
                ) : (
                  c.body
                )}
              </span>
            </>
          );
          return c.external ? (
            <a key={c.key} className="now-live-card" href={c.href} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            <Link key={c.key} className="now-live-card" href={c.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
