"use client";

/* ============================================================
 * ResumeSheet — 简历纸面（/resume 与房间/终端共用）
 *
 * 内容来自 lib/resume.ts（唯一数据源，与两份 PDF 同步维护）。
 * 中英文各一整套数据，跟随界面语言切换：纸面正文、分节顺序
 * （英文版项目在实习之前）与下载的 PDF 都随语言变化。
 *
 * 设计语言与站点一致：纸面 + 墨线 + lime 强调 + 等宽元信息。
 * 每条可验证的主张带「证据链接」——招聘者看十份 PDF，
 * 只有这一份能点回站内实证。
 * ============================================================ */

import type { ReactNode } from "react";
import { RESUME_BY_LOCALE, type ResumeData, type SectionId } from "@/lib/resume";
import { useLocale } from "./i18n";

/** 把 PDF 里的 **粗体** 渲染成 <b>（不注入 HTML） */
function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p))}
    </>
  );
}

function SectionTitle({ main, sub }: { main: string; sub?: string }) {
  return (
    <h2 className="rs-h2">
      <span className="rs-h2-zh">{main}</span>
      {sub && <span className="rs-h2-en">{sub}</span>}
    </h2>
  );
}

function Bullets({ items }: { items: { text: string }[] }) {
  return (
    <ul className="rs-bullets">
      {items.map((b, i) => (
        <li key={i}>
          <Rich text={b.text} />
        </li>
      ))}
    </ul>
  );
}

function Verify({ v }: { v: { label: string; href: string } }) {
  return (
    <a
      className="rs-verify"
      href={v.href}
      target={v.href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
    >
      ✓ {v.label} ↗
    </a>
  );
}

function renderSection(id: SectionId, R: ResumeData, t: { main: string; sub?: string }): ReactNode {
  switch (id) {
    case "education":
      return (
        <>
          <SectionTitle {...t} />
          {R.education.map((e) => (
            <div className="rs-item" key={e.school}>
              <div className="rs-item-head">
                <h3>
                  {e.school}
                  {e.schoolEn && <span className="rs-item-sub">{e.schoolEn}</span>}
                  <span className="rs-item-mid">{"·\u00A0"}{e.degree}</span>
                </h3>
                <span className="rs-period">{e.period}</span>
              </div>
              {e.note && <p className="rs-note">{e.note}</p>}
              <p className="rs-majors">
                {e.majors.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </p>
              {e.verify && <Verify v={e.verify} />}
            </div>
          ))}
        </>
      );

    case "experience":
      return (
        <>
          <SectionTitle {...t} />
          {R.experience.map((x) => (
            <div className="rs-item" key={x.company}>
              <div className="rs-item-head">
                <h3>
                  {x.company}
                  <span className="rs-item-mid">{"·\u00A0"}{x.role}</span>
                </h3>
                <span className="rs-period">{x.period}</span>
              </div>
              <Bullets items={x.bullets} />
              {x.verify && <Verify v={x.verify} />}
            </div>
          ))}
        </>
      );

    case "projects":
      return (
        <>
          <SectionTitle {...t} />
          {R.projects.map((p) => (
            <div className="rs-item" key={p.name}>
              <div className="rs-item-head">
                <h3>
                  {p.name}
                  <span className="rs-item-mid">—{"\u00A0"}{p.tagline}</span>
                </h3>
                <span className="rs-period">{p.period}</span>
              </div>
              <p className="rs-proj-meta">
                {p.type}
                {p.meta ? ` · ${p.meta}` : ""}
              </p>
              {p.desc && <p className="rs-proj-desc">{p.desc}</p>}
              <Bullets items={p.bullets} />
              {p.verify && <Verify v={p.verify} />}
            </div>
          ))}
        </>
      );

    case "skills":
      return (
        <>
          <SectionTitle {...t} />
          <dl className="rs-skills">
            {R.skills.map((s) => (
              <div className="rs-skill-row" key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.items}</dd>
              </div>
            ))}
          </dl>
        </>
      );

    case "honors":
      return (
        <>
          <SectionTitle {...t} />
          <ul className="rs-honors">
            {R.honors.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="rs-langs">{R.languages}</p>
        </>
      );
  }
}

export default function ResumeSheet() {
  const { locale } = useLocale();
  const R = RESUME_BY_LOCALE[locale];

  return (
    <article className="rs" data-ver={R.updated} data-lang={locale}>
      {/* ---- 抬头 ---- */}
      <header className="rs-head">
        <div className="rs-id">
          <h1>
            {R.name}
            {R.nameEn && <span className="rs-name-en">{R.nameEn}</span>}
          </h1>
          {R.meta && <p className="rs-meta">{R.meta}</p>}
          <ul className="rs-contacts">
            {R.contacts.map((c) => (
              <li key={c.label}>
                <span className="rs-contact-label">{c.label}</span>
                <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                  {c.value}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="rs-actions">
          <a className="rs-btn rs-btn-primary" href={R.pdf} download={R.pdfName}>
            ↧ {locale === "zh" ? "下载 PDF" : "Download PDF"}
            <span className="rs-btn-sub">{R.pdfSize}</span>
          </a>
          <button type="button" className="rs-btn" onClick={() => window.print()}>
            ⎙ {locale === "zh" ? "打印" : "Print"}
          </button>
          <p className="rs-updated">
            {locale === "zh" ? `PDF 版本 ${R.updated}` : `PDF · ${R.updated}`}
          </p>
          <a className="rs-alt-pdf" href={R.altPdf.href} download={R.altPdf.name}>
            {R.altPdf.label} PDF · {R.altPdf.size} ↧
          </a>
        </div>
      </header>

      {R.sections.map((id) => (
        <section key={id} data-sec={id}>
          {renderSection(id, R, R.titles[id])}
        </section>
      ))}

      <footer className="rs-foot">
        {locale === "zh"
          ? "以上每条主张都可验证——链接通向站内活着的实证。手机号只在 PDF 里，邮箱一键即达。"
          : "Every claim above is verifiable — links lead to living proof on this site. The PDF keeps the phone number; email is one click away."}
      </footer>
    </article>
  );
}
