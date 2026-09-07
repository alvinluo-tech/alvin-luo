import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, CATEGORY_LABELS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Writing — Alvin Luo",
  description: "写代码之余的思考、记录与笔记：项目复盘、留学生活、自我反思。",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <main className="archive">
      <header className="archive-head">
        <p className="eyebrow">WRITING — <span className="cn">随笔与复盘</span></p>
        <h1>
          Notes from
          <br />
          the build log.
        </h1>
        <p className="archive-stats">{posts.length} posts · 持续更新</p>
      </header>

      <div className="post-list">
        {posts.map((p) => (
          <Link href={`/blog/${p.slug}`} className="post-row" key={p.slug}>
            <span className="post-date">{p.date}</span>
            <div>
              <h2 className="post-title">
                {p.pinned && <span className="post-pin">★ </span>}
                {p.title}
              </h2>
              {p.summary && <p className="post-desc">{p.summary}</p>}
              <p className="post-meta-line">
                <span className="post-cat">{CATEGORY_LABELS[p.category] || p.category}</span>
                {p.tags.slice(0, 4).map((t) => (
                  <span className="post-tag" key={t}>
                    {t}
                  </span>
                ))}
              </p>
            </div>
            <span className="post-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>

      <p className="archive-foot">
        <Link href="/">BACK TO HOME ↑</Link>
      </p>
    </main>
  );
}
