import type { Metadata } from "next";
import YearReport, { type YearStats } from "@/components/YearReport";
import { getAllPosts } from "@/lib/blog";
import { TRIPS } from "@/data/trips";

export const metadata: Metadata = {
  title: "2026 年度报告 — YEAR IN REVIEW",
  description:
    "用真实数据生成的年度报告：博客、GitHub、网易云音乐、旅行足迹、书架。年中持续更新中。",
};

/* 年度报告 = 构建时聚合站内真实数据（博客/旅行），客户端补实时源（GitHub/网易云） */
export default function YearPage() {
  const YEAR = "2026";
  const posts = getAllPosts()
    .filter((p) => p.date.startsWith(YEAR))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      category: p.category,
      readingMinutes: p.readingMinutes,
    }));
  const tripsInYear = TRIPS.filter((t) => t.date.includes(YEAR));
  const latest = tripsInYear[tripsInYear.length - 1] ?? null;

  const stats: YearStats = {
    year: YEAR,
    posts,
    tripsTotal: TRIPS.length,
    countries: new Set(TRIPS.map((t) => t.country)).size,
    latestTrip: latest
      ? {
          place: latest.place,
          date: latest.date,
          dateEn: latest.dateEn,
          note: latest.note,
          noteEn: latest.noteEn,
          img: latest.img,
        }
      : null,
  };

  return <YearReport stats={stats} />;
}
