"use client";

/* 页脚简历直下口：跟随界面语言指向对应 PDF。
   放在 client 侧是因为 locale 存在 localStorage，服务端无法预知。 */

import { RESUME_BY_LOCALE } from "@/lib/resume";
import { useLocale } from "./i18n";

export default function FooterResumeLink() {
  const { locale } = useLocale();
  const r = RESUME_BY_LOCALE[locale];
  return (
    <a href={r.pdf} download={r.pdfName}>
      RÉSUMÉ ↧
    </a>
  );
}
