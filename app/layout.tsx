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
        {/* 主题防闪烁：beforeInteractive 注入 head，先于首帧执行 */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInit }} />
        <LocaleProvider>
          <Nav />
          <span id="top" />
          {children}
          <Palette />
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
