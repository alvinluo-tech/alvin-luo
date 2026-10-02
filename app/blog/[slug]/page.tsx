import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getPostSlugs, CATEGORY_LABELS } from "@/lib/blog";
import Toc from "@/components/Toc";
import CodeCopy from "@/components/CodeCopy";
import Lightbox from "@/components/Lightbox";
import CoverImage from "@/components/CoverImage";

/* 静态导出：为每篇文章生成一个页面 */
export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not found" };
  const title = `${post.title} — Alvin Luo`;
  return {
    title,
    description: post.summary,
    // 不写 openGraph 的话 og:title 会继承根 layout 的默认值，分享卡上不是文章标题
    openGraph: { title, description: post.summary, type: "article" },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <main className="post-page">
      <div className="post-layout">
        <article>
          <header className="post-head">
            <Link className="post-back" href="/blog">
              ← WRITING
            </Link>
            <h1>{post.title}</h1>
            <p className="post-head-meta">
              <time>{post.date}</time>
              {post.updated !== post.date && <span>· 更新于 {post.updated}</span>}
              <span>· {post.readingMinutes} min read · 约 {post.readingMinutes} 分钟</span>
              <span className="post-cat">
                {CATEGORY_LABELS[post.category] || post.category}
              </span>
            </p>
            <p className="post-head-tags">
              {post.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </p>
          </header>

          {/* 封面横幅：仅有真实照片封面的文章显示（无 cover 的文章
              不放 satori 标题卡——会与紧邻的 h1 标题视觉重复） */}
          {post.cover && (
            <CoverImage
              src={post.cover}
              fallback={`/blog/${slug}/opengraph-image`}
              alt={`${post.title} 封面`}
              className="post-cover-banner"
            />
          )}

          {/* 正文由构建时 Markdown 渲染（含旧站迁来的 HTML 块） */}
          <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />

          <footer className="post-foot">
            {post.source && (
              <a href={post.source} target="_blank" rel="noopener noreferrer">
                旧站原文 ↗
              </a>
            )}
            <Link href="/blog">← BACK TO WRITING</Link>
          </footer>
        </article>

        <Toc items={post.toc} />
      </div>
      <CodeCopy />
      <Lightbox />
    </main>
  );
}
