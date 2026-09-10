import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/components/i18n";

export const metadata: Metadata = {
  title: "Now — 此刻",
  description: "我现在在做什么、学什么、玩什么。（nownownow.com 的个人版）",
};

/* 每隔一两个月更新这一页，保持“此刻”的真实性 */
const SECTIONS = [
  {
    title: "BUILDING",
    items: [
      {
        en: "CoreLayer — A local-first desktop control plane for autonomous AI agents built with Tauri 2 and Rust",
        zh: "CoreLayer — 基于 Tauri 2 + Rust 构建的本地优先 AI Agent 桌面指挥台",
      },
      {
        en: "Encounter & TaskFlow — Refining end-to-end encrypted intimacy log & cognitive-load task OS",
        zh: "Encounter & TaskFlow — 持续迭代端到端加密伴侣空间与认知负荷任务系统",
      },
    ],
  },
  {
    title: "LEARNING",
    items: [
      {
        en: "Rust systems programming, Tokio async concurrency, and Model Context Protocol (MCP)",
        zh: "Rust 系统级编程、Tokio 异步并发机制与 Model Context Protocol (MCP)",
      },
      {
        en: "Re-reading 'The Pragmatic Programmer' & exploring 2026 spatial web aesthetics",
        zh: "重读《程序员修炼之道》& 探索 2026 前沿空间感界面交互与微动效",
      },
    ],
  },
  {
    title: "LIVING",
    items: [
      {
        en: "Bench Press 100KG maintenance (and strictly avoiding squats on leg days)",
        zh: "稳固 100KG 卧推常规组（并在练腿日理直气壮地喝蛋白粉）",
      },
      {
        en: "Durham riverside trail runs & planning the next European highland roadtrip",
        zh: "杜伦河畔晨跑散步 & 筹划下一站欧洲高地自驾公路行",
      },
    ],
  },
];

export default function NowPage() {
  return (
    <main className="archive">
      <header className="archive-head">
        <p className="eyebrow">NOW — 此刻</p>
        <h1>
          <T
            en={
              <>
                What I&apos;m
                <br />
                up to now.
              </>
            }
            zh={<>最近在忙什么。</>}
          />
        </h1>
        <p className="archive-stats">
          <T
            en="Inspired by nownownow.com · last updated: September 2026"
            zh="灵感来自 nownownow.com · 上次更新：2026 年 9 月"
          />
        </p>
      </header>

      {SECTIONS.map((s) => (
        <section className="archive-group" key={s.title}>
          <h2 className="group-title">
            {s.title}
            <span>
              <T en={`${s.items.length} items`} zh={`${s.items.length} 条`} />
            </span>
          </h2>
          <ul className="dot-list now-list">
            {s.items.map((item) => (
              <li key={item.en}>
                <T en={item.en} zh={item.zh} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="archive-foot">
        <Link href="/">BACK TO HOME ↑</Link>
      </p>
    </main>
  );
}
