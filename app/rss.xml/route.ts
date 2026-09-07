import { getAllPosts, getPost } from "@/lib/blog";
import { SITE_URL } from "@/config/site";

/* 构建时生成 RSS 全文订阅源（静态导出为 /rss.xml） */
export const dynamic = "force-static";

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function GET() {
  const base = SITE_URL.replace(/\/$/, "");
  const posts = getAllPosts();

  const items = posts
    .map((meta) => {
      const post = getPost(meta.slug)!;
      const url = `${base}/blog/${meta.slug}`;
      return `    <item>
      <title>${escapeXml(meta.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(meta.date).toUTCString()}</pubDate>
      <description>${escapeXml(meta.summary)}</description>
      <category>${escapeXml(meta.category)}</category>
      <content:encoded><![CDATA[${post.html}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Alvin Luo — I build things, including myself.</title>
    <link>${base}</link>
    <description>白天构建产品，空闲构建自己。项目复盘、留学生活与自我反思。</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date(posts[0]?.date || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
