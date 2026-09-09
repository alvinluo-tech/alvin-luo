import Link from "next/link";
import HeroStage from "@/components/HeroStage";
import Projects from "@/components/Projects";
import GitHubTile from "@/components/GitHubTile";
import MusicBand from "@/components/MusicBand";
import DailyPick from "@/components/DailyPick";
import LondonClock from "@/components/LondonClock";
import TerminalTile from "@/components/TerminalTile";
import BookshelfTile from "@/components/BookshelfTile";
import Travel from "@/components/Travel";
import { T } from "@/components/i18n";
import { EMAIL, GITHUB_URL, GITHUB_USER } from "@/config/site";
import { TRIPS } from "@/data/trips";

export default function Home() {
  /* WANDERLUST 瓷砖数据：最近一站 + 累计足迹 */
  const latest = [...TRIPS].sort((a, b) => b.date.localeCompare(a.date))[0];
  const countries = new Set(TRIPS.map((t) => t.country)).size;

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

          {/* 网易云音乐叙事区（NETEASE_API 未配置时整块自动隐藏） */}
          <MusicBand />

          {/* TODO: 换成你自己的介绍 */}
          <article className="tile tile-about">
            <h3 className="tile-title">ABOUT</h3>
            <LondonClock />
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
            {/* 拍立得：故意打破网格的手作感（真实照片就位前用 CSS 画作占位） */}
            <span className="polaroid" aria-hidden="true">
              <span className="washi" />
              <span className="polaroid-art">☕</span>
              <span className="polaroid-cap">02:14 AM — ship it</span>
            </span>
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
                {/* 不能再用 <a>：外层 Link 已是锚点，HTML 禁止嵌套（会打碎水合） */}
                <span className="tile-more">
                  <T en="more →" zh="更多 →" />
                </span>
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

          {/* 精神食粮书架 */}
          <BookshelfTile />

          {/* 旅行引子：点击平滑下滚到电影胶片卷轴 */}
          <a href="#travel" className="tile tile-travel is-link">
            <div className="wt-photo" aria-hidden="true">
              <span className="wt-cover">✈</span>
              <span className="wt-stamp">
                {countries} <small>COUNTRIES</small>
              </span>
            </div>
            <div className="wt-meta">
              <h3 className="tile-title">WANDERLUST</h3>
              <p className="wt-latest">
                LATEST — {latest.place}
                <span>
                  {latest.date} · {latest.note}
                </span>
              </p>
              <p className="wt-cta">
                {TRIPS.length} stops &amp; counting — Scroll to filmstrip ↓
              </p>
            </div>
          </a>

          {/* Alvin 的等距小房间入口瓷砖 */}
          <Link href="/room" className="tile tile-room is-link">
            <div className="tile-room-body">
              <div className="tile-room-head">
                <span className="tile-room-pill">
                  <span className="tile-room-dot" />
                  <T en="2.5D ISOMETRIC" zh="2.5D 等距空间" />
                </span>
                <span className="tile-room-badge">
                  <T en="LIVE DURHAM CLOCK" zh="杜伦真实时间" />
                </span>
              </div>
              <h3 className="tile-title">
                <T en="ALVIN'S ROOM" zh="ALVIN 的房间" />
              </h3>
              <p className="tile-room-desc">
                <T
                  en="A room, not a page. Desk holds my projects, window follows real time, and the cat purrs when you click it."
                  zh="一个房间，不只是一个页面。书桌藏着项目，窗户跟着真实时间明暗，点一下猫还会打呼噜。"
                />
              </p>
            </div>
            <div className="tile-room-cta-zone">
              <div className="tile-room-preview" aria-hidden="true">
                <span>🛏 <small>Bed</small></span>
                <span>🖥 <small>Projects</small></span>
                <span>📚 <small>Books</small></span>
                <span>🐱 <small>Pet Cat</small></span>
                <span>♪ <small>Vinyl</small></span>
              </div>
              <span className="tile-room-enter">
                <T en="ENTER ROOM →" zh="推门进去看看 →" />
              </span>
            </div>
          </Link>

          {/* 极客终端彩蛋：Bento 底部通栏压轴 */}
          <TerminalTile />
        </div>
      </section>

      {/* ============ 电影感旅行足迹胶片卷轴（横向钉住滑动） ============ */}
      <Travel />
    </main>
  );
}
