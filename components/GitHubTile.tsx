"use client";

import { useState } from "react";
import { GITHUB_USER, GITHUB_URL } from "@/config/site";
import { T, pick, useLocale } from "./i18n";

/* GitHub 热力图瓷砖：ghchart 在国内网络不稳定，
   按顺序尝试多个图源，全部失败则回退为引导占位 */
const SOURCES = [
  `https://ghchart.rshah.org/${GITHUB_USER}`,
  `https://github-readme-activity-graph.vercel.app/graph?username=${GITHUB_USER}&area=true&hide_border=true`,
  `https://github-readme-stats.vercel.app/api?username=${GITHUB_USER}&show_icons=true&hide_border=true`,
];

export default function GitHubTile() {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const { locale } = useLocale();

  if (GITHUB_USER === "your-username") {
    return (
      <div className="gh-placeholder">
        <T
          en={
            <>
              Fill in your GitHub username in <code>config/site.ts</code> and
              your contribution chart shows up here.
            </>
          }
          zh={
            <>
              在 <code>config/site.ts</code> 里填上你的 GitHub 用户名，
              这里会显示你的贡献热力图。
            </>
          }
        />
      </div>
    );
  }

  if (failed || idx >= SOURCES.length) {
    return (
      <div className="gh-placeholder">
        <T
          en={
            <>
              Chart sources unreachable right now.
              <br />
              Check it on{" "}
              <a
                className="tile-title-link"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>{" "}
              directly.
            </>
          }
          zh={
            <>
              贡献图暂时加载不出来（图源在部分网络不可达）。
              <br />
              直接去{" "}
              <a
                className="tile-title-link"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub 主页
              </a>{" "}
              看吧。
            </>
          }
        />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className="ghchart-img"
      src={SOURCES[idx]}
      alt={pick(
        locale,
        `${GITHUB_USER}'s GitHub contribution chart`,
        `${GITHUB_USER} 的 GitHub 贡献图`,
      )}
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
