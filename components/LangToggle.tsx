"use client";

import { useLocale, type Locale } from "./i18n";

/* 语言切换器：EN / 中 分段控件，样式与主题按钮同族 */
export default function LangToggle() {
  const { locale, setLocale } = useLocale();

  const btn = (l: Locale, label: string) => (
    <button
      className={locale === l ? "is-active" : undefined}
      onClick={() => setLocale(l)}
      aria-pressed={locale === l}
      aria-label={l === "en" ? "Switch to English" : "切换到中文"}
    >
      {label}
    </button>
  );

  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {btn("en", "EN")}
      {btn("zh", "中")}
    </div>
  );
}
