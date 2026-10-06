"use client";

/* ============================================================
 * ResumeSheet — 简历纸面（/resume 与房间/终端共用）
 *
 * 内容来自 lib/resume.ts（唯一数据源，与 PDF 同步维护）。
 * 设计语言与站点一致：纸面 + 墨线 + lime 强调 + 等宽元信息。
 * 每条可验证的主张带「证据链接」——招聘者看十份 PDF，
 * 只有这一份能点回站内实证。
 * ============================================================ */

import { RESUME } from "@/lib/resume";
import { T } from "./i18n";

function SectionTitle({ zh, en }: { zh: string; en: string }) {
  return (
    <h2 className="rs-h2">
      <span className="rs-h2-zh">{zh}</span>
      <span className="rs-h2-en">{en}</span>
    </h2>
  );
}

export default function ResumeSheet() {
  return (
    <article className="rs" data-ver={RESUME.updated}>
      {/* ---- 抬头 ---- */}
      <header className="rs-head">
        <div className="rs-id">
          <h1>
            {RESUME.name}
            <span className="rs-name-en">{RESUME.nameEn}</span>
          </h1>
          <p className="rs-meta">{RESUME.meta}</p>
          <ul className="rs-contacts">
            {RESUME.contacts.map((c) => (
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
          <a className="rs-btn rs-btn-primary" href={RESUME.pdf} download="Alvin-Luo-Resume.pdf">
            ↧ <T en="Download PDF" zh="下载 PDF" />
            <span className="rs-btn-sub">{RESUME.pdfSize}</span>
          </a>
          <button type="button" className="rs-btn" onClick={() => window.print()}>
            ⎙ <T en="Print" zh="打印" />
          </button>
          <p className="rs-updated">
            <T en={`PDF · ${RESUME.updated}`} zh={`PDF 版本 ${RESUME.updated}`} />
          </p>
        </div>
      </header>

      {/* ---- 教育 ---- */}
      <section>
        <SectionTitle zh="教育背景" en="EDUCATION" />
        {RESUME.education.map((e) => (
          <div className="rs-item" key={e.school}>
            <div className="rs-item-head">
              <h3>
                {e.school}
                <span className="rs-item-sub">{e.schoolEn}</span>
                <span className="rs-item-mid">· {e.degree}</span>
              </h3>
              <span className="rs-period">{e.period}</span>
            </div>
            {e.note && <p className="rs-note">{e.note}</p>}
            <p className="rs-majors">
              {e.majors.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </p>
            {"verify" in e && e.verify && (
              <a className="rs-verify" href={e.verify.href}>
                ✓ {e.verify.label} ↗
              </a>
            )}
          </div>
        ))}
      </section>

      {/* ---- 实习 ---- */}
      <section>
        <SectionTitle zh="实习经历" en="EXPERIENCE" />
        {RESUME.experience.map((x) => (
          <div className="rs-item" key={x.company}>
            <div className="rs-item-head">
              <h3>
                {x.company}
                <span className="rs-item-mid">· {x.role}</span>
              </h3>
              <span className="rs-period">{x.period}</span>
            </div>
            <ul className="rs-bullets">
              {x.bullets.map((b, i) => (
                <li key={i}>{b.text}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ---- 项目 ---- */}
      <section>
        <SectionTitle zh="项目经历" en="PROJECTS" />
        {RESUME.projects.map((p) => (
          <div className="rs-item" key={p.name}>
            <div className="rs-item-head">
              <h3>
                {p.name}
                <span className="rs-item-mid">— {p.tagline}</span>
              </h3>
              <span className="rs-period">{p.period}</span>
            </div>
            <p className="rs-proj-meta">
              {p.type}
              {p.meta ? ` · ${p.meta}` : ""}
            </p>
            <ul className="rs-bullets">
              {p.bullets.map((b, i) => (
                <li key={i}>{b.text}</li>
              ))}
            </ul>
            {"verify" in p && p.verify && (
              <a className="rs-verify" href={p.verify.href} target={p.verify.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                ✓ {p.verify.label} ↗
              </a>
            )}
          </div>
        ))}
      </section>

      {/* ---- 校园 ---- */}
      <section>
        <SectionTitle zh="校园经历" en="CAMPUS" />
        <ul className="rs-bullets rs-campus">
          {RESUME.campus.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      {/* ---- 技能 ---- */}
      <section>
        <SectionTitle zh="专业技能" en="SKILLS" />
        <dl className="rs-skills">
          {RESUME.skills.map((s) => (
            <div className="rs-skill-row" key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.items}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- 荣誉与语言 ---- */}
      <section>
        <SectionTitle zh="荣誉与语言" en="HONORS & LANGUAGES" />
        <ul className="rs-honors">
          {RESUME.honors.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="rs-langs">{RESUME.languages}</p>
      </section>

      {/* ---- 自我评价 ---- */}
      <section>
        <SectionTitle zh="自我评价" en="SUMMARY" />
        <ul className="rs-bullets">
          {RESUME.summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>

      <footer className="rs-foot">
        <T
          en="Every claim above is verifiable — links lead to living proof on this site. The PDF keeps the phone number; email is one click away."
          zh="以上每条主张都可验证——链接通向站内活着的实证。手机号只在 PDF 里，邮箱一键即达。"
        />
      </footer>
    </article>
  );
}
