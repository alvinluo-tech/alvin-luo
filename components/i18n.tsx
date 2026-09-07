"use client";

/* ============================================================
 * 轻量双语方案：LocaleProvider + T 组件
 *
 * · 默认英文（排版按英文设计），切换结果存 localStorage
 * · T 直接接收 en/zh 两个文案（可在服务端组件里用，
 *   props 可序列化），无需集中字典，文案与使用处同址
 * · 固定英文的视觉标识（巨型排版/跑马灯/胶囊/eyebrow）
 *   不进本系统，双语下渲染一致
 * ============================================================ */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "zh";

const LocaleCtx = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "en", setLocale: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("locale");
      if (saved === "zh" || saved === "en") setLocaleState(saved);
    } catch {
      /* 隐私模式忽略 */
    }
  }, []);

  /* 同步 <html lang>（初始渲染也在挂载时校正一次） */
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("locale", l);
    } catch {
      /* 隐私模式忽略 */
    }
  };

  return (
    <LocaleCtx.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleCtx.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleCtx);
}

/** 双语文案：en/zh 传字符串或 JSX，按当前语言渲染 */
export function T({ en, zh }: { en: ReactNode; zh: ReactNode }) {
  const { locale } = useLocale();
  return <>{locale === "zh" ? zh : en}</>;
}

/** 字符串版 T：用于 aria-label、alt 等必须是 string 的属性 */
export function pick(locale: Locale, en: string, zh: string) {
  return locale === "zh" ? zh : en;
}
