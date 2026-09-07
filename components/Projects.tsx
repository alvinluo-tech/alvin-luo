import { PROJECTS } from "@/config/site";
import { T } from "./i18n";

/* 作品集：编辑部式交错排布，封面用 CSS 花纹（无图也可上线） */
export default function Projects() {
  return (
    <section className="projects" id="projects">
      <div className="section-head" data-reveal>
        <p className="eyebrow">SELECTED WORK</p>
        <h2>
          <T en="Things I've built." zh="我做过的东西。" />
        </h2>
      </div>

      <div className="project-list">
        {PROJECTS.map((p, i) => (
          <article
            className={i % 2 ? "project-row is-flipped" : "project-row"}
            data-reveal
            key={p.id}
          >
            <a
              className="project-cover"
              href={p.demo ?? p.repo ?? "#"}
              target={p.demo && p.demo !== "#" ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-label={p.title}
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
              <span className="cover-sheen" aria-hidden="true" />
              <span className="cover-index" aria-hidden="true">
                N°{String(i + 1).padStart(2, "0")}
              </span>
            </a>

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
        ))}
      </div>
    </section>
  );
}
