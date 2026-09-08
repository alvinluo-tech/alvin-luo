"use client";

import { useState } from "react";
import { PROJECTS } from "@/config/site";
import { T } from "./i18n";

/* GitHub Pages 子路径部署：构建时内联 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* 作品集：编辑部式交错排布。
   封面支持「架构 X-Ray」：点击按钮淡出 UI 层，透视出底层技术链路 */
export default function Projects() {
  const [xray, setXray] = useState<string | null>(null);

  return (
    <section className="projects" id="projects">
      <div className="section-head" data-reveal>
        <p className="eyebrow">SELECTED WORK</p>
        <h2>
          <T en="Things I've built." zh="我做过的东西。" />
        </h2>
      </div>

      <div className="project-list">
        {PROJECTS.map((p, i) => {
          const isXray = xray === p.id;
          return (
            <article
              className={i % 2 ? "project-row is-flipped" : "project-row"}
              data-reveal
              key={p.id}
            >
              <div className="project-cover-wrap">
                <a
                  className="project-cover"
                  href={p.demo ?? p.repo ?? "#"}
                  target={p.demo && p.demo !== "#" ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={p.title}
                  onClick={(e) => isXray && e.preventDefault()}
                >
                  {/* 仿浏览器窗口顶栏：让占位封面更像“产品截图” */}
                  <span className="cover-chrome" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span className="cover-url">
                      {(() => {
                        try {
                          return p.demo && p.demo !== "#"
                            ? new URL(p.demo).hostname
                            : "coming.soon";
                        } catch {
                          return p.demo ?? "";
                        }
                      })()}
                    </span>
                  </span>
                  <span className={`cover-art art-${p.art}`} aria-hidden="true" />
                  {p.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="cover-shot"
                      src={`${BASE_PATH}${p.image}`}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span className="cover-sheen" aria-hidden="true" />
                  <span className="cover-index" aria-hidden="true">
                    N°{String(i + 1).padStart(2, "0")}
                  </span>

                  {/* 架构 X-Ray 层：与 Hero 的透视哲学呼应——表面是产品，底层是架构 */}
                  <span className={isXray ? "cover-xray is-open" : "cover-xray"} aria-hidden="true">
                    <span className="xray-label">ARCHITECTURE</span>
                    {p.arch?.map((node, k) => (
                      <span className="xray-node" key={node}>
                        {k > 0 && <span className="xray-arrow">→</span>}
                        <span className="xray-chip">{node}</span>
                      </span>
                    ))}
                  </span>
                </a>
                {p.arch && p.arch.length > 0 && (
                  <button
                    type="button"
                    className={isXray ? "xray-btn is-on" : "xray-btn"}
                    onClick={() => setXray(isXray ? null : p.id)}
                  >
                    {isXray ? "× CLOSE" : "⌖ ARCHITECTURE"}
                  </button>
                )}
              </div>

              <div className="project-info">
                <h3>
                  <T en={p.title} zh={p.titleZh ?? p.title} />
                </h3>
                <p>
                  <T en={p.desc} zh={p.descZh ?? p.desc} />
                </p>
                <div className="tag-row">
                  {p.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="project-links">
                  {p.demo && (
                    <a href={p.demo} target={p.demo !== "#" ? "_blank" : undefined} rel="noopener noreferrer">
                      Live Demo ↗
                    </a>
                  )}
                  {p.repo && (
                    <a href={p.repo} target={p.repo !== "#" ? "_blank" : undefined} rel="noopener noreferrer">
                      Source ↗
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
