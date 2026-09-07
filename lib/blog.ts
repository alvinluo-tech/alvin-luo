/* 博客数据层：构建时读取 content/blog/*.md（服务端专用） */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked, Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/common";

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  updated: string;
  category: string;
  tags: string[];
  summary: string;
  cover: string;
  pinned: boolean;
  source: string;
  readingMinutes: number;
  toc: { id: string; text: string; depth: number }[];
};

export type Post = PostMeta & { html: string };

const DIR = path.join(process.cwd(), "content", "blog");
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

let cache: PostMeta[] | null = null;

/* 稳定的标题 id（支持中文） */
function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[!-/:-@[-`{-~]/g, "")
    .slice(0, 60);
}

/* 阅读时长：中文字符 /400 + 英文词 /200，每分钟 */
function readingMinutes(text: string) {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = text
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 200));
}

/* 渲染器：代码高亮 + 标题锚点 id + 抽取目录 */
function makeMarkdown() {
  const toc: { id: string; text: string; depth: number }[] = [];
  const used = new Set<string>();
  const md = new Marked(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
    {
      renderer: {
        heading({ tokens, depth }: { tokens: unknown[]; depth: number }) {
          // marked v12+ 的对象参数签名；tokens 解析交给 parser
          const text = (tokens as { raw?: string }[])
            .map((t) => (t as { raw?: string }).raw ?? "")
            .join("")
            .replace(/<[^>]+>/g, "")
            .trim();
          let id = slugify(text) || `h-${depth}`;
          let n = 2;
          while (used.has(id)) id = `${id}-${n++}`;
          used.add(id);
          if (depth === 2 || depth === 3) toc.push({ id, text, depth });
          const inner = this.parser.parseInline(tokens as never);
          return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
        },
      },
    },
  );
  return { md, toc };
}

export function getAllPosts(): PostMeta[] {
  if (cache) return cache;
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
  const posts = files.map((f) => {
    const raw = fs.readFileSync(path.join(DIR, f), "utf8");
    const { data, content } = matter(raw);
    return {
      slug: data.slug,
      title: data.title,
      date: data.date,
      updated: data.updated || data.date,
      category: data.category,
      tags: data.tags || [],
      summary: data.summary || "",
      cover: data.cover || "",
      pinned: !!data.pinned,
      source: data.source || "",
      readingMinutes: readingMinutes(content),
      toc: [],
    };
  });
  // 置顶优先，其余按日期倒序
  posts.sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date),
  );
  cache = posts;
  return posts;
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

export function getPost(slug: string): Post | null {
  const meta = getAllPosts().find((p) => p.slug === slug);
  if (!meta) return null;
  const raw = fs.readFileSync(path.join(DIR, slug + ".md"), "utf8");
  const { content } = matter(raw);
  // 正文自带的一级标题与页面标题重复，去掉首个 h1
  const body = content.replace(/^\s*#\s+.+?\n/, "");
  const { md, toc } = makeMarkdown();
  // 静态导出部署在子路径时，正文内的本地图片需要带上 basePath
  const html = md
    .parse(body, { async: false })
    .replaceAll('src="/blog/', `src="${BASE_PATH}/blog/`);
  return { ...meta, toc, html };
}

export const CATEGORY_LABELS: Record<string, string> = {
  projects: "PROJECTS",
  life: "LIFE",
  course: "COURSE",
};
