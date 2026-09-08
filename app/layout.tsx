import type { Metadata } from "next";
import Script from "next/script";
import { Mona_Sans } from "next/font/google";
import Nav from "@/components/Nav";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollFX from "@/components/ScrollFX";
import SmoothScroll from "@/components/SmoothScroll";
import Palette from "@/components/Palette";
import { LocaleProvider } from "@/components/i18n";
import { SITE_URL } from "@/config/site";
import { getAllPosts, CATEGORY_LABELS } from "@/lib/blog";
import "./globals.css";

/* Mona Sans：landonorris.com 同款字体（GitHub 开源、Google Fonts 托管），
   next/font 会在构建时自托管，无布局抖动、无额外请求 */
const mona = Mona_Sans({
  subsets: ["latin"],
  variable: "--font-mona",
  display: "swap",
});

/* TODO: 换域名时只需改这里（sitemap / RSS / OG 卡片都从这里取基础地址） */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Alvin Luo — I build things, including myself.",
    template: "%s",
  },
  description: "白天构建产品，空闲构建自己。Software engineer who also lifts.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "alvin.luo",
    title: "Alvin Luo — I build things, including myself.",
    description: "白天构建产品，空闲构建自己。Software engineer who also lifts.",
    images: [{ url: "opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alvin Luo — I build things, including myself.",
    description: "白天构建产品，空闲构建自己。Software engineer who also lifts.",
  },
  alternates: {
    types: { "application/rss+xml": `${SITE_URL}/rss.xml` },
  },
};

/* 主题防闪烁：渲染前从 localStorage / 系统偏好读主题 */
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={mona.variable} suppressHydrationWarning>
      <body>
        {/* 工程制图装饰层：四角刻度与准星（纯装饰） */}
        <div className="blueprint" aria-hidden="true">
          <span className="bp tl">[0,0]</span>
          <span className="bp tr">+</span>
          <span className="bp bl">+</span>
          <span className="bp br">ALVIN.LUO — v2.0</span>
        </div>
        {/* 主题防闪烁：beforeInteractive 注入 head，先于首帧执行 */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Umami 访问统计（隐私友好、无 cookie） */}
        <Script src="https://cloud.umami.is/script.js" data-website-id="e420f55f-cf8c-452d-8155-b21dedaee1bd" strategy="afterInteractive" />
        <LocaleProvider>
          <Nav />
          <span id="top" />
          {children}
          <Palette
            posts={getAllPosts().map((p) => ({
              label: p.title,
              href: `/blog/${p.slug}`,
              hint: "post",
              keywords: [CATEGORY_LABELS[p.category] ?? p.category, ...p.tags].join(" "),
            }))}
          />
          <ScrollReveal />
          <ScrollFX />
          <SmoothScroll />
          <footer className="footer">
            <span>© {new Date().getFullYear()} ALVIN LUO</span>
            <a href="#top">BACK TO TOP ↑</a>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
