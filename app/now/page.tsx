import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/components/i18n";

export const metadata: Metadata = {
  title: "Now — 此刻",
  description: "我现在在做什么、学什么、玩什么。（nownownow.com 的个人版）",
};

/* TODO: 每隔一两个月更新这一页，保持“此刻”的真实性 */
const SECTIONS = [
  {
    title: "BUILDING",
    items: [
      { en: "TODO: the project you're building", zh: "TODO：正在构建的项目一句话" },
      { en: "TODO: another side project", zh: "TODO：另一个 side project" },
    ],
  },
  {
    title: "LEARNING",
    items: [
      { en: "TODO: tech / language you're learning", zh: "TODO：正在学的技术 / 语言" },
      { en: "TODO: book you're reading", zh: "TODO：正在读的书" },
    ],
  },
  {
    title: "LIVING",
    items: [
      { en: "TODO: current gym goal", zh: "TODO：最近的健身目标" },
      { en: "TODO: next trip on the map", zh: "TODO：下一站旅行计划" },
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
            en="Inspired by nownownow.com · last updated: TODO"
            zh="灵感来自 nownownow.com · 上次更新：TODO 日期"
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
