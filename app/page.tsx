import Link from "next/link";
import HeroStage from "@/components/HeroStage";
import Travel from "@/components/Travel";
import Projects from "@/components/Projects";
import GitHubTile from "@/components/GitHubTile";
import MusicBand from "@/components/MusicBand";
import DailyPick from "@/components/DailyPick";
import { T } from "@/components/i18n";
import { EMAIL, GITHUB_URL, GITHUB_USER } from "@/config/site";

export default function Home() {
  return (
    <main>
      {/* ============ HERO：居中人像 × 破格大字 ============ */}
      <section className="hero" aria-label="Intro">
      {/* 环境光晕：填补宽屏人像两侧的空旷带 */}
      <div className="hero-glow" aria-hidden="true" />
        {/* 巨型排版（纯装饰） */}
        <div className="hero-type" aria-hidden="true">
          <span className="type-solid">ALVIN</span>
          <span className="type-outline">LUO.</span>
        </div>

        <p className="eyebrow hero-eyebrow">SOFTWARE ENGINEER — GYM REGULAR</p>

        {/* 透视人像（居中、底边贴住视口） */}
        <HeroStage />

        <div className="hero-copy">
          <h1 className="headline">
            <T
              en={
                <>
                  I build digital experiences.
                  <br />
                  <span className="muted">And occasionally,</span>{" "}
                  <em className="abs">abs.</em>
                </>
              }
              zh={
                <>
                  我做数字产品。
                  <br />
                  <span className="muted">副业是</span>{" "}
                  <em className="abs">练腹肌。</em>
                </>
              }
            />
          </h1>
          <p className="sub">
            <T
              en="Building products by day, building myself after hours."
              zh="白天构建产品，空闲构建自己。"
            />
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#projects">
              <T en="See my work ↓" zh="看我的作品 ↓" />
            </a>
            <a
              className="btn btn-ghost"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub ↗
            </a>
          </div>
        </div>

        <p className="hero-scroll" aria-hidden="true">
          SCROLL&nbsp;↓
        </p>
      </section>

      {/* ============ 跑马灯分隔 ============ */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          <span>
            BUILD FOR THE WEB&nbsp;&nbsp;✦&nbsp;&nbsp;BUILD MYSELF&nbsp;&nbsp;✦&nbsp;&nbsp;SHIP
            CODE&nbsp;&nbsp;✦&nbsp;&nbsp;LIFT HEAVY&nbsp;&nbsp;✦&nbsp;&nbsp;
          </span>
          <span>
            BUILD FOR THE WEB&nbsp;&nbsp;✦&nbsp;&nbsp;BUILD MYSELF&nbsp;&nbsp;✦&nbsp;&nbsp;SHIP
            CODE&nbsp;&nbsp;✦&nbsp;&nbsp;LIFT HEAVY&nbsp;&nbsp;✦&nbsp;&nbsp;
          </span>
        </div>
      </div>

      {/* ============ 作品集 ============ */}
      <Projects />

      {/* ============ BENTO 面板 ============ */}
      <section className="bento" id="about">
        <div className="section-head" data-reveal>
          <p className="eyebrow">BEYOND THE KEYBOARD</p>
          <h2>
            <T en="More than commits." zh="不止写代码。" />
          </h2>
        </div>

        <div className="bento-grid">
          {/* GitHub 热力图：整行通栏（多图源自动降级） */}
          <article className="tile tile-gh tile-wide">
            <h3 className="tile-title">
              GITHUB
              <a
                className="tile-title-link"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{GITHUB_USER}&nbsp;↗
              </a>
            </h3>
            <GitHubTile />
          </article>

          {/* 网易云音乐叙事区：NOW PLAYING + ON REPEAT + 歌单 + 统计
              （config/site.ts 里 NETEASE_API 未配置时整块自动隐藏） */}
          <MusicBand />

          {/* TODO: 换成你自己的介绍 */}
          <article className="tile tile-about">
            <h3 className="tile-title">ABOUT</h3>
            <p>
              <T
                en={
                  <>
                    Code is my day job, lifting is how I recharge.
                    <br />
                    Two or three lines about who you are and what you care
                    about go here — <span className="todo">TODO: your story</span>.
                  </>
                }
                zh={
                  <>
                    写代码是我的日常，撸铁是我的充电方式。
                    <br />
                    这里应该有两三句话介绍你是谁、在乎什么——
                    <span className="todo">TODO：替换成你的故事</span>。
                  </>
                }
              />
            </p>
          </article>

          {/* TODO: 改成你自己的数据 */}
          <article className="tile tile-gym">
            <h3 className="tile-title">GYM LOG</h3>
            <ul className="stat-list">
              <li><span>BENCH</span><b>100 KG</b></li>
              <li><span>SQUAT</span><b>140 KG</b></li>
              <li><span>DEADLIFT</span><b>180 KG</b></li>
            </ul>
          </article>

          {/* 正在做的事 → /now 页 */}
          <Link href="/now" className="tile tile-now is-link">
            <h3 className="tile-title">CURRENTLY</h3>
            <ul className="dot-list">
              <li><T en="TODO: project in progress" zh="TODO：正在构建的项目" /></li>
              <li><T en="TODO: what you're learning" zh="TODO：正在学的东西" /></li>
              <li>
                <T
                  en={
                    <>
                      TODO: latest <small>experiments</small>
                    </>
                  }
                  zh={
                    <>
                      TODO：最近的<small>小实验</small>
                    </>
                  }
                />
                <a className="tile-more" href="/now">
                  <T en="more →" zh="更多 →" />
                </a>
              </li>
              <DailyPick />
            </ul>
            <span className="tile-more">MORE →</span>
          </Link>

          {/* 联系 */}
          <article className="tile tile-contact">
            <h3 className="tile-title">SAY HELLO</h3>
            <a className="contact-link" href={`mailto:${EMAIL}`}>
              {EMAIL}
              <span className="arrow">→</span>
            </a>
          </article>
        </div>
      </section>

      {/* ============ 旅行胶片：钉住式横向滚动 ============ */}
      <Travel />
    </main>
  );
}
